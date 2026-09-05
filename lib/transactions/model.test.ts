import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simulate } from "./model";
import { DIRTY_READ, LOST_UPDATE, READ_SKEW, WRITE_SKEW } from "./scripts";
import { buildIsolationSteps, TX_HOLD_MS, TX_STEP_MS } from "./frames";

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
  });

  it("aborts the second writer under serializable", () => {
    const run = simulate(LOST_UPDATE, "serializable");
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
    assert.ok(TX_STEP_MS >= 1600);
    assert.ok(TX_HOLD_MS >= TX_STEP_MS);
    const steps = buildIsolationSteps(LOST_UPDATE, "read-committed");
    assert.ok(steps.length >= 8);
    assert.equal(steps[0].snapshot.fromNow, 0);
    assert.ok(steps[1].snapshot.fromNow < steps[1].snapshot.toNow);
    assert.ok(steps.at(-1)?.snapshot.outcome);
    assert.equal(steps.at(-1)?.durationMs, TX_HOLD_MS);
  });
});
