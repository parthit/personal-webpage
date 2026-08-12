import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeleteFrames,
  buildIndexLookupFrames,
  buildInsertFrames,
  buildSearchFrames,
  buildTableScanFrames,
  compareIoCost,
  effectiveStepMs,
  playFrames,
} from "./demo-animation";
import type { SearchStep } from "./btree";

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

    const miss = buildSearchFrames(99, steps.slice(0, 1), false);
    assert.equal(miss.at(-1)?.accent?.kind, "miss");
    assert.match(miss.at(-1)!.message, /not in this node|not found/i);
  });

  it("marks insert commit only when the key will be added", () => {
    const path: SearchStep[] = [
      { nodeId: "n1", keyIndex: null, found: false },
      { nodeId: "n2", keyIndex: null, found: false },
    ];
    const insert = buildInsertFrames(42, path, true);
    assert.ok(insert.some((f) => f.commitMutation));
    assert.equal(insert.at(-1)?.accent?.kind, "insert");

    const dupSteps: SearchStep[] = [
      { nodeId: "n1", keyIndex: 0, found: true },
    ];
    const dup = buildInsertFrames(42, dupSteps, false);
    assert.ok(!dup.some((f) => f.commitMutation));
    assert.match(dup.at(-1)!.message, /already present/i);
  });

  it("builds delete frames that commit when the key exists", () => {
    const hit: SearchStep[] = [
      { nodeId: "n1", keyIndex: null, found: false },
      { nodeId: "n3", keyIndex: 1, found: true },
    ];
    const frames = buildDeleteFrames(7, hit, true);
    const commitIdx = frames.findIndex((f) => f.commitMutation);
    assert.ok(commitIdx > 0);
    assert.equal(frames[commitIdx - 1]?.accent?.kind, "delete");
    assert.equal(frames[commitIdx - 1]?.commitMutation, undefined);
    assert.equal(frames.at(-1)?.accent?.kind, "delete");

    const miss: SearchStep[] = [
      { nodeId: "n1", keyIndex: null, found: false },
    ];
    const missFrames = buildDeleteFrames(7, miss, false);
    assert.ok(!missFrames.some((f) => f.commitMutation));
    assert.match(missFrames.at(-1)!.message, /not found/i);
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
  });

  it("compares I/O costs with a clear multiplier", () => {
    assert.match(compareIoCost(6, 3), /2\.0×/);
    assert.match(compareIoCost(3, 0), /Run the B-tree index/);
    assert.match(compareIoCost(0, 0), /Run both/);
  });

  it("skips delay when reduced motion is preferred", () => {
    assert.equal(effectiveStepMs(true, 400), 0);
    assert.equal(effectiveStepMs(false, 400), 400);
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
});
