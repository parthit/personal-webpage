import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendSteps,
  clampStep,
  PLAYBACK_RATES,
  scaleDuration,
  seekTimeline,
  visibleHistory,
  type AnimationTimeline,
} from "./core";

describe("animation timeline", () => {
  const timeline: AnimationTimeline<number> = {
    steps: [
      { snapshot: 0, label: "Ready" },
      { snapshot: 1, label: "First" },
      { snapshot: 2, label: "Second" },
    ],
    index: 1,
  };

  it("clamps direct seeks to valid steps", () => {
    assert.equal(clampStep(-4, 3), 0);
    assert.equal(clampStep(9, 3), 2);
    assert.equal(clampStep(1.6, 3), 2);
    assert.equal(clampStep(0, 0), -1);
    assert.equal(seekTimeline(timeline, 99).index, 2);
  });

  it("projects past, current, and future history", () => {
    const history = visibleHistory(timeline);
    assert.deepEqual(
      history.past.map((step) => step.label),
      ["Ready"]
    );
    assert.equal(history.current?.label, "First");
    assert.deepEqual(
      history.future.map((step) => step.label),
      ["Second"]
    );
  });

  it("appends a run and positions playback at its first step", () => {
    const appended = appendSteps(timeline, [
      { snapshot: 3, label: "Third" },
      { snapshot: 4, label: "Fourth" },
    ]);
    assert.equal(appended.index, 3);
    assert.deepEqual(
      appended.steps.map((step) => step.snapshot),
      [0, 1, 2, 3, 4]
    );
    assert.equal(timeline.steps.length, 3, "input remains immutable");
  });
});

describe("playback rate", () => {
  it("defaults to real time and offers slower and faster options", () => {
    assert.ok(PLAYBACK_RATES.includes(1));
    assert.ok(PLAYBACK_RATES.some((rate) => rate < 1), "a slower rate exists");
    assert.ok(PLAYBACK_RATES.some((rate) => rate > 1), "a faster rate exists");
  });

  it("scales a step's dwell without ever reaching zero", () => {
    assert.equal(scaleDuration(1600, 1), 1600);
    assert.equal(scaleDuration(1600, 2), 800);
    assert.equal(scaleDuration(1600, 0.5), 3200);
    assert.equal(scaleDuration(1, 2), 1);
    assert.equal(scaleDuration(0, 2), 0, "zero-dwell summary steps stay zero");
  });
});
