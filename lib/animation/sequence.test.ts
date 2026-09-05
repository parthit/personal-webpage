import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lerp, visiblePlayhead } from "./core";
import {
  arrowEndpoints,
  layoutSequence,
  messageProgress,
  viewAt,
  type SequenceScenario,
} from "./sequence";

const scenario: SequenceScenario = {
  id: "demo",
  title: "Demo",
  duration: 10,
  actors: [
    { id: "alice", label: "Alice", kind: "person", group: "Clients" },
    { id: "acc1", label: "Account 1", kind: "record", group: "Records" },
  ],
  messages: [
    {
      id: "req",
      from: "alice",
      to: "acc1",
      t0: 2,
      t1: 4,
      label: "SELECT",
      kind: "request",
    },
    {
      id: "res",
      from: "acc1",
      to: "alice",
      t0: 4,
      t1: 6,
      label: "500",
      kind: "response",
    },
  ],
  notes: [{ id: "n1", actorId: "acc1", at: 4, text: "balance = 500" }],
  events: [
    { id: "e1", actorId: "alice", at: 1, label: "begin", kind: "begin" },
    { id: "e2", actorId: "alice", at: 8, label: "commit", kind: "commit" },
  ],
  spans: [
    {
      id: "s1",
      actorId: "alice",
      t0: 1,
      t1: 8,
      status: "committed",
    },
  ],
};

describe("continuous playhead", () => {
  it("lerps and snaps under reduced motion", () => {
    assert.equal(lerp(0, 10, 0.25), 2.5);
    assert.equal(visiblePlayhead(2, 6, 0.5), 4);
    assert.equal(visiblePlayhead(2, 6, 0.5, true), 6);
  });
});

describe("sequence view", () => {
  it("keeps future arrows pending and grows inflight ones", () => {
    const early = viewAt(scenario, 0);
    assert.equal(early.messages[0].status, "pending");
    assert.equal(early.events.length, 0);
    assert.equal(early.notes.length, 0);

    const mid = viewAt(scenario, 3);
    assert.equal(mid.messages[0].status, "inflight");
    assert.equal(mid.messages[0].progress, 0.5);
    assert.equal(mid.events.length, 1);
    assert.equal(mid.spans[0].status, "active");
    assert.equal(mid.spans[0].t1, 3);

    const late = viewAt(scenario, 9);
    assert.equal(late.messages[1].status, "arrived");
    assert.equal(late.notes[0].text, "balance = 500");
    assert.equal(late.spans[0].status, "committed");
    assert.equal(messageProgress(scenario.messages[0], 4).status, "arrived");
  });

  it("lays out grouped tracks with a monotonic time axis", () => {
    const layout = layoutSequence(scenario);
    assert.equal(layout.tracks.length, 2);
    assert.equal(layout.groups.length, 2);
    assert.ok(layout.plotRight > layout.plotLeft);
    assert.ok(layout.tracks[1].y > layout.tracks[0].y);
    const geom = arrowEndpoints(layout, scenario.duration, scenario.messages[0], 0.5);
    assert.ok(geom);
    assert.ok(geom.x2 > geom.x1);
    assert.ok(geom.y2 > geom.y1);
  });
});
