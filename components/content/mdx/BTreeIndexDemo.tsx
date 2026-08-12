"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createBTree,
  insert,
  layoutTree,
  search,
  LAYOUT,
  type BTreeSnapshot,
} from "@/lib/btree/btree";
import {
  buildIndexLookupFrames,
  buildTableScanFrames,
  compareIoCost,
  DEMO_HOLD_MS,
  DEMO_STEP_MS,
  effectiveStepMs,
  INDEX_HOLD_MS,
  INDEX_STEP_MS,
  playFrames,
  type IndexDemoFrame,
} from "@/lib/btree/demo-animation";

type Row = {
  id: number;
  name: string;
  city: string;
  /** Simulated disk page that stores this row */
  page: number;
};

const NAMES = [
  "Ava",
  "Ben",
  "Cora",
  "Drew",
  "Elena",
  "Finn",
  "Gina",
  "Hugo",
  "Iris",
  "Jules",
  "Kara",
  "Leo",
  "Mia",
  "Noah",
  "Omar",
  "Pia",
  "Quinn",
  "Rosa",
  "Sam",
  "Tess",
  "Uma",
  "Vince",
  "Willa",
  "Xander",
  "Yara",
  "Zane",
];

const CITIES = [
  "Austin",
  "Berlin",
  "Chicago",
  "Dublin",
  "Edmonton",
  "Florence",
];

const PAGE_SIZE = 4;

/** Wider than the writing column on desktop; full width on mobile. */
const figureShell =
  "not-prose relative my-8 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 lg:left-1/2 lg:w-[min(56rem,calc(100vw-2.5rem))] lg:max-w-none lg:-translate-x-1/2";

/** Deterministic insert order (avoids SSR hydration mismatch). */
const INSERT_ORDER = [
  36, 12, 60, 3, 48, 24, 72, 9, 45, 18, 54, 30, 66, 6, 42, 21, 57, 15, 51, 27,
  63, 33, 69, 39,
];

function buildDataset(): { rows: Row[]; index: BTreeSnapshot; pageCount: number } {
  const ids = Array.from({ length: 24 }, (_, i) => (i + 1) * 3);

  const rows: Row[] = ids.map((id, i) => ({
    id,
    name: NAMES[i % NAMES.length],
    city: CITIES[i % CITIES.length],
    page: Math.floor(i / PAGE_SIZE) + 1,
  }));

  let index = createBTree(2);
  for (const id of INSERT_ORDER) {
    index = insert(index, id);
  }

  return {
    rows,
    index,
    pageCount: Math.ceil(rows.length / PAGE_SIZE),
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

type LastCosts = {
  key: number;
  scanPages: number | null;
  indexPages: number | null;
};

export function BTreeIndexDemo() {
  const [{ rows, index, pageCount }] = useState(buildDataset);
  // Prefer a late leaf key so table scan burns more heap pages than the index walk.
  const [query, setQuery] = useState("69");
  const [frame, setFrame] = useState<IndexDemoFrame | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastCosts, setLastCosts] = useState<LastCosts>({
    key: 69,
    scanPages: null,
    indexPages: null,
  });
  const [ioTick, setIoTick] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const tableBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const prevPagesRef = useRef(-1);
  const ioTickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layout = useMemo(() => layoutTree(index.root), [index]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const pathSet = useMemo(
    () => new Set(frame?.pathNodeIds ?? []),
    [frame?.pathNodeIds]
  );
  const scannedSet = useMemo(
    () => new Set(frame?.scannedIds ?? []),
    [frame?.scannedIds]
  );
  const nodeById = useMemo(() => {
    const map = new Map<string, (typeof layout.nodes)[number]>();
    for (const node of layout.nodes) map.set(node.id, node);
    return map;
  }, [layout]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (ioTickTimerRef.current) clearTimeout(ioTickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!frame?.focusId || !tableBodyRef.current) return;
    const el = tableBodyRef.current.querySelector(
      `[data-row-id="${frame.focusId}"]`
    );
    // Instant scroll avoids competing with the frame clock (smooth scroll janks).
    el?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [frame?.focusId]);

  // Keep the focused index node in view — the tree is often wider than the pane.
  useEffect(() => {
    const scroller = treeScrollRef.current;
    const focusId = frame?.focusNodeId;
    if (!scroller || !focusId) return;
    const node = nodeById.get(focusId);
    if (!node) return;

    const pad = 28;
    const left = node.x - node.width / 2 - pad;
    const right = node.x + node.width / 2 + pad;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;

    if (left < viewLeft) {
      scroller.scrollLeft = Math.max(0, left);
    } else if (right > viewRight) {
      scroller.scrollLeft = Math.max(0, right - scroller.clientWidth);
    }
  }, [frame?.focusNodeId, nodeById]);

  function cancelAnimation() {
    abortRef.current?.abort();
    abortRef.current = null;
    runIdRef.current += 1;
  }

  function pulseIo() {
    setIoTick(false);
    // Next frame: re-add class so the CSS animation restarts without remounting.
    requestAnimationFrame(() => {
      setIoTick(true);
      if (ioTickTimerRef.current) clearTimeout(ioTickTimerRef.current);
      ioTickTimerRef.current = setTimeout(() => setIoTick(false), 320);
    });
  }

  async function playDemo(frames: IndexDemoFrame[]): Promise<boolean> {
    cancelAnimation();
    const controller = new AbortController();
    const runId = runIdRef.current;
    abortRef.current = controller;
    setBusy(true);
    prevPagesRef.current = -1;

    // Index paths are short — long dwell per node. Scans have many frames.
    const indexMode = frames[0]?.mode === "index";
    const reduced = prefersReducedMotion();
    const stepMs = effectiveStepMs(
      reduced,
      indexMode ? INDEX_STEP_MS : DEMO_STEP_MS
    );
    const holdMs = effectiveStepMs(
      reduced,
      indexMode ? INDEX_HOLD_MS : DEMO_HOLD_MS
    );

    try {
      await playFrames(
        frames,
        async (next) => {
          if (runId !== runIdRef.current || controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          setFrame(next);
          if (next.pagesRead !== prevPagesRef.current) {
            prevPagesRef.current = next.pagesRead;
            pulseIo();
          }
        },
        { stepMs, holdMs, signal: controller.signal }
      );
      return runId === runIdRef.current;
    } catch (err) {
      if (isAbortError(err)) return false;
      throw err;
    } finally {
      if (abortRef.current === controller && runId === runIdRef.current) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  }

  async function runScan() {
    const key = Number(query);
    if (!Number.isFinite(key)) {
      setFrame(null);
      return;
    }

    const frames = buildTableScanFrames(
      key,
      rows.map((r) => ({ id: r.id, page: r.page })),
      pageCount
    );
    const ok = await playDemo(frames);
    if (!ok) return;

    const done = frames.at(-1)!;
    setLastCosts((prev) => ({
      key,
      scanPages: done.pagesRead,
      indexPages: prev.key === key ? prev.indexPages : null,
    }));
  }

  async function runIndex() {
    const key = Number(query);
    if (!Number.isFinite(key)) {
      setFrame(null);
      return;
    }

    const path = search(index.root, key);
    const row = byId.get(key) ?? null;
    const frames = buildIndexLookupFrames(
      key,
      path.steps,
      row ? row.page : null
    );
    const ok = await playDemo(frames);
    if (!ok) return;

    const done = frames.at(-1)!;
    setLastCosts((prev) => ({
      key,
      scanPages: prev.key === key ? prev.scanPages : null,
      indexPages: done.pagesRead,
    }));
  }

  const svgWidth = Math.max(layout.width, 280);
  const svgHeight = Math.max(layout.height, 100);
  const ioMax = Math.max(pageCount, frame?.pagesRead ?? 0, 1);
  const ioRatio = frame ? Math.min(1, frame.pagesRead / ioMax) : 0;
  const comparison =
    lastCosts.scanPages != null || lastCosts.indexPages != null
      ? compareIoCost(lastCosts.scanPages ?? 0, lastCosts.indexPages ?? 0)
      : null;
  const matchedRow =
    frame?.rowId != null ? byId.get(frame.rowId) ?? null : null;

  return (
    <figure className={figureShell} data-btree-index-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Interactive index — watch page I/O tick for table scan vs B-tree lookup
      </figcaption>

      <div className="grid min-w-0 gap-0 lg:grid-cols-2">
        <div className="min-w-0 border-b border-gray-200 p-3 sm:p-4 lg:border-b-0 lg:border-r dark:border-gray-700">
          <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Heap table (users)
          </h4>
          <p className="mb-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Rows sit in insertion order across {pageCount} pages (
            {PAGE_SIZE} rows/page). A scan walks pages one-by-one until it hits
            the id — each new page is another I/O.
          </p>
          <div className="max-h-56 overflow-auto overscroll-contain rounded-lg border border-gray-200 bg-white sm:max-h-64 dark:border-gray-700 dark:bg-gray-950">
            <table className="w-full min-w-[16rem] text-left text-xs">
              <thead className="sticky top-0 bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Page</th>
                  <th className="px-2 py-1.5 font-medium">id</th>
                  <th className="px-2 py-1.5 font-medium">name</th>
                  <th className="px-2 py-1.5 font-medium">city</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {rows.map((row) => {
                  const touched = scannedSet.has(row.id);
                  const focused = frame?.focusId === row.id;
                  const match =
                    frame?.mode === "scan"
                      ? frame.rowId === row.id
                      : frame?.heapFetched && frame.rowId === row.id;
                  return (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      className={
                        match
                          ? "bg-emerald-100 transition-colors duration-300 dark:bg-emerald-950"
                          : focused
                            ? "btree-row-flash bg-amber-100 dark:bg-amber-900/50"
                            : touched
                              ? "bg-amber-50 transition-colors duration-300 dark:bg-amber-950/40"
                              : "transition-colors duration-300"
                      }
                    >
                      <td className="px-2 py-1 text-gray-500">{row.page}</td>
                      <td className="px-2 py-1 font-mono">{row.id}</td>
                      <td className="px-2 py-1">{row.name}</td>
                      <td className="px-2 py-1">{row.city}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 p-3 sm:p-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Secondary memory index on id
          </h4>
          <p className="mb-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            The B-tree stores keys (and, in a real engine, pointers to heap
            pages). Height stays small, so lookups cost a few node reads.
            Swipe sideways to see the full tree on small screens.
          </p>
          <div
            ref={treeScrollRef}
            className="min-w-0 w-full overflow-x-auto overscroll-x-contain touch-pan-x rounded-lg border border-gray-200 bg-white px-1 py-3 dark:border-gray-700 dark:bg-gray-950"
          >
            <div
              className="mx-auto"
              style={{ width: svgWidth, height: svgHeight, minWidth: svgWidth }}
            >
              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                role="img"
                aria-label="B-tree index on user id"
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
                  const onPath = pathSet.has(node.id);
                  const focused = frame?.focusNodeId === node.id;
                  return (
                    <g
                      key={node.id}
                      className="btree-node"
                      style={{
                        transform: `translate(${node.x}px, ${node.y}px)`,
                      }}
                    >
                      <g className={focused ? "btree-pulse" : undefined}>
                        <rect
                          x={-node.width / 2}
                          y={-LAYOUT.NODE_H / 2}
                          width={node.width}
                          height={LAYOUT.NODE_H}
                          rx={6}
                          className={
                            onPath
                              ? "fill-sky-100 stroke-sky-500 transition-[fill,stroke] duration-300 dark:fill-sky-950 dark:stroke-sky-400"
                              : "fill-white stroke-gray-400 transition-[fill,stroke] duration-300 dark:fill-gray-900 dark:stroke-gray-500"
                          }
                          strokeWidth={onPath ? 2 : 1.25}
                        />
                        {node.keys.map((key, i) => (
                          <text
                            key={`${node.id}-${key}`}
                            x={
                              -node.width / 2 +
                              LAYOUT.KEY_PAD / 2 +
                              i * LAYOUT.KEY_W +
                              LAYOUT.KEY_W / 2
                            }
                            y={1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className={
                              frame?.rowId === key && frame.heapFetched
                                ? "btree-key-pop fill-emerald-700 text-[11px] font-semibold dark:fill-emerald-300"
                                : "fill-gray-800 text-[11px] dark:fill-gray-100"
                            }
                          >
                            {key}
                          </text>
                        ))}
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex w-full flex-col gap-1 text-xs text-gray-600 sm:w-32 dark:text-gray-400">
            Lookup id
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) void runIndex();
              }}
              disabled={busy}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-60 sm:h-9 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => void runScan()}
            >
              Table scan
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => void runIndex()}
            >
              Use B-tree index
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Default 69 sits late in the heap (scan reads many pages). Try 33 for a
          shorter scan, or 11 for a miss. Run both modes on the same id.
        </p>
        {busy && (
          <p
            className="text-xs font-medium text-sky-700 dark:text-sky-300"
            aria-live="polite"
            data-index-animating
          >
            Animating lookup…
          </p>
        )}
      </div>

      <div className="border-t border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Simulated page I/O
            </p>
            <p
              className={`mt-0.5 font-mono text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50 ${
                ioTick ? "btree-io-tick" : ""
              }`}
              data-io-count
            >
              {frame?.pagesRead ?? 0}
              <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
                / {pageCount} heap pages
              </span>
            </p>
          </div>
          {frame && (
            <span className="rounded bg-white px-2 py-1 text-xs ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-700">
              {frame.mode === "scan" ? "table scan" : "index lookup"}
              {frame.mode === "index"
                ? ` · ${frame.nodesVisited} node${frame.nodesVisited === 1 ? "" : "s"}`
                : null}
            </span>
          )}
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={ioMax}
          aria-valuenow={frame?.pagesRead ?? 0}
          aria-label="Simulated page reads"
        >
          <div
            className={`btree-io-bar-fill h-full w-full rounded-full ${
              frame?.mode === "index"
                ? "bg-sky-500 dark:bg-sky-400"
                : "bg-amber-500 dark:bg-amber-400"
            }`}
            style={{ transform: `scaleX(${ioRatio})` }}
          />
        </div>
        <p
          className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300"
          aria-live="polite"
          data-index-status
        >
          {frame?.explanation ??
            "Pick a lookup id, then run Table scan or Use B-tree index to watch each page read."}
        </p>
        {matchedRow && (
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
            Row: {matchedRow.name} · {matchedRow.city} · page {matchedRow.page}
          </p>
        )}
        {comparison && (
          <div
            className="mt-3 space-y-2 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-700"
            data-io-comparison
          >
            {(lastCosts.scanPages != null || lastCosts.indexPages != null) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {lastCosts.scanPages != null && (
                  <span className="rounded bg-amber-50 px-2 py-1 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800">
                    Last scan (id {lastCosts.key}): {lastCosts.scanPages} I/O
                  </span>
                )}
                {lastCosts.indexPages != null && (
                  <span className="rounded bg-sky-50 px-2 py-1 text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-800">
                    Last index (id {lastCosts.key}): {lastCosts.indexPages} I/O
                  </span>
                )}
              </div>
            )}
            <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              {comparison}
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
