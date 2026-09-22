import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RING_LAYOUT, angleFor, clockwiseArcPath, polar } from "./layout";

describe("hash ring layout", () => {
  it("puts position 0 at the top of the circle", () => {
    const p = polar(0, RING_LAYOUT.tokenR);
    assert.ok(Math.abs(p.x - RING_LAYOUT.cx) < 0.01);
    assert.ok(p.y < RING_LAYOUT.cy);
    assert.ok(Math.abs(angleFor(0) + Math.PI / 2) < 1e-9);
  });

  it("draws a clockwise arc that uses the large-arc flag past halfway", () => {
    const short = clockwiseArcPath(0, 40, 100);
    assert.ok(short);
    assert.match(short, /A 100 100 0 0 1/);
    const long = clockwiseArcPath(0, 200, 100);
    assert.ok(long);
    assert.match(long, /A 100 100 0 1 1/);
  });

  it("omits a degenerate zero-length arc", () => {
    assert.equal(clockwiseArcPath(12, 12, 100, 1), null);
  });
});
