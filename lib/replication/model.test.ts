import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addToCart,
  createLeaderCluster,
  createMultiLeaderCluster,
  createPeerCluster,
  formatCart,
  lastWriteQuorum,
  quorumIntersects,
  quorumSafe,
  readQuorumIds,
  writeQuorumIds,
} from "./model";
import {
  buildCatchupFrames,
  buildFailoverFrames,
  buildLeaderWriteFrames,
  buildPartitionWrites,
  buildQuorumReadFrames,
  buildQuorumWriteFrames,
  buildReadFrames,
  buildReconcileFrames,
} from "./frames";

describe("leader/follower replication", () => {
  it("synchronous writes wait until every follower applies before client ack", () => {
    const frames = buildLeaderWriteFrames(createLeaderCluster(), "7", "synchronous");
    const ack = frames.find((f) => f.kind === "client-ack");
    assert.ok(ack);
    assert.equal(ack?.clientAcked, true);
    assert.equal(frames[0].clientAcked, false);
    const ackIndex = frames.findIndex((f) => f.kind === "client-ack");
    assert.ok(ackIndex > frames.findIndex((f) => f.kind === "follower-apply"));
    const final = frames.at(-1)!;
    assert.ok(final.replicas.every((r) => r.value === "7" && r.version === 1));
  });

  it("asynchronous writes ack the client and leave followers behind", () => {
    const frames = buildLeaderWriteFrames(
      createLeaderCluster(),
      "3",
      "asynchronous"
    );
    assert.equal(frames.at(-1)?.kind, "client-ack");
    assert.ok(!frames.some((f) => f.kind === "follower-apply"));
    const last = frames.at(-1)!;
    assert.equal(last.replicas.find((r) => r.id === "lon")?.value, "0");
    assert.equal(last.replicas.find((r) => r.id === "nyc")?.value, "3");
  });

  it("reads a lagging follower as stale after an async write snapshot", () => {
    const asyncFrames = buildLeaderWriteFrames(
      createLeaderCluster(),
      "9",
      "asynchronous"
    );
    const mid = asyncFrames.find((f) => f.kind === "client-ack")!;
    const reads = buildReadFrames(mid.replicas, "lon");
    const result = reads.at(-1)!;
    assert.equal(result.stale, true);
    assert.equal(result.readValue, "0");
    assert.equal(result.kind, "stale-read");
  });

  it("failover drops unreplicated leader versions", () => {
    let replicas = createLeaderCluster();
    const written = buildLeaderWriteFrames(replicas, "4", "asynchronous");
    const afterLeaderOnly = written.find((f) => f.kind === "client-ack")!;
    const failover = buildFailoverFrames(afterLeaderOnly.replicas);
    const last = failover.at(-1)!;
    assert.equal(last.kind, "lost-write");
    const newLeader = last.replicas.find((r) => r.role === "leader");
    assert.ok(newLeader);
    assert.notEqual(newLeader?.id, "nyc");
    assert.equal(newLeader?.value, "0");
    assert.equal(
      last.replicas.find((r) => r.id === "nyc")?.alive,
      false
    );
  });

  it("catch-up copies the leader value onto lagging followers", () => {
    const written = buildLeaderWriteFrames(
      createLeaderCluster(),
      "5",
      "asynchronous"
    );
    const afterAck = written.find((f) => f.kind === "client-ack")!;
    const caught = buildCatchupFrames(afterAck.replicas);
    const last = caught.at(-1)!;
    assert.ok(last.replicas.filter((r) => r.alive).every((r) => r.value === "5"));
  });
});

describe("multi-leader carts", () => {
  it("partitioned adds diverge, LWW drops one side, union keeps both", () => {
    const partitioned = buildPartitionWrites(
      createMultiLeaderCluster(),
      "milk",
      "eggs"
    );
    const split = partitioned.at(-1)!;
    assert.equal(split.replicas.find((r) => r.id === "nyc")?.value, "bread, milk");
    assert.equal(split.replicas.find((r) => r.id === "lon")?.value, "bread, eggs");

    const lww = buildReconcileFrames(split.replicas, "last-write-wins", "nyc");
    assert.match(lww.at(-1)!.message, /Dropped: eggs/i);
    assert.equal(lww.at(-1)!.replicas[0].value, "bread, milk");
    assert.equal(lww.at(-1)!.replicas[1].value, "bread, milk");

    const merged = buildReconcileFrames(split.replicas, "union-merge");
    assert.equal(merged.at(-1)!.replicas[0].value, "bread, eggs, milk");
  });

  it("formats carts without a sentinel empty token", () => {
    assert.equal(formatCart([]), "");
    assert.equal(addToCart("", "Milk"), "milk");
  });
});

describe("quorums", () => {
  it("picks disjoint write/read sets exactly when W+R ≤ N", () => {
    assert.deepEqual(writeQuorumIds(5, 2), ["n1", "n2"]);
    assert.deepEqual(readQuorumIds(5, 2), ["n4", "n5"]);
    assert.equal(quorumIntersects(5, 2, 2), false);
    assert.equal(quorumSafe(5, 2, 2), false);
    assert.equal(quorumIntersects(5, 3, 3), true);
    assert.equal(quorumSafe(5, 3, 3), true);
  });

  it("a read can miss the write when quorums do not overlap", () => {
    const cluster = createPeerCluster(5);
    const written = buildQuorumWriteFrames(cluster, "42", 2);
    const after = written.at(-1)!;
    assert.equal(after.replicas.find((r) => r.id === "n1")?.value, "42");
    assert.equal(after.replicas.find((r) => r.id === "n5")?.value, "—");

    const staleRead = buildQuorumReadFrames(after.replicas, 2);
    assert.equal(staleRead.at(-1)?.stale, true);
    assert.equal(staleRead.at(-1)?.readValue, "—");

    const safeWrite = buildQuorumWriteFrames(cluster, "42", 3);
    const safeRead = buildQuorumReadFrames(safeWrite.at(-1)!.replicas, 3);
    assert.equal(safeRead.at(-1)?.stale, false);
    assert.equal(safeRead.at(-1)?.readValue, "42");
  });

  it("judges a later read against the write W that actually ran, not a new slider", () => {
    const cluster = createPeerCluster(5);
    const written = buildQuorumWriteFrames(cluster, "42", 2);
    const after = written.at(-1)!;
    // Slider moved to W=3, R=3: that *next* pair would overlap, but the
    // completed write only touched n1,n2. Infer W from replica versions.
    const read = buildQuorumReadFrames(after.replicas, 3);
    const last = read.at(-1)!;
    assert.equal(last.stale, true);
    assert.match(last.message, /last write W=2/i);
    assert.match(last.message, /are disjoint/i);
    assert.doesNotMatch(last.message, /sets overlap/i);
  });

  it("does not invent a write quorum when the cluster is still empty", () => {
    const read = buildQuorumReadFrames(createPeerCluster(5), 2);
    assert.match(read[0].message, /No completed write yet/i);
    assert.equal(read.at(-1)?.stale, false);
  });

  it("lastWriteQuorum is partial while write frames are still landing", () => {
    const frames = buildQuorumWriteFrames(createPeerCluster(5), "42", 3);
    const firstAck = frames.find((f) => f.kind === "quorum-write" && f.toId === "n1");
    assert.ok(firstAck);
    assert.equal(lastWriteQuorum(firstAck.replicas), 1);
    assert.equal(lastWriteQuorum(frames.at(-1)!.replicas), 3);
  });
});
