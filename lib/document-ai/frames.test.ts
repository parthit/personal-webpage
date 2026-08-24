import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFieldMatchingSteps,
} from "./frames";
import { DEFAULT_THRESHOLD } from "./model";

describe("document-ai frames", () => {
  it("walks scan → extract → per-field decide → done", () => {
    const steps = buildFieldMatchingSteps(undefined, DEFAULT_THRESHOLD);
    assert.ok(steps.length >= 8);
    assert.equal(steps[0]?.snapshot.phase, "scan");
    assert.equal(steps.at(-1)?.snapshot.phase, "done");
    assert.ok(
      Object.keys(steps.at(-1)?.snapshot.matches ?? {}).length === 5,
      "all schema fields should be decided by the end"
    );
  });
});
