import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simulate, validateIsolationScript } from "./model";
import {
  DIRTY_READ,
  ISOLATION_SCRIPTS,
  LOST_UPDATE,
  READ_SKEW,
  SCENARIO_LEVELS,
  WRITE_SKEW,
} from "./scripts";
import {
  buildIsolationSteps,
  isolationPresentationAt,
  sequenceDwellMs,
  TX_HOLD_MS,
  TX_MAX_STEP_MS,
  TX_MIN_STEP_MS,
} from "./frames";

describe("dirty reads", () => {
  it("leaks Alice's uncommitted write under read uncommitted", () => {
    const run = simulate(DIRTY_READ, "read-uncommitted");
    const bobRead = run.scenario.messages.find(
      (m) => m.kind === "response" && m.to === "bob"
    );
    assert.equal(bobRead?.label, "600");
    assert.ok(run.aborted.includes("alice"));
    assert.match(run.outcome, /never committed/);
  });

  it("hides the aborted write under read committed", () => {
    const run = simulate(DIRTY_READ, "read-committed");
    const bobRead = run.scenario.messages.find(
      (m) => m.kind === "response" && m.to === "bob"
    );
    assert.equal(bobRead?.label, "500");
    assert.match(run.outcome, /did not leak/);
  });
});

describe("lost updates", () => {
  it("lets the second commit clobber the first under read committed", () => {
    const run = simulate(LOST_UPDATE, "read-committed");
    assert.deepEqual(run.aborted, []);
    assert.match(run.outcome, /vanished/);
    const last = run.beats.at(-1);
    assert.equal(last?.records[0].committed, 600);
    const aliceCommit = run.scenario.events.find(
      (event) => event.actorId === "alice" && event.kind === "commit"
    );
    const bobWrite = run.scenario.messages.find(
      (message) =>
        message.from === "bob" &&
        message.kind === "request" &&
        message.label.startsWith("SET")
    );
    assert.ok(aliceCommit);
    assert.ok(bobWrite);
    assert.ok(
      bobWrite.t0 > aliceCommit.at,
      "Bob overwrites a committed value, not Alice's uncommitted write"
    );
  });

  it("aborts the second writer under snapshot isolation", () => {
    const run = simulate(LOST_UPDATE, "snapshot");
    assert.ok(run.aborted.includes("bob"));
    assert.match(run.outcome, /retry/);
    const last = run.beats.at(-1);
    assert.equal(last?.records[0].committed, 600);
  });
});

describe("read skew", () => {
  it("lets Bob add balances that never existed under read committed", () => {
    const run = simulate(READ_SKEW, "read-committed");
    const bobReplies = run.scenario.messages.filter(
      (m) => m.kind === "response" && m.to === "bob"
    );
    assert.deepEqual(
      bobReplies.map((m) => m.label),
      ["500", "600"]
    );
    assert.match(run.outcome, /1100/);
  });

  it("keeps Bob on a snapshot that adds up", () => {
    const run = simulate(READ_SKEW, "snapshot");
    const bobReplies = run.scenario.messages.filter(
      (m) => m.kind === "response" && m.to === "bob"
    );
    assert.deepEqual(
      bobReplies.map((m) => m.label),
      ["500", "500"]
    );
    assert.match(run.outcome, /1000/);
  });
});

describe("operation-local responses", () => {
  it("preserves values when overlapping reads arrive out of request order", () => {
    const run = simulate(
      {
        id: "overlapping-reads",
        title: "Overlapping reads",
        summary: "Responses arrive out of request order.",
        clients: [
          { id: "alice", label: "Alice" },
          { id: "bob", label: "Bob" },
        ],
        records: [{ id: "row", label: "Row", value: 0 }],
        ops: [
          { kind: "begin", tx: "alice", t: 0 },
          { kind: "begin", tx: "bob", t: 0.1 },
          {
            kind: "read",
            tx: "alice",
            record: "row",
            t: 1,
            timing: { request: 1, processing: 1, response: 5 },
          },
          {
            kind: "write",
            tx: "bob",
            record: "row",
            t: 3.2,
            set: 1,
            timing: { request: 0.2, processing: 0.2, response: 0.2 },
          },
          { kind: "commit", tx: "bob", t: 4 },
          {
            kind: "read",
            tx: "alice",
            record: "row",
            t: 4.2,
            timing: { request: 0.2, processing: 0.2, response: 0.2 },
          },
          { kind: "commit", tx: "alice", t: 8.5 },
        ],
      },
      "read-committed"
    );
    const arrivals = run.beats
      .map((beat) => beat.caption)
      .filter((caption) => caption.startsWith("Alice receives Row"));
    assert.deepEqual(arrivals, [
      "Alice receives Row = 1.",
      "Alice receives Row = 0.",
    ]);
  });
});

describe("write skew", () => {
  it("lets both doctors go off call under snapshot isolation", () => {
    const run = simulate(WRITE_SKEW, "snapshot");
    assert.deepEqual(run.aborted, []);
    const last = run.beats.at(-1);
    assert.equal(last?.records[0].committed, 0);
    assert.equal(last?.records[1].committed, 0);
    assert.match(run.outcome, /Both went off call/);
  });

  it("aborts the second doctor under serializable", () => {
    const run = simulate(WRITE_SKEW, "serializable");
    assert.ok(run.aborted.includes("bob"));
    const last = run.beats.at(-1);
    assert.equal(last?.records.find((r) => r.id === "alice-shift")?.committed, 0);
    assert.equal(last?.records.find((r) => r.id === "bob-shift")?.committed, 1);
  });
});

describe("isolation animation steps", () => {
  it("paces a walkthrough slowly enough to follow", () => {
    assert.ok(TX_MIN_STEP_MS >= 900);
    assert.ok(TX_HOLD_MS >= TX_MAX_STEP_MS);
    assert.equal(sequenceDwellMs(0.2), TX_MIN_STEP_MS);
    assert.equal(sequenceDwellMs(20), TX_MAX_STEP_MS);
    const steps = buildIsolationSteps(LOST_UPDATE, "read-committed");
    assert.ok(steps.length >= 8);
    assert.equal(steps[0].snapshot.fromNow, 0);
    assert.ok(steps[1].snapshot.fromNow < steps[1].snapshot.toNow);
    assert.equal(steps.at(-1)?.snapshot.settled, true);
    assert.equal(
      steps.at(-1)?.snapshot.fromNow,
      steps.at(-1)?.snapshot.toNow,
      "the final hold does not crawl through the last transition"
    );
    assert.equal(steps.at(-1)?.durationMs, TX_HOLD_MS);
  });

  it("keeps captions and record state behind the live playhead", () => {
    const run = simulate(DIRTY_READ, "read-uncommitted");
    const writeFinished = run.beats.find((beat) =>
      beat.caption.includes("finishes the write")
    );
    assert.ok(writeFinished);
    const before = isolationPresentationAt(run, writeFinished.now - 0.01);
    const at = isolationPresentationAt(run, writeFinished.now);
    assert.equal(before.records[0].uncommitted, null);
    assert.equal(at.records[0].uncommitted, 600);
    assert.doesNotMatch(before.caption, /finishes the write/);
    assert.match(at.caption, /finishes the write/);
  });

  it("ends each transaction only after its own responses arrive", () => {
    for (const [scenarioId, script] of Object.entries(ISOLATION_SCRIPTS)) {
      for (const level of SCENARIO_LEVELS[
        scenarioId as keyof typeof SCENARIO_LEVELS
      ]) {
        const run = simulate(script, level);
        for (const client of script.clients) {
          const finished = run.scenario.events.find(
            (event) =>
              event.actorId === client.id &&
              (event.kind === "commit" || event.kind === "abort")
          );
          const lastResponse = Math.max(
            0,
            ...(run.scenario.intervals ?? [])
              .filter(
                (interval) =>
                  interval.actorId === client.id &&
                  interval.kind === "waiting"
              )
              .map((interval) => interval.t1)
          );
          assert.ok(finished, `${scenarioId}:${client.id} has an end event`);
          assert.ok(
            finished.at >= lastResponse,
            `${scenarioId}:${client.id} ends at ${finished.at} before response ${lastResponse}`
          );
        }
      }
    }
  });

  it("keeps every teaching beat at a distinct point on the time axis", () => {
    for (const [scenarioId, script] of Object.entries(ISOLATION_SCRIPTS)) {
      const level =
        SCENARIO_LEVELS[scenarioId as keyof typeof SCENARIO_LEVELS][0];
      const beats = simulate(script, level).beats.map((beat) => beat.now);
      assert.equal(
        new Set(beats).size,
        beats.length,
        `${scenarioId} has collapsed teaching beats`
      );
    }
  });

  it("draws request, database work, and response as separate durations", () => {
    const run = simulate(DIRTY_READ, "read-committed");
    const request = run.scenario.messages.find(
      (message) => message.kind === "request"
    );
    const response = run.scenario.messages.find(
      (message) =>
        message.kind === "response" &&
        message.exchangeId === request?.exchangeId
    );
    const processing = run.scenario.intervals?.find(
      (interval) =>
        interval.kind === "processing" &&
        interval.exchangeId === request?.exchangeId
    );
    const waiting = run.scenario.intervals?.find(
      (interval) =>
        interval.kind === "waiting" &&
        interval.exchangeId === request?.exchangeId
    );

    assert.ok(request);
    assert.ok(response);
    assert.ok(processing);
    assert.ok(waiting);
    assert.equal(processing.t0, request.t1);
    assert.equal(response.t0, processing.t1);
    assert.equal(waiting.t0, request.t0);
    assert.equal(waiting.t1, response.t1);
    assert.ok(response.t0 > request.t1, "the database visibly takes time");
  });

  it("rejects malformed scripts before building a misleading diagram", () => {
    assert.throws(
      () =>
        validateIsolationScript({
          id: "broken",
          title: "Broken",
          summary: "Invalid write",
          clients: [{ id: "alice", label: "Alice" }],
          records: [{ id: "row", label: "Row", value: 0 }],
          ops: [
            { kind: "begin", tx: "alice", t: 0 },
            { kind: "write", tx: "alice", record: "row", t: 1 },
            { kind: "commit", tx: "alice", t: 2 },
          ],
        }),
      /exactly one of set or add/
    );
  });

  it("keeps transaction identity separate from the client track", () => {
    const run = simulate(
      {
        id: "separate-identities",
        title: "Separate identities",
        summary: "A client runs a named transaction.",
        clients: [{ id: "browser", label: "Browser" }],
        transactions: [{ id: "checkout-42", clientId: "browser" }],
        records: [{ id: "row", label: "Row", value: 1 }],
        ops: [
          { kind: "begin", tx: "checkout-42", t: 0 },
          { kind: "read", tx: "checkout-42", record: "row", t: 1 },
          { kind: "commit", tx: "checkout-42", t: 4.5 },
        ],
      },
      "read-committed"
    );
    assert.equal(run.scenario.messages[0].from, "browser");
    assert.equal(run.scenario.spans?.[0].actorId, "browser");
    assert.equal(run.scenario.spans?.[0].label, "checkout-42");
  });
});
