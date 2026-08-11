"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createBTree,
  insert,
  layoutTree,
  search,
  LAYOUT,
  type BTreeSnapshot,
} from "@/lib/btree/btree";

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

type LookupResult = {
  mode: "scan" | "index";
  key: number;
  row: Row | null;
  pagesRead: number;
  nodesVisited: number;
  pathNodeIds: string[];
  scannedIds: number[];
  explanation: string;
};

export function BTreeIndexDemo() {
  const [{ rows, index, pageCount }] = useState(buildDataset);
  // Prefer a leaf key so the demo shows a multi-level index walk (36 lives in the root).
  const [query, setQuery] = useState("33");
  const [result, setResult] = useState<LookupResult | null>(null);

  const layout = useMemo(() => layoutTree(index.root), [index]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  function runScan() {
    const key = Number(query);
    if (!Number.isFinite(key)) {
      setResult(null);
      return;
    }

    const scannedIds: number[] = [];
    let pagesRead = 0;
    let lastPage = -1;
    let row: Row | null = null;

    for (const candidate of rows) {
      if (candidate.page !== lastPage) {
        pagesRead += 1;
        lastPage = candidate.page;
      }
      scannedIds.push(candidate.id);
      if (candidate.id === key) {
        row = candidate;
        break;
      }
    }

    setResult({
      mode: "scan",
      key,
      row,
      pagesRead,
      nodesVisited: 0,
      pathNodeIds: [],
      scannedIds,
      explanation: row
        ? `Table scan found id ${key} after reading ${pagesRead} heap page(s) (out of ${pageCount}).`
        : `Table scan read all ${pagesRead} heap page(s) and did not find id ${key}.`,
    });
  }

  function runIndex() {
    const key = Number(query);
    if (!Number.isFinite(key)) {
      setResult(null);
      return;
    }

    const path = search(index.root, key);
    const row = byId.get(key) ?? null;
    // Index lookup cost: one "page" per B-tree node visited + one heap page if found
    const indexPages = path.steps.length;
    const heapPages = row ? 1 : 0;

    setResult({
      mode: "index",
      key,
      row,
      pagesRead: indexPages + heapPages,
      nodesVisited: path.steps.length,
      pathNodeIds: path.steps.map((s) => s.nodeId),
      scannedIds: [],
      explanation: row
        ? `Index walk visited ${indexPages} B-tree node(s), then fetched heap page ${row.page}. Total I/O: ${indexPages + heapPages}.`
        : `Index walk visited ${indexPages} B-tree node(s) and confirmed the key is absent — no heap fetch.`,
    });
  }

  const pathSet = new Set(result?.pathNodeIds ?? []);
  const scannedSet = new Set(result?.scannedIds ?? []);
  const svgWidth = Math.max(layout.width, 280);
  const svgHeight = Math.max(layout.height, 100);

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
      <figcaption className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
        Interactive index — table scan vs B-tree lookup (simulated page I/O)
      </figcaption>

      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-gray-200 p-4 md:border-b-0 md:border-r dark:border-gray-700">
          <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Heap table (users)
          </h4>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Rows are stored in insertion order across {pageCount} pages (
            {PAGE_SIZE} rows/page). A scan must walk pages until it hits the id.
          </p>
          <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Page</th>
                  <th className="px-2 py-1.5 font-medium">id</th>
                  <th className="px-2 py-1.5 font-medium">name</th>
                  <th className="px-2 py-1.5 font-medium">city</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const touched = scannedSet.has(row.id);
                  const match = result?.row?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={
                        match
                          ? "bg-emerald-100 dark:bg-emerald-950"
                          : touched
                            ? "bg-amber-50 dark:bg-amber-950/40"
                            : undefined
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

        <div className="p-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Secondary memory index on id
          </h4>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            The B-tree stores keys (and, in a real engine, pointers to heap
            pages). Height stays small, so lookups cost a few node reads.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white px-1 py-3 dark:border-gray-700 dark:bg-gray-950">
            <svg
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              role="img"
              aria-label="B-tree index on user id"
              className="mx-auto block"
            >
              {layout.edges.map((edge) => (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={edge.fromX}
                  y1={edge.fromY}
                  x2={edge.toX}
                  y2={edge.toY}
                  className="stroke-gray-400 dark:stroke-gray-500"
                  strokeWidth={1.5}
                />
              ))}
              {layout.nodes.map((node) => {
                const x = node.x - node.width / 2;
                const y = node.y - LAYOUT.NODE_H / 2;
                const onPath = pathSet.has(node.id);
                return (
                  <g key={node.id}>
                    <rect
                      x={x}
                      y={y}
                      width={node.width}
                      height={LAYOUT.NODE_H}
                      rx={6}
                      className={
                        onPath
                          ? "fill-sky-100 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-400"
                          : "fill-white stroke-gray-400 dark:fill-gray-900 dark:stroke-gray-500"
                      }
                      strokeWidth={onPath ? 2 : 1.25}
                    />
                    {node.keys.map((key, i) => (
                      <text
                        key={`${node.id}-${key}`}
                        x={
                          x +
                          LAYOUT.KEY_PAD / 2 +
                          i * LAYOUT.KEY_W +
                          LAYOUT.KEY_W / 2
                        }
                        y={node.y + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-800 text-[11px] dark:fill-gray-100"
                      >
                        {key}
                      </text>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        <label className="flex w-32 flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          Lookup id
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runIndex();
            }}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <Button type="button" size="sm" variant="secondary" onClick={runScan}>
          Table scan
        </Button>
        <Button type="button" size="sm" onClick={runIndex}>
          Use B-tree index
        </Button>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          Try 33 (exists) or 11 (missing)
        </span>
      </div>

      {result && (
        <div className="border-t border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
          <div className="mb-2 flex flex-wrap gap-3 text-xs">
            <span className="rounded bg-white px-2 py-1 ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-700">
              Mode: {result.mode === "scan" ? "table scan" : "index lookup"}
            </span>
            <span className="rounded bg-white px-2 py-1 ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-700">
              Simulated I/O: {result.pagesRead} page read
              {result.pagesRead === 1 ? "" : "s"}
            </span>
            {result.mode === "index" && (
              <span className="rounded bg-white px-2 py-1 ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-700">
                Nodes visited: {result.nodesVisited}
              </span>
            )}
            {result.row && (
              <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800">
                Row: {result.row.name} · {result.row.city} · page {result.row.page}
              </span>
            )}
          </div>
          <p className="text-gray-700 dark:text-gray-300">{result.explanation}</p>
        </div>
      )}
    </figure>
  );
}
