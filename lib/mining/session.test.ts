import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initialMiningState,
  miningReducer,
  type MiningState,
} from "./session";

function mining(overrides: Partial<MiningState> = {}): MiningState {
  return { ...initialMiningState, mining: true, runId: 1, ...overrides };
}

describe("miningReducer", () => {
  it("ignores a solution that arrives after Stop", () => {
    const stopped = miningReducer(mining(), { type: "STOP_MINING" });
    assert.equal(stopped.mining, false);
    assert.equal(stopped.runId, 2);

    const stale = miningReducer(stopped, {
      type: "FOUND_NONCE",
      runId: 1,
      nonce: 17,
      hash: "abc0",
    });
    assert.equal(stale.foundNonce, null);
    assert.equal(stale.currentHash, "");
  });

  it("ignores a previous run's solution after a restart", () => {
    const restarted = miningReducer(miningReducer(mining(), { type: "STOP_MINING" }), {
      type: "START_MINING",
    });
    assert.equal(restarted.mining, true);
    assert.equal(restarted.runId, 3);

    const stale = miningReducer(restarted, {
      type: "FOUND_NONCE",
      runId: 1,
      nonce: 17,
      hash: "abc0",
    });
    assert.equal(stale.foundNonce, null);
    assert.equal(stale.currentHash, "");
    assert.equal(stale.mining, true);
  });

  it("accepts a solution from the active run", () => {
    const started = miningReducer(initialMiningState, { type: "START_MINING" });
    const found = miningReducer(started, {
      type: "FOUND_NONCE",
      runId: started.runId,
      nonce: 4,
      hash: "ff0",
    });
    assert.equal(found.foundNonce, 4);
    assert.equal(found.mining, false);
    assert.equal(found.currentHash, "ff0");
  });
});
