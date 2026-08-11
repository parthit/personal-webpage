"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  clear,
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

const SAMPLE = [10, 20, 5, 6, 12, 30, 7, 17, 3];

function parseKeys(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

export function BTreeVisualizer() {
  const [tree, setTree] = useState<BTreeSnapshot>(() => {
    let t = createBTree(2);
    for (const key of SAMPLE) t = insert(t, key);
    return t;
  });
  const [input, setInput] = useState("");
  const [message, setMessage] = useState(
    "Try insert, search, or delete. Default minimum degree t = 2 (max 3 keys/node)."
  );
  const [highlight, setHighlight] = useState<SearchStep[]>([]);
  const [degree, setDegree] = useState(2);

  const layout = useMemo(() => layoutTree(tree.root), [tree]);

  const highlightedIds = new Set(highlight.map((s) => s.nodeId));
  const foundStep = highlight.find((s) => s.found);

  function runInsert() {
    const keys = parseKeys(input);
    if (keys.length === 0) {
      setMessage("Enter one or more numbers to insert.");
      return;
    }
    let next = tree;
    const added: number[] = [];
    for (const key of keys) {
      const before = next.size;
      next = insert(next, key);
      if (next.size > before) added.push(key);
    }
    setTree(next);
    setHighlight([]);
    setMessage(
      added.length
        ? `Inserted ${added.join(", ")}. Size ${next.size}, height ${next.height}.`
        : "No new keys inserted (duplicates are ignored)."
    );
    setInput("");
  }

  function runSearch() {
    const keys = parseKeys(input);
    if (keys.length !== 1) {
      setMessage("Enter a single number to search.");
      return;
    }
    const result = search(tree.root, keys[0]);
    setHighlight(result.steps);
    setMessage(
      result.found
        ? `Found ${keys[0]} after visiting ${result.steps.length} node(s).`
        : `${keys[0]} not found. Path length ${result.steps.length}.`
    );
  }

  function runDelete() {
    const keys = parseKeys(input);
    if (keys.length === 0) {
      setMessage("Enter one or more numbers to delete.");
      return;
    }
    let next = tree;
    const removed: number[] = [];
    for (const key of keys) {
      const before = next.size;
      next = remove(next, key);
      if (next.size < before) removed.push(key);
    }
    setTree(next);
    setHighlight([]);
    setMessage(
      removed.length
        ? `Deleted ${removed.join(", ")}. Size ${next.size}, height ${next.height}.`
        : "No matching keys to delete."
    );
    setInput("");
  }

  function runClear() {
    setTree(clear(tree));
    setHighlight([]);
    setMessage("Tree cleared.");
  }

  function loadSample() {
    let next = createBTree(degree);
    for (const key of SAMPLE) next = insert(next, key);
    setTree(next);
    setHighlight([]);
    setMessage(`Loaded sample keys: ${SAMPLE.join(", ")}.`);
  }

  function changeDegree(nextDegree: number) {
    setDegree(nextDegree);
    setTree((prev) => withDegree(prev, nextDegree));
    setHighlight([]);
    setMessage(
      `Minimum degree t = ${nextDegree} (max ${2 * nextDegree - 1} keys per node).`
    );
  }

  const svgWidth = Math.max(layout.width, 320);
  const svgHeight = Math.max(layout.height, 120);

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
      <figcaption className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
        Interactive B-tree — insert, search, delete, and change order
      </figcaption>

      <div className="flex flex-wrap items-end gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          Key(s)
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runInsert();
            }}
            placeholder="e.g. 15 or 1, 8, 22"
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <Button type="button" size="sm" onClick={runInsert}>
          Insert
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={runSearch}>
          Search
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={runDelete}>
          Delete
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={runClear}>
          Clear
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={loadSample}>
          Sample
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
        <span className="text-gray-600 dark:text-gray-400">Min degree t</span>
        {[2, 3, 4].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => changeDegree(t)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              degree === t
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-800"
            }`}
          >
            t = {t}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          size {tree.size} · height {tree.height} · max keys/node {2 * degree - 1}
        </span>
      </div>

      <div className="overflow-x-auto px-2 py-4">
        {tree.root ? (
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            role="img"
            aria-label="B-tree visualization"
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
              const isOnPath = highlightedIds.has(node.id);
              const foundIdx =
                foundStep && foundStep.nodeId === node.id
                  ? foundStep.keyIndex
                  : null;

              return (
                <g key={node.id}>
                  <rect
                    x={x}
                    y={y}
                    width={node.width}
                    height={LAYOUT.NODE_H}
                    rx={6}
                    className={
                      isOnPath
                        ? "fill-amber-100 stroke-amber-500 dark:fill-amber-950 dark:stroke-amber-400"
                        : "fill-white stroke-gray-400 dark:fill-gray-950 dark:stroke-gray-500"
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
                          className={
                            isFound
                              ? "fill-amber-800 text-[12px] font-semibold dark:fill-amber-200"
                              : "fill-gray-800 text-[12px] dark:fill-gray-100"
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
        ) : (
          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Empty tree — insert a key or load the sample.
          </p>
        )}
      </div>

      <p className="border-t border-gray-200 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
        {message}
      </p>
    </figure>
  );
}
