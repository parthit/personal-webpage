"use client";

import { useMemo, useState } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { useAnimationPlayer } from "@/components/animation/useAnimationPlayer";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  clear,
  contains,
  createBTree,
  insert,
  LAYOUT,
  layoutTree,
  remove,
  search,
  withDegree,
  type BTreeSnapshot,
  type SearchStep,
} from "@/lib/btree/btree";
import {
  buildDeleteFrames,
  buildInsertFrames,
  buildSearchFrames,
  VIZ_HOLD_MS,
  VIZ_STEP_MS,
  type VizAccent,
  type VizFrame,
} from "@/lib/btree/demo-animation";
import { useTreeViewport } from "./btree/useTreeViewport";
import { ScrollableFigure } from "./ScrollableFigure";

const SAMPLE = [10, 20, 5, 6, 12, 30, 7, 17, 3];

const DEGREE_OPTIONS = [2, 3, 4].map((t) => ({
  value: String(t),
  label: `t = ${t}`,
}));

function parseKeys(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/** Wider than the writing column on desktop; full width on mobile. */
const figureShell =
  "not-prose relative my-8 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 lg:left-1/2 lg:w-[min(56rem,calc(100vw-2.5rem))] lg:max-w-none lg:-translate-x-1/2";

type FrameView = {
  highlight: SearchStep[];
  accent: VizAccent | null;
  message: string;
  stepInfo: { index: number; total: number } | null;
};

const INITIAL_MESSAGE =
  "Try insert, search, or delete — each walk animates the path so nodes don't just pop in.";

function sampleTree(degree = 2): BTreeSnapshot {
  let tree = createBTree(degree);
  for (const key of SAMPLE) tree = insert(tree, key);
  return tree;
}

type BTreeAnimationSnapshot = {
  tree: BTreeSnapshot;
  frameView: FrameView;
};

export function BTreeVisualizer() {
  const playback = useAnimationPlayer<BTreeAnimationSnapshot>(
    {
      snapshot: {
        tree: sampleTree(),
        frameView: {
          highlight: [],
          accent: null,
          message: INITIAL_MESSAGE,
          stepInfo: null,
        },
      },
      label: INITIAL_MESSAGE,
    },
    VIZ_STEP_MS
  );
  const tree = playback.current.snapshot.tree;
  const frameView = playback.current.snapshot.frameView;
  const [input, setInput] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const [degree, setDegree] = useState(2);
  const busy = playback.isActive;

  const layout = useMemo(() => layoutTree(tree.root), [tree]);

  const highlightedIds = useMemo(
    () => new Set(frameView.highlight.map((s) => s.nodeId)),
    [frameView.highlight]
  );
  const foundStep = useMemo(
    () => frameView.highlight.find((s) => s.found),
    [frameView.highlight]
  );
  const focusNodeId =
    frameView.highlight.length > 0
      ? frameView.highlight[frameView.highlight.length - 1]?.nodeId
      : null;
  const treeScrollRef = useTreeViewport({
    layoutWidth: layout.width,
    nodes: layout.nodes,
    focusNodeId,
  });

  function resetView(nextTree: BTreeSnapshot, message: string) {
    playback.reset({
      snapshot: {
        tree: nextTree,
        frameView: {
          highlight: [],
          accent: null,
          message,
          stepInfo: null,
        },
      },
      label: message,
    });
  }

  async function runFrames(
    frames: VizFrame[],
    startTree: BTreeSnapshot,
    mutate?: (tree: BTreeSnapshot) => BTreeSnapshot
  ): Promise<boolean> {
    let nextTree = startTree;
    const steps = frames.map((frame, index) => {
      if (frame.commitMutation && mutate) nextTree = mutate(nextTree);
      const nextHighlight =
        frame.relocateAfterCommit != null
          ? search(nextTree.root, frame.relocateAfterCommit).steps
          : frame.highlight;
      return {
        snapshot: {
          tree: nextTree,
          frameView: {
            highlight: nextHighlight,
            accent: frame.accent,
            message: frame.message,
            stepInfo: { index: index + 1, total: frames.length },
          },
        },
        label: frame.message,
        durationMs: index === frames.length - 1 ? VIZ_HOLD_MS : VIZ_STEP_MS,
      };
    });
    return playback.run(steps);
  }

  async function showSummary(tree: BTreeSnapshot, message: string) {
    return playback.run([
      {
        snapshot: {
          tree,
          frameView: {
            highlight: [],
            accent: null,
            message,
            stepInfo: null,
          },
        },
        label: message,
        // Completion text remains visible after playback, so no extra dwell is
        // needed beyond the final teaching frame's hold.
        durationMs: 0,
      },
    ]);
  }

  async function runInsert() {
    const keys = parseKeys(input);
    if (keys.length === 0) {
      setValidationMessage("Enter one or more numbers to insert.");
      return;
    }

    setValidationMessage(null);
    setInput("");
    let working = playback.latest.snapshot.tree;
    const added: number[] = [];

    for (const key of keys) {
      const before = working;
      const willInsert = !contains(before, key);
      const path = search(before.root, key);
      const frames = buildInsertFrames(key, path.steps, willInsert);

      const ok = await runFrames(frames, before, (current) => {
        const next = insert(current, key);
        working = next;
        if (next.size > before.size) added.push(key);
        return next;
      });
      if (!ok) return;
    }

    await showSummary(
      working,
      added.length
        ? `Inserted ${added.join(", ")}. Size ${working.size}, height ${working.height}.`
        : "No new keys inserted (duplicates are ignored)."
    );
  }

  async function runSearch() {
    const keys = parseKeys(input);
    if (keys.length !== 1) {
      setValidationMessage("Enter a single number to search.");
      return;
    }
    setValidationMessage(null);
    const key = keys[0];
    const latestTree = playback.latest.snapshot.tree;
    const result = search(latestTree.root, key);
    const frames = buildSearchFrames(key, result.steps, result.found);
    const ok = await runFrames(frames, latestTree);
    if (!ok) return;
    await showSummary(
      latestTree,
      result.found
        ? `Found ${key} after visiting ${result.steps.length} node(s).`
        : `${key} not found. Path length ${result.steps.length}.`
    );
  }

  async function runDelete() {
    const keys = parseKeys(input);
    if (keys.length === 0) {
      setValidationMessage("Enter one or more numbers to delete.");
      return;
    }

    setValidationMessage(null);
    setInput("");
    let working = playback.latest.snapshot.tree;
    const removed: number[] = [];

    for (const key of keys) {
      const before = working;
      const willDelete = contains(before, key);
      const path = search(before.root, key);
      const frames = buildDeleteFrames(key, path.steps, willDelete);

      const ok = await runFrames(frames, before, (current) => {
        const next = remove(current, key);
        working = next;
        if (next.size < before.size) removed.push(key);
        return next;
      });
      if (!ok) return;
    }

    await showSummary(
      working,
      removed.length
        ? `Deleted ${removed.join(", ")}. Size ${working.size}, height ${working.height}.`
        : "No matching keys to delete."
    );
  }

  function runClear() {
    setValidationMessage(null);
    const next = clear(playback.latest.snapshot.tree);
    resetView(next, "Tree cleared.");
  }

  function loadSample() {
    setValidationMessage(null);
    resetView(
      sampleTree(degree),
      `Loaded sample keys: ${SAMPLE.join(", ")}.`
    );
  }

  function changeDegree(nextDegree: number) {
    setValidationMessage(null);
    setDegree(nextDegree);
    const next = withDegree(playback.latest.snapshot.tree, nextDegree);
    resetView(
      next,
      `Minimum degree t = ${nextDegree} (max ${2 * nextDegree - 1} keys per node).`
    );
  }

  const svgWidth = Math.max(layout.width, 320);
  const svgHeight = Math.max(layout.height, 120);
  const { highlight, accent, message } = frameView;

  return (
    <figure className={figureShell} data-btree-visualizer>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Interactive B-tree — insert, search, and delete animate along the path
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <label className="flex w-full flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          Key(s)
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setValidationMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void runInsert();
            }}
            placeholder="e.g. 15 or 1, 8, 22"
            disabled={busy}
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-60 sm:h-9 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void runInsert()}
          >
            Insert
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void runSearch()}
          >
            Search
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void runDelete()}
          >
            Delete
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={runClear}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="col-span-2 w-full sm:col-span-1 sm:w-auto"
            onClick={loadSample}
          >
            Sample
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-gray-200 px-3 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4 dark:border-gray-700">
        <SegmentedControl
          label="Min degree t"
          orientation="inline"
          size="sm"
          value={String(degree)}
          options={DEGREE_OPTIONS}
          onValueChange={(next) => changeDegree(Number(next))}
          disabled={busy}
          data-testid="min-degree"
        />
        <span className="text-xs text-gray-500 sm:ml-auto dark:text-gray-400">
          size {tree.size} · height {tree.height} · max keys/node {2 * degree - 1}
        </span>
      </div>

      <ScrollableFigure
        scrollRef={treeScrollRef}
        revision={svgWidth}
        className="px-2 py-4"
        label="Scroll sideways to see the whole tree"
      >
        {tree.root ? (
          <div
            className="mx-auto"
            style={{ width: svgWidth, height: svgHeight, minWidth: svgWidth }}
          >
            <svg
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              role="img"
              aria-label="B-tree visualization"
              className="block"
            >
              {layout.edges.map((edge) => (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={edge.fromX}
                  y1={edge.fromY}
                  x2={edge.toX}
                  y2={edge.toY}
                  className="btree-edge stroke-gray-400 dark:stroke-gray-500"
                  strokeWidth={1.5}
                />
              ))}
              {layout.nodes.map((node) => {
                const isOnPath = highlightedIds.has(node.id);
                const isFocus =
                  highlight.length > 0 &&
                  highlight[highlight.length - 1]?.nodeId === node.id;
                const foundIdx =
                  foundStep && foundStep.nodeId === node.id
                    ? foundStep.keyIndex
                    : null;

                return (
                  <g
                    key={node.id}
                    className="btree-node btree-node-enter"
                    style={{
                      transform: `translate(${node.x}px, ${node.y}px)`,
                    }}
                  >
                    <g className={isFocus ? "btree-pulse" : undefined}>
                      <rect
                        x={-node.width / 2}
                        y={-LAYOUT.NODE_H / 2}
                        width={node.width}
                        height={LAYOUT.NODE_H}
                        rx={6}
                        className={
                          isOnPath
                            ? "fill-amber-100 stroke-amber-500 transition-[fill,stroke] duration-300 dark:fill-amber-950 dark:stroke-amber-400"
                            : "fill-white stroke-gray-400 transition-[fill,stroke] duration-300 dark:fill-gray-950 dark:stroke-gray-500"
                        }
                        strokeWidth={isOnPath ? 2 : 1.25}
                      />
                      {node.keys.map((key, i) => {
                        const kx =
                          -node.width / 2 +
                          LAYOUT.KEY_PAD / 2 +
                          i * LAYOUT.KEY_W +
                          LAYOUT.KEY_W / 2;
                        const isFound = foundIdx === i;
                        const isAccentKey = accent?.key === key;
                        const accentClass =
                          isAccentKey && accent?.kind === "insert"
                            ? "btree-key-pop fill-emerald-700 font-semibold dark:fill-emerald-300"
                            : isAccentKey && accent?.kind === "delete"
                              ? "btree-key-fade fill-rose-700 font-semibold dark:fill-rose-300"
                              : isAccentKey && accent?.kind === "found"
                                ? "btree-key-pop fill-amber-800 font-semibold dark:fill-amber-200"
                                : isFound
                                  ? "fill-amber-800 font-semibold dark:fill-amber-200"
                                  : "fill-gray-800 dark:fill-gray-100";

                        return (
                          <g key={`${node.id}-${key}-${i}`}>
                            {i > 0 && (
                              <line
                                x1={
                                  -node.width / 2 +
                                  LAYOUT.KEY_PAD / 2 +
                                  i * LAYOUT.KEY_W
                                }
                                y1={-LAYOUT.NODE_H / 2 + 6}
                                x2={
                                  -node.width / 2 +
                                  LAYOUT.KEY_PAD / 2 +
                                  i * LAYOUT.KEY_W
                                }
                                y2={LAYOUT.NODE_H / 2 - 6}
                                className="stroke-gray-300 dark:stroke-gray-600"
                              />
                            )}
                            <text
                              key={
                                isAccentKey
                                  ? `${node.id}-${key}-${accent?.kind}`
                                  : undefined
                              }
                              x={kx}
                              y={1}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className={`text-[12px] ${accentClass}`}
                              data-btree-key={key}
                              data-btree-accent={
                                isAccentKey ? accent?.kind : undefined
                              }
                            >
                              {key}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Empty tree — insert a key or load the sample.
          </p>
        )}
      </ScrollableFigure>

      <AnimationPlayer player={playback} />

      <p
        className="border-t border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-700 sm:px-4 dark:border-gray-700 dark:text-gray-300"
        aria-live="polite"
        data-btree-status
      >
        {validationMessage ?? message}
      </p>
    </figure>
  );
}
