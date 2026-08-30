import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceDwell,
  appendSteps,
  clampStep,
  dwellClock,
  PLAYBACK_RATES,
  remainingDwellMs,
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

describe("step dwell", () => {
  it("tracks served time as a fraction of the step", () => {
    assert.equal(advanceDwell(0, 400, 1600), 0.25);
    assert.equal(advanceDwell(0.25, 400, 1600), 0.5);
    assert.equal(advanceDwell(0.9, 1600, 1600), 1, "never overshoots the step");
    assert.equal(advanceDwell(0, 100, 0), 1, "a zero-dwell step is done at once");
  });

  it("charges a resumed step only what it still owes", () => {
    assert.equal(remainingDwellMs(1600, 0), 1600);
    assert.equal(remainingDwellMs(1600, 0.25), 1200);
    assert.equal(remainingDwellMs(1600, 1), 0);
    assert.equal(remainingDwellMs(0, 0), 0);
  });

  it("keeps a mid-step speed change on the same fraction of the step", () => {
    // Half the step has been served; at 2x the rest takes half of 800ms.
    const slow = dwellClock(1600, 0.5);
    assert.deepEqual(slow, { durationMs: 1600, delayMs: 800 });
    const fast = dwellClock(800, 0.5);
    assert.deepEqual(fast, { durationMs: 800, delayMs: 400 });
    assert.equal(
      remainingDwellMs(fast.durationMs, 0.5),
      fast.durationMs - fast.delayMs,
      "the CSS clock and the step timer agree on what is left"
    );
  });

  it("seeds a shorter animation from the step's own progress", () => {
    // Packets fly for part of the dwell, so their delay is measured on the step.
    const clock = dwellClock(1600, 0.25, 1152);
    assert.deepEqual(clock, { durationMs: 1152, delayMs: 400 });
    assert.equal(clock.delayMs / clock.durationMs, 400 / 1152);
  });
});
