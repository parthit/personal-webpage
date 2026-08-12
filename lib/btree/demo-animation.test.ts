import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeleteFrames,
  buildIndexLookupFrames,
  buildInsertFrames,
  buildSearchFrames,
  buildTableScanFrames,
  compareIoCost,
  DEMO_STEP_MS,
  effectiveStepMs,
  INDEX_STEP_MS,
  playFrames,
  VIZ_HOLD_MS,
  VIZ_STEP_MS,
} from "./demo-animation";
import {
  createBTree,
  insert,
  search,
  type SearchStep,
} from "./btree";

describe("demo-animation helpers", () => {
  it("builds progressive search frames that end in found or miss", () => {
    const steps: SearchStep[] = [
      { nodeId: "n1", keyIndex: null, found: false },
      { nodeId: "n2", keyIndex: 0, found: true },
    ];
    const frames = buildSearchFrames(5, steps, true);
    assert.equal(frames[0].highlight.length, 0);
    assert.equal(frames.at(-1)?.accent?.kind, "found");
    assert.equal(frames.at(-1)?.highlight.length, 2);
    assert.match(frames.at(-1)!.message, /Found 5/);
    // Pause to scan keys before announcing the hit.
    assert.ok(frames.some((f) => /scan its keys/i.test(f.message)));

    const miss = buildSearchFrames(99, steps.slice(0, 1), false);
    assert.equal(miss.at(-1)?.accent?.kind, "miss");
    assert.match(miss.at(-1)!.message, /not found/i);
  });

  it("marks insert commit only when the key will be added", () => {
    const path: SearchStep[] = [
      { nodeId: "n1", keyIndex: null, found: false },
      { nodeId: "n2", keyIndex: null, found: false },
    ];
    const insertFrames = buildInsertFrames(42, path, true);
    const commit = insertFrames.find((f) => f.commitMutation);
    assert.ok(commit);
    assert.equal(commit?.relocateAfterCommit, 42);
    assert.equal(insertFrames.at(-1)?.accent?.kind, "insert");
    assert.equal(insertFrames.at(-1)?.relocateAfterCommit, 42);
    // Leaf dwell before mutation so the destination is visible.
    assert.ok(
      insertFrames.some((f) => /Ready to insert 42/i.test(f.message))
    );

    const dupSteps: SearchStep[] = [
      { nodeId: "n1", keyIndex: 0, found: true },
    ];
    const dup = buildInsertFrames(42, dupSteps, false);
    assert.ok(!dup.some((f) => f.commitMutation));
    assert.equal(dup.at(-1)?.accent?.kind, "found");
    assert.match(dup.at(-1)!.message, /already present/i);
  });

  it("uses the empty-tree root copy when inserting into an empty path", () => {
    const empty = buildInsertFrames(5, [], true);
    assert.ok(empty.some((f) => f.commitMutation));
    assert.ok(
      empty.some((f) => /Tree was empty — 5 becomes the new root/i.test(f.message))
    );
    assert.ok(!empty.some((f) => /Ready to insert|Placing 5 now/i.test(f.message)));
  });

  it("builds delete frames that mark, then commit, then clear", () => {
    const hit: SearchStep[] = [
      { nodeId: "n1", keyIndex: null, found: false },
      { nodeId: "n3", keyIndex: 1, found: true },
    ];
    const frames = buildDeleteFrames(7, hit, true);
    const commitIdx = frames.findIndex((f) => f.commitMutation);
    assert.ok(commitIdx > 0);
    assert.equal(frames[commitIdx - 1]?.accent?.kind, "delete");
    assert.equal(frames[commitIdx - 1]?.commitMutation, undefined);
    assert.match(frames.at(-1)!.message, /Deleted 7/);
    assert.equal(frames.at(-1)?.accent, null);

    const miss: SearchStep[] = [
      { nodeId: "n1", keyIndex: null, found: false },
    ];
    const missFrames = buildDeleteFrames(7, miss, false);
    assert.ok(!missFrames.some((f) => f.commitMutation));
    assert.match(missFrames.at(-1)!.message, /not found/i);
  });

  it("insert frames follow the real search path and relocate after splits", () => {
    const sample = [10, 20, 5, 6, 12, 30, 7, 17, 3];
    let tree = createBTree(2);
    for (const key of sample) tree = insert(tree, key);

    const before = search(tree.root, 88);
    assert.equal(before.found, false);
    assert.ok(before.steps.length >= 2);

    const frames = buildInsertFrames(88, before.steps, true);
    // Every pre-commit highlight is a prefix of the real miss path.
    for (const frame of frames) {
      if (frame.commitMutation || frame.relocateAfterCommit != null) continue;
      assert.ok(frame.highlight.length <= before.steps.length);
      frame.highlight.forEach((step, i) => {
        assert.equal(step.nodeId, before.steps[i].nodeId);
      });
    }

    const afterTree = insert(tree, 88);
    const after = search(afterTree.root, 88);
    assert.equal(after.found, true);
    // Splits can change which leaf holds the key — relocate must use the new path.
    const preLeaf = before.steps.at(-1)!.nodeId;
    const postLeaf = after.steps.at(-1)!.nodeId;
    assert.ok(after.steps.length >= 1);
    // Document the bug we fixed: post-split home can differ from the walk target.
    assert.ok(
      preLeaf === postLeaf || frames.some((f) => f.relocateAfterCommit === 88),
      "insert must relocate highlight when splits move the key"
    );
    assert.ok(frames.some((f) => f.relocateAfterCommit === 88));
  });

  it("uses a slower default pace for the CRUD visualizer than the index demo", () => {
    assert.ok(VIZ_STEP_MS >= 1800);
    assert.ok(VIZ_HOLD_MS >= 2400);
    assert.ok(INDEX_STEP_MS >= 1200);
    assert.ok(INDEX_STEP_MS > DEMO_STEP_MS);
    assert.ok(VIZ_STEP_MS >= INDEX_STEP_MS);
  });

  it("builds table-scan frames that count pages and stop on hit", () => {
    const rows = [
      { id: 3, page: 1 },
      { id: 6, page: 1 },
      { id: 9, page: 2 },
      { id: 12, page: 2 },
    ];
    const frames = buildTableScanFrames(9, rows, 2);
    assert.equal(frames[0].done, false);
    const done = frames.at(-1)!;
    assert.equal(done.done, true);
    assert.equal(done.pagesRead, 2);
    assert.deepEqual(done.scannedIds, [3, 6, 9]);
    assert.equal(done.rowId, 9);
    assert.ok(frames.some((f) => f.focusId === 9 && f.explanation.includes("found")));
  });

  it("builds index frames with heap fetch when present", () => {
    const steps: SearchStep[] = [
      { nodeId: "a", keyIndex: null, found: false },
      { nodeId: "b", keyIndex: 0, found: true },
    ];
    const hit = buildIndexLookupFrames(33, steps, 4);
    assert.equal(hit.at(-1)?.done, true);
    assert.equal(hit.at(-1)?.pagesRead, 3);
    assert.equal(hit.at(-1)?.heapFetched, true);
    assert.match(hit.at(-1)!.explanation, /heap page 4/i);

    const miss = buildIndexLookupFrames(11, steps.slice(0, 1), null);
    assert.equal(miss.at(-1)?.heapFetched, false);
    assert.equal(miss.at(-1)?.pagesRead, 1);
    assert.match(miss.at(-1)!.explanation, /no heap fetch/i);
    const leafMiss = miss.find(
      (f) => !f.done && f.nodesVisited === 1 && !f.heapFetched
    );
    assert.ok(leafMiss);
    assert.match(leafMiss!.explanation, /absent from this leaf|no further descent/i);
    assert.doesNotMatch(leafMiss!.explanation, /Narrow the range and descend/i);
  });

  it("compares I/O costs with a clear multiplier", () => {
    assert.match(compareIoCost(6, 3), /2\.0×/);
    assert.match(compareIoCost(3, 0), /Run the B-tree index/);
    assert.match(compareIoCost(0, 0), /Run both/);
    assert.match(compareIoCost(3, 4), /late id like 69/);
  });

  it("keeps walkthrough delays even when reduced motion is preferred", () => {
    // Decorative CSS is gated separately; pacing must stay readable.
    assert.equal(effectiveStepMs(true, 400), 400);
    assert.equal(effectiveStepMs(false, 1400), 1400);
  });

  it("plays frames in order and respects abort", async () => {
    const seen: number[] = [];
    await playFrames([1, 2, 3], async (n) => {
      seen.push(n);
    }, { stepMs: 0, holdMs: 0 });
    assert.deepEqual(seen, [1, 2, 3]);

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () =>
        playFrames([1], () => undefined, {
          stepMs: 0,
          holdMs: 0,
          signal: controller.signal,
        }),
      /AbortError/
    );
  });

  it("aborts cleanly between frames and after onFrame", async () => {
    const seen: number[] = [];
    const controller = new AbortController();
    const playing = playFrames(
      [1, 2, 3],
      async (n) => {
        seen.push(n);
        if (n === 1) controller.abort();
      },
      { stepMs: 20, holdMs: 20, signal: controller.signal }
    );
    await assert.rejects(() => playing, /AbortError/);
    assert.deepEqual(seen, [1]);
  });
});
