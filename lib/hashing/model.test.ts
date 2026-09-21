import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RING_SIZE,
  assignKeys,
  clockwiseDelta,
  fnv1a,
  interpolateClockwise,
  keysFor,
  loadCounts,
  maxLoadSkew,
  moduloOwner,
  nextNodeId,
  remapReport,
  ringOwner,
  ringPosition,
  successorToken,
  tokensFor,
} from "./model";
import { createScene } from "./frames";

describe("fnv1a / ring position", () => {
  it("is stable for a known string", () => {
    assert.equal(fnv1a("cart"), fnv1a("cart"));
    assert.notEqual(fnv1a("cart"), fnv1a("user"));
    assert.equal(ringPosition("cart") >= 0, true);
    assert.equal(ringPosition("cart") < RING_SIZE, true);
  });
});

describe("ring successor", () => {
  it("picks the next token clockwise, wrapping past the end", () => {
    const a = { id: "a#0", nodeId: "a", vnode: 0, position: 10 };
    const b = { id: "b#0", nodeId: "b", vnode: 0, position: 200 };
    assert.equal(successorToken(10, [a, b])?.id, "a#0");
    assert.equal(successorToken(11, [a, b])?.id, "b#0");
    assert.equal(successorToken(200, [a, b])?.id, "b#0");
    assert.equal(ringOwner(350, [a, b]), "a");
  });

  it("returns null with no tokens", () => {
    assert.equal(successorToken(0, []), null);
  });

  it("places every default key on some token", () => {
    const tokens = tokensFor(["nyc", "lon", "syd"], 3);
    const keys = keysFor();
    for (const key of keys) {
      assert.ok(ringOwner(key.position, tokens));
    }
  });
});

describe("modulo vs ring remap", () => {
  it("moves fewer default keys than modulo when adding SFO", () => {
    const keys = keysFor();
    const beforeIds = ["nyc", "lon", "syd"];
    const afterIds = ["nyc", "lon", "syd", "sfo"];
    const vnodes = 3;
    const ringBefore = assignKeys(
      keys,
      beforeIds,
      tokensFor(beforeIds, vnodes),
      "ring"
    );
    const ringAfter = assignKeys(
      keys,
      afterIds,
      tokensFor(afterIds, vnodes),
      "ring"
    );
    const modBefore = assignKeys(keys, beforeIds, [], "modulo");
    const modAfter = assignKeys(keys, afterIds, [], "modulo");
    const ring = remapReport(ringBefore, ringAfter);
    const mod = remapReport(modBefore, modAfter);
    assert.equal(ring.total, 12);
    assert.equal(ring.movedCount, 3);
    assert.ok(mod.movedCount > ring.movedCount);
    assert.deepEqual(ring.moved.sort(), ["cart", "session", "user"]);
  });

  it("only remaps keys whose successor token changed", () => {
    const beforeIds = ["nyc", "lon", "syd"];
    const afterIds = ["nyc", "lon", "syd", "sfo"];
    const tokensBefore = tokensFor(beforeIds, 3);
    const tokensAfter = tokensFor(afterIds, 3);
    const keys = keysFor();
    for (const key of keys) {
      const oldTok = successorToken(key.position, tokensBefore);
      const newTok = successorToken(key.position, tokensAfter);
      const moved = oldTok?.nodeId !== newTok?.nodeId;
      const expected = newTok?.nodeId === "sfo";
      assert.equal(moved, expected);
    }
  });

  it("modulo owner is hash % N in catalog order", () => {
    const ids = ["nyc", "lon", "syd"];
    assert.equal(moduloOwner("cart", ids), ids[fnv1a("cart") % 3]);
  });
});

describe("membership helpers", () => {
  it("offers SFO after the default three nodes", () => {
    assert.equal(nextNodeId(["nyc", "lon", "syd"]), "sfo");
    assert.equal(nextNodeId(["nyc", "lon", "syd", "sfo", "bom"]), null);
  });

  it("keeps load counts summing to the key total", () => {
    const scene = createScene();
    const tokens = tokensFor(scene.nodeIds, scene.vnodes);
    const assignment = assignKeys(scene.keys, scene.nodeIds, tokens, "ring");
    const counts = loadCounts(assignment, scene.nodeIds);
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.equal(sum, scene.keys.length);
    assert.ok(maxLoadSkew(counts) < scene.keys.length);
  });
});

describe("clockwise interpolation", () => {
  it("wraps from late in the ring to early", () => {
    assert.equal(clockwiseDelta(350, 10), 20);
    assert.equal(interpolateClockwise(350, 10, 0.5), 0);
    assert.equal(interpolateClockwise(10, 10, 0.3), 10);
  });
});
