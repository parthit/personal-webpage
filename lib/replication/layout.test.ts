import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLeaderCluster,
  createMultiLeaderCluster,
  createPeerCluster,
} from "./model";
import {
  layoutLeaderTree,
  layoutMultiLeader,
  layoutQuorum,
  packetHops,
} from "./layout";

describe("replica graph layout", () => {
  it("places the leader below the client and followers below the leader", () => {
    const layout = layoutLeaderTree(createLeaderCluster());
    const client = layout.nodes.find((n) => n.id === "client");
    const nyc = layout.nodes.find((n) => n.replicaId === "nyc");
    const lon = layout.nodes.find((n) => n.replicaId === "lon");
    const tyo = layout.nodes.find((n) => n.replicaId === "tyo");
    assert.ok(client && nyc && lon && tyo);
    assert.ok(client.y < nyc.y);
    assert.ok(nyc.y < lon.y);
    assert.equal(lon.y, tyo.y);
    assert.notEqual(lon.x, tyo.x);
    assert.ok(
      layout.edges.some(
        (e) =>
          e.kind === "replication" &&
          e.from === "replica:nyc" &&
          e.to === "replica:lon"
      )
    );
    assert.ok(
      layout.edges.some(
        (e) =>
          e.kind === "replication" &&
          e.from === "replica:nyc" &&
          e.to === "replica:tyo"
      )
    );
    assert.ok(
      layout.edges.some(
        (e) => e.kind === "client" && e.from === "client" && e.to === "replica:nyc"
      )
    );
  });

  it("re-roots the tree when a follower is promoted", () => {
    const replicas = createLeaderCluster().map((r) => {
      if (r.id === "nyc") return { ...r, role: "follower" as const, alive: false };
      if (r.id === "lon") return { ...r, role: "leader" as const };
      return r;
    });
    const layout = layoutLeaderTree(replicas);
    const lon = layout.nodes.find((n) => n.replicaId === "lon")!;
    const nyc = layout.nodes.find((n) => n.replicaId === "nyc")!;
    const tyo = layout.nodes.find((n) => n.replicaId === "tyo")!;
    assert.ok(lon.y < nyc.y);
    assert.equal(nyc.y, tyo.y);
    assert.ok(
      layout.edges.some(
        (e) => e.from === "replica:lon" && e.to === "replica:tyo"
      )
    );
  });

  it("draws a peer link between multi-leader sites and can mark it broken", () => {
    const up = layoutMultiLeader(createMultiLeaderCluster(), false);
    const down = layoutMultiLeader(createMultiLeaderCluster(), true);
    const peer = up.edges.find((e) => e.kind === "peer");
    assert.ok(peer);
    assert.equal(peer?.broken, false);
    assert.equal(down.edges.find((e) => e.kind === "peer")?.broken, true);
    assert.equal(up.nodes.filter((n) => n.kind === "client").length, 2);
  });

  it("arranges quorum replicas around a central client on a ring", () => {
    const layout = layoutQuorum(createPeerCluster(5));
    const client = layout.nodes.find((n) => n.id === "client")!;
    const replicas = layout.nodes.filter((n) => n.kind === "replica");
    assert.equal(replicas.length, 5);
    assert.equal(layout.edges.filter((e) => e.kind === "peer").length, 5);
    for (const node of replicas) {
      const dx = node.x - client.x;
      const dy = node.y - client.y;
      const dist = Math.hypot(dx, dy);
      assert.ok(dist > 100);
    }
  });

  it("routes client writes onto the client→leader hop", () => {
    const layout = layoutLeaderTree(createLeaderCluster());
    const hops = packetHops(layout, {
      kind: "client-send",
      toId: "nyc",
      highlightIds: ["nyc"],
      label: "write",
    });
    assert.deepEqual(hops, [
      { fromId: "client", toId: "replica:nyc", label: "write" },
    ]);
  });

  it("draws no packet for a purely local append", () => {
    const layout = layoutLeaderTree(createLeaderCluster());
    const hops = packetHops(layout, {
      kind: "leader-apply",
      toId: "nyc",
      highlightIds: ["nyc"],
      label: "apply locally",
    });
    assert.deepEqual(hops, [], "writing to your own log crosses no edge");
  });

  it("routes replication packets along the leader→follower edge", () => {
    const layout = layoutLeaderTree(createLeaderCluster());
    const hops = packetHops(layout, {
      kind: "replicate",
      fromId: "nyc",
      toId: "lon",
      highlightIds: ["nyc", "lon"],
    });
    assert.deepEqual(hops, [
      { fromId: "replica:nyc", toId: "replica:lon", label: undefined },
    ]);
  });

  it("routes a read request toward the replica and the response back to the client", () => {
    const layout = layoutLeaderTree(createLeaderCluster());
    const request = packetHops(layout, {
      kind: "read",
      toId: "lon",
      highlightIds: ["lon"],
      label: "read request",
    });
    assert.deepEqual(request, [
      { fromId: "client", toId: "replica:lon", label: "read request" },
    ]);
    const response = packetHops(layout, {
      kind: "read",
      fromId: "lon",
      highlightIds: ["lon"],
      label: "read response",
    });
    assert.deepEqual(response, [
      { fromId: "replica:lon", toId: "client", label: "read response" },
    ]);
  });

  it("routes a quorum write ack from replicas back to the client", () => {
    const layout = layoutQuorum(createPeerCluster(5));
    const hops = packetHops(layout, {
      kind: "client-ack",
      highlightIds: ["n1", "n2"],
      label: "client ack",
    });
    assert.deepEqual(
      hops.map((h) => [h.fromId, h.toId]),
      [
        ["replica:n1", "client"],
        ["replica:n2", "client"],
      ]
    );
  });
});
