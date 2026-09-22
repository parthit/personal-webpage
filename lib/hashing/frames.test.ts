import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fnv1a } from "./model";
import {
  buildLookupSteps,
  buildMembershipSteps,
  createScene,
  idleSnapshot,
} from "./frames";

describe("hashing animation frames", () => {
  it("idle ring snapshot names the clockwise rule", () => {
    const snap = idleSnapshot(createScene("ring"));
    assert.equal(snap.mode, "ring");
    assert.equal(snap.nodeIds.length, 3);
    assert.equal(snap.tokens.length, 9);
    assert.match(snap.message, /clockwise/i);
  });

  it("lookup on the ring walks from the key to a token", () => {
    const scene = createScene("ring");
    const steps = buildLookupSteps(scene, "cart");
    assert.equal(steps.length, 3);
    const walk = steps[1].snapshot.walk;
    assert.ok(walk);
    assert.equal(walk.settled, undefined);
    assert.equal(walk.from, scene.keys.find((k) => k.id === "cart")?.position);
    assert.equal(steps[2].snapshot.walk?.settled, true);
    assert.equal(steps[2].snapshot.walk?.to, walk.to);
    assert.ok(steps[2].snapshot.highlightNodeIds.length === 1);
    assert.equal(steps[2].snapshot.lookupKeyId, "cart");
  });

  it("modulo lookup quotes the hash remainder, not the ring slot", () => {
    const scene = createScene("modulo");
    const steps = buildLookupSteps(scene, "cart");
    const hash = fnv1a("cart");
    assert.ok(steps.every((step) => step.snapshot.walk == null));
    assert.match(
      steps[0].snapshot.message,
      new RegExp(`hashes to ${hash}\\. Owner = ${hash} % 3 = ${hash % 3}`)
    );
    assert.doesNotMatch(steps[0].snapshot.message, /ring|lands at/i);
  });

  it("adding a node records how many keys moved vs modulo", () => {
    const result = buildMembershipSteps(createScene("ring"), "add");
    assert.ok(result);
    assert.deepEqual(result.nextScene.nodeIds, ["nyc", "lon", "syd", "sfo"]);
    const last = result.steps[result.steps.length - 1].snapshot;
    assert.equal(last.movedCount, 3);
    assert.ok(last.moduloWouldMove != null);
    assert.ok(last.movedCount! < last.moduloWouldMove);
    assert.match(last.message, /moved/i);
  });

  it("refuses to add past the catalog or remove below two nodes", () => {
    const full = createScene("ring", ["nyc", "lon", "syd", "sfo", "bom"]);
    assert.equal(buildMembershipSteps(full, "add"), null);
    const pair = createScene("ring", ["nyc", "lon"]);
    assert.equal(buildMembershipSteps(pair, "remove"), null);
  });

  it("remove restores the previous node list", () => {
    const result = buildMembershipSteps(
      createScene("ring", ["nyc", "lon", "syd", "sfo"]),
      "remove"
    );
    assert.ok(result);
    assert.deepEqual(result.nextScene.nodeIds, ["nyc", "lon", "syd"]);
  });
});
