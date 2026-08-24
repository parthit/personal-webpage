import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORKLIFT_SCENE,
  accuracyDeltaPp,
  speedupFactor,
} from "./model";
import { buildVisionCompareSteps } from "./frames";

describe("vision-compare model", () => {
  it("reports ~30× speedup on the fixture", () => {
    assert.equal(speedupFactor(FORKLIFT_SCENE), 30);
  });

  it("keeps accuracy within a few points", () => {
    assert.equal(accuracyDeltaPp(FORKLIFT_SCENE), 2);
  });

  it("builds a non-empty animation with terminal compare step", () => {
    const steps = buildVisionCompareSteps();
    assert.ok(steps.length >= 5);
    assert.equal(steps.at(-1)?.snapshot.phase, "done");
    assert.ok(
      steps.some((s) => s.snapshot.yoloDetections.length > 0),
      "specialized detections should appear"
    );
    assert.ok(
      steps.some((s) => s.snapshot.vlmDetections.length > 0),
      "VLM detections should appear"
    );
  });
});
