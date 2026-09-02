import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blockPayload,
  highlightTrailingZeros,
  meetsTrailingZeroTarget,
  parseNonceInput,
} from "./pow";

describe("blockPayload", () => {
  it("includes the numeric nonce so 0 is distinct from an empty field", () => {
    assert.equal(blockPayload(0), "Block data with nonce: 0");
    assert.notEqual(blockPayload(0), "Block data with nonce: ");
  });
});

describe("parseNonceInput", () => {
  it("accepts non-negative integers", () => {
    assert.equal(parseNonceInput("0"), 0);
    assert.equal(parseNonceInput(" 42 "), 42);
  });

  it("rejects empty, fractional, and negative values", () => {
    assert.equal(parseNonceInput(""), null);
    assert.equal(parseNonceInput("   "), null);
    assert.equal(parseNonceInput("1.5"), null);
    assert.equal(parseNonceInput("-1"), null);
    assert.equal(parseNonceInput("abc"), null);
  });
});

describe("meetsTrailingZeroTarget", () => {
  it("matches only the requested number of trailing hex zeros", () => {
    assert.equal(meetsTrailingZeroTarget("abc0", 1), true);
    assert.equal(meetsTrailingZeroTarget("abc0", 2), false);
    assert.equal(meetsTrailingZeroTarget("ab00", 2), true);
    assert.equal(meetsTrailingZeroTarget("0abc", 1), false);
  });
});

describe("highlightTrailingZeros", () => {
  it("splits the matched suffix so the UI can emphasize it", () => {
    assert.deepEqual(highlightTrailingZeros("deadbeef00", 2), {
      prefix: "deadbeef",
      zeros: "00",
    });
    assert.deepEqual(highlightTrailingZeros("deadbeef01", 2), {
      prefix: "deadbeef01",
      zeros: "",
    });
  });
});
