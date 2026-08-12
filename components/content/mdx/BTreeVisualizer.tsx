"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
  effectiveStepMs,
  playFrames,
  VIZ_HOLD_MS,
  VIZ_STEP_MS,
  type VizAccent,
  type VizFrame,
} from "@/lib/btree/demo-animation";

const SAMPLE = [10, 20, 5, 6, 12, 30, 7, 17, 3];

function parseKeys(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Wider than the writing column on desktop; full width on mobile. */
const figureShell =
  "not-prose relative my-8 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 lg:left-1/2 lg:w-[min(56rem,calc(100vw-2.5rem))] lg:max-w-none lg:-translate-x-1/2";

export function BTreeVisualizer() {
  const [tree, setTree] = useState<BTreeSnapshot>(() => {
    let t = createBTree(2);
    for (const key of SAMPLE) t = insert(t, key);
    return t;
  });
  const [input, setInput] = useState("");
  const [message, setMessage] = useState(
    "Try insert, search, or delete — each walk animates the path so nodes don't just pop in."
  );
  const [highlight, setHighlight] = useState<SearchStep[]>([]);
  const [accent, setAccent] = useState<VizAccent | null>(null);
  const [degree, setDegree] = useState(2);
  const [busy, setBusy] = useState(false);
  const [stepInfo, setStepInfo] = useState<{ index: number; total: number } | null>(
    null
  );
  const treeRef = useRef(tree);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const layout = useMemo(() => layoutTree(tree.root), [tree]);

  const highlightedIds = new Set(highlight.map((s) => s.nodeId));
  const foundStep = highlight.find((s) => s.found);

  function cancelAnimation() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  async function runFrames(
    frames: VizFrame[],
    onCommit?: () => BTreeSnapshot | void
  ): Promise<boolean> {
    cancelAnimation();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setStepInfo({ index: 0, total: frames.length });

    const reduced = prefersReducedMotion();
    const stepMs = effectiveStepMs(reduced, VIZ_STEP_MS);
    const holdMs = effectiveStepMs(reduced, VIZ_HOLD_MS);
    let latestTree = treeRef.current;

    try {
      await playFrames(
        frames,
        async (frame, index) => {
          setStepInfo({ index: index + 1, total: frames.length });
          setAccent(frame.accent);
          setMessage(frame.message);

          if (frame.commitMutation) {
            const next = onCommit?.();
            if (next) {
              latestTree = next;
            }
          }

          if (frame.relocateAfterCommit != null) {
            const relocated = search(
              latestTree.root,
              frame.relocateAfterCommit
            );
            setHighlight(relocated.steps);
          } else {
            setHighlight(frame.highlight);
          }
        },
        { stepMs, holdMs, signal: controller.signal }
      );
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return false;
      }
      throw err;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
        setStepInfo(null);
      }
    }
  }

  async function runInsert() {
    const keys = parseKeys(input);
    if (keys.length === 0) {
      setMessage("Enter one or more numbers to insert.");
      return;
    }

    setInput("");
    let working = treeRef.current;
    const added: number[] = [];

    for (const key of keys) {
      const before = working;
      const willInsert = !contains(before, key);
      const path = search(before.root, key);
      const frames = buildInsertFrames(key, path.steps, willInsert);

      const ok = await runFrames(frames, () => {
        const next = insert(before, key);
        working = next;
        treeRef.current = next;
        setTree(next);
        if (next.size > before.size) added.push(key);
        return next;
      });
      if (!ok) return;
    }

    setMessage(
      added.length
        ? `Inserted ${added.join(", ")}. Size ${working.size}, height ${working.height}.`
        : "No new keys inserted (duplicates are ignored)."
    );
  }

  async function runSearch() {
    const keys = parseKeys(input);
    if (keys.length !== 1) {
      setMessage("Enter a single number to search.");
      return;
    }
    const key = keys[0];
    const result = search(treeRef.current.root, key);
    const frames = buildSearchFrames(key, result.steps, result.found);
    const ok = await runFrames(frames);
    if (!ok) return;
    setMessage(
      result.found
        ? `Found ${key} after visiting ${result.steps.length} node(s).`
        : `${key} not found. Path length ${result.steps.length}.`
    );
  }

  async function runDelete() {
    const keys = parseKeys(input);
    if (keys.length === 0) {
      setMessage("Enter one or more numbers to delete.");
      return;
    }

    setInput("");
    let working = treeRef.current;
    const removed: number[] = [];

    for (const key of keys) {
      const before = working;
      const willDelete = contains(before, key);
      const path = search(before.root, key);
      const frames = buildDeleteFrames(key, path.steps, willDelete);

      const ok = await runFrames(frames, () => {
        const next = remove(before, key);
        working = next;
        treeRef.current = next;
        setTree(next);
        if (next.size < before.size) removed.push(key);
        return next;
      });
      if (!ok) return;
    }

    setMessage(
      removed.length
        ? `Deleted ${removed.join(", ")}. Size ${working.size}, height ${working.height}.`
        : "No matching keys to delete."
    );
  }

  function runClear() {
    cancelAnimation();
    setBusy(false);
    setStepInfo(null);
    setTree(clear(treeRef.current));
    setHighlight([]);
    setAccent(null);
    setMessage("Tree cleared.");
  }

  function loadSample() {
    cancelAnimation();
    setBusy(false);
    setStepInfo(null);
    let next = createBTree(degree);
    for (const key of SAMPLE) next = insert(next, key);
    setTree(next);
    setHighlight([]);
    setAccent(null);
    setMessage(`Loaded sample keys: ${SAMPLE.join(", ")}.`);
  }

  function changeDegree(nextDegree: number) {
    cancelAnimation();
    setBusy(false);
    setStepInfo(null);
    setDegree(nextDegree);
    setTree((prev) => withDegree(prev, nextDegree));
    setHighlight([]);
    setAccent(null);
    setMessage(
      `Minimum degree t = ${nextDegree} (max ${2 * nextDegree - 1} keys per node).`
    );
  }

  const svgWidth = Math.max(layout.width, 320);
  const svgHeight = Math.max(layout.height, 120);

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
            onChange={(e) => setInput(e.target.value)}
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
            variant="destructive"
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
        {busy && (
          <p
            className="text-xs font-medium text-amber-700 dark:text-amber-300"
            aria-live="polite"
            data-btree-animating
          >
            Animating operation
            {stepInfo
              ? ` — step ${stepInfo.index} of ${stepInfo.total}`
              : "…"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-b border-gray-200 px-3 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-600 dark:text-gray-400">Min degree t</span>
          {[2, 3, 4].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeDegree(t)}
              disabled={busy}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                degree === t
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-800"
              }`}
            >
              t = {t}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500 sm:ml-auto dark:text-gray-400">
          size {tree.size} · height {tree.height} · max keys/node {2 * degree - 1}
        </span>
      </div>

      <div className="min-w-0 w-full overflow-x-auto overscroll-x-contain touch-pan-x px-2 py-4">
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
                  className="stroke-gray-400 transition-[stroke] duration-300 dark:stroke-gray-500"
                  strokeWidth={1.5}
                />
              ))}
              {layout.nodes.map((node) => {
                const x = node.x - node.width / 2;
                const y = node.y - LAYOUT.NODE_H / 2;
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
                    className={isFocus ? "btree-pulse" : undefined}
                  >
                    <rect
                      x={x}
                      y={y}
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
                        x +
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
                              x1={x + LAYOUT.KEY_PAD / 2 + i * LAYOUT.KEY_W}
                              y1={y + 6}
                              x2={x + LAYOUT.KEY_PAD / 2 + i * LAYOUT.KEY_W}
                              y2={y + LAYOUT.NODE_H - 6}
                              className="stroke-gray-300 dark:stroke-gray-600"
                            />
                          )}
                          <text
                            x={kx}
                            y={node.y + 1}
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
                );
              })}
            </svg>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Empty tree — insert a key or load the sample.
          </p>
        )}
      </div>

      <p
        className="border-t border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-700 sm:px-4 dark:border-gray-700 dark:text-gray-300"
        aria-live="polite"
        data-btree-status
      >
        {message}
      </p>
    </figure>
  );
}
