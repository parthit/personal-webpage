/**
 * Pure helpers that build timed demo frames for the B-tree blog playgrounds.
 * Keeping this logic out of React makes the walkthroughs unit-testable.
 */

import type { SearchStep } from "./btree";

/** Default pacing for the index I/O demo (many frames on a table scan). */
export const DEMO_STEP_MS = 320;
export const DEMO_HOLD_MS = 600;

/**
 * Slower pacing for the interactive B-tree CRUD visualizer.
 * Paths are short (2–3 nodes), so each step needs a long dwell to be readable.
 */
export const VIZ_STEP_MS = 1500;
export const VIZ_HOLD_MS = 2200;

export type VizAccent = {
  key: number;
  kind: "insert" | "delete" | "found" | "miss";
};

export type VizFrame = {
  /** Search path revealed so far (cumulative). */
  highlight: SearchStep[];
  accent: VizAccent | null;
  message: string;
  /** When true, the caller should apply the pending tree mutation after this frame. */
  commitMutation?: boolean;
  /**
   * After a mutating commit, re-run search for this key and replace `highlight`
   * with the post-mutation path (splits/merges can move the key to a new node).
   */
  relocateAfterCommit?: number;
};

export type ScanRow = {
  id: number;
  page: number;
};

export type IndexDemoFrame = {
  mode: "scan" | "index";
  key: number;
  scannedIds: number[];
  /** Id currently under the cursor (scan only). */
  focusId: number | null;
  pathNodeIds: string[];
  /** Node currently being read (index only). */
  focusNodeId: string | null;
  pagesRead: number;
  nodesVisited: number;
  heapFetched: boolean;
  rowId: number | null;
  explanation: string;
  done: boolean;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Prefer instant playback when the user asks for reduced motion. */
export function effectiveStepMs(
  prefersReducedMotion: boolean,
  stepMs = DEMO_STEP_MS
): number {
  return prefersReducedMotion ? 0 : stepMs;
}

export function buildSearchFrames(
  key: number,
  steps: SearchStep[],
  found: boolean
): VizFrame[] {
  const frames: VizFrame[] = [
    {
      highlight: [],
      accent: null,
      message: `Searching for ${key} — start at the root.`,
    },
  ];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const highlight = steps.slice(0, i + 1);
    const depth = i + 1;
    const isLast = i === steps.length - 1;

    if (step.found) {
      frames.push({
        highlight,
        accent: null,
        message: `Node ${depth}: scan its keys…`,
      });
      frames.push({
        highlight,
        accent: { key, kind: "found" },
        message: `Found ${key} in node ${depth} of the path.`,
      });
    } else if (isLast && !found) {
      frames.push({
        highlight,
        accent: null,
        message: `Node ${depth}: ${key} is not among its keys.`,
      });
      frames.push({
        highlight,
        accent: { key, kind: "miss" },
        message: `${key} not found — searched ${steps.length} node${steps.length === 1 ? "" : "s"} down to a leaf.`,
      });
    } else {
      frames.push({
        highlight,
        accent: null,
        message: `Node ${depth}: ${key} is not here — follow the child whose range covers it.`,
      });
    }
  }

  if (steps.length === 0) {
    frames.push({
      highlight: [],
      accent: { key, kind: "miss" },
      message: `Tree is empty — ${key} not found.`,
    });
  }

  return frames;
}

export function buildInsertFrames(
  key: number,
  steps: SearchStep[],
  willInsert: boolean
): VizFrame[] {
  const frames: VizFrame[] = [
    {
      highlight: [],
      accent: null,
      message: willInsert
        ? `Insert ${key}: walk root → leaf to find the insertion spot.`
        : `Insert ${key}: first check whether it already exists.`,
    },
  ];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const highlight = steps.slice(0, i + 1);
    const depth = i + 1;
    const isLast = i === steps.length - 1;

    if (step.found) {
      frames.push({
        highlight,
        accent: { key, kind: "found" },
        message: `${key} already present in node ${depth} — duplicates are ignored.`,
      });
      return frames;
    }

    if (isLast) {
      frames.push({
        highlight,
        accent: null,
        message: `Node ${depth}: arrived at the leaf that should hold ${key}.`,
      });
    } else {
      frames.push({
        highlight,
        accent: null,
        message: `Node ${depth}: ${key} is not in this node — descend toward the matching child.`,
      });
    }
  }

  if (willInsert) {
    if (steps.length === 0) {
      frames.push({
        highlight: [],
        accent: { key, kind: "insert" },
        message: `Tree was empty — ${key} becomes the new root.`,
        commitMutation: true,
        relocateAfterCommit: key,
      });
      frames.push({
        highlight: [],
        accent: { key, kind: "insert" },
        message: `Inserted ${key} as the root.`,
        relocateAfterCommit: key,
      });
    } else {
      // Pause on the target leaf before mutating so the destination is obvious.
      frames.push({
        highlight: steps,
        accent: null,
        message: `Ready to insert ${key} into that leaf (a full ancestor may split first).`,
      });
      frames.push({
        highlight: steps,
        accent: { key, kind: "insert" },
        message: `Placing ${key} now…`,
        commitMutation: true,
        relocateAfterCommit: key,
      });
      frames.push({
        highlight: steps,
        accent: { key, kind: "insert" },
        message: `Inserted ${key}. Highlight shows its home after any splits.`,
        relocateAfterCommit: key,
      });
    }
  }

  return frames;
}

export function buildDeleteFrames(
  key: number,
  steps: SearchStep[],
  willDelete: boolean
): VizFrame[] {
  const frames: VizFrame[] = [
    {
      highlight: [],
      accent: null,
      message: `Delete ${key}: locate it with the same root → leaf walk as search.`,
    },
  ];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const highlight = steps.slice(0, i + 1);
    const depth = i + 1;
    const isLast = i === steps.length - 1;

    if (step.found) {
      frames.push({
        highlight,
        accent: null,
        message: `Node ${depth}: found ${key} — pause before removing it.`,
      });
      frames.push({
        highlight,
        accent: { key, kind: "delete" },
        message: `Marking ${key} for deletion.`,
      });
      frames.push({
        highlight,
        accent: { key, kind: "delete" },
        message: `Removing ${key} (borrow/merge may rebalance the path).`,
        commitMutation: true,
      });
      frames.push({
        highlight: [],
        accent: null,
        message: `Deleted ${key}. Tree may be shorter or reshaped after rebalancing.`,
      });
      return frames;
    }

    frames.push({
      highlight,
      accent: null,
      message: isLast
        ? `${key} not found after ${depth} node${depth === 1 ? "" : "s"} — nothing to delete.`
        : `Node ${depth}: ${key} not here — keep descending.`,
    });
  }

  if (!willDelete && steps.length === 0) {
    frames.push({
      highlight: [],
      accent: { key, kind: "miss" },
      message: `Tree is empty — nothing to delete.`,
    });
  }

  return frames;
}

export function buildTableScanFrames(
  key: number,
  rows: ScanRow[],
  pageCount: number
): IndexDemoFrame[] {
  const frames: IndexDemoFrame[] = [
    {
      mode: "scan",
      key,
      scannedIds: [],
      focusId: null,
      pathNodeIds: [],
      focusNodeId: null,
      pagesRead: 0,
      nodesVisited: 0,
      heapFetched: false,
      rowId: null,
      explanation: `Table scan for id ${key}: read heap pages in order until we hit a match.`,
      done: false,
    },
  ];

  let pagesRead = 0;
  let lastPage = -1;
  const scannedIds: number[] = [];
  let found = false;

  for (const row of rows) {
    if (row.page !== lastPage) {
      pagesRead += 1;
      lastPage = row.page;
    }
    scannedIds.push(row.id);
    const match = row.id === key;
    if (match) found = true;

    frames.push({
      mode: "scan",
      key,
      scannedIds: [...scannedIds],
      focusId: row.id,
      pathNodeIds: [],
      focusNodeId: null,
      pagesRead,
      nodesVisited: 0,
      heapFetched: false,
      rowId: match ? row.id : null,
      explanation: match
        ? `Page ${row.page}: found id ${key}. Stop after ${pagesRead} heap page read${pagesRead === 1 ? "" : "s"}.`
        : `Page ${row.page}: check id ${row.id} — not ${key}. Heap pages read so far: ${pagesRead}.`,
      done: false,
    });

    if (match) break;
  }

  frames.push({
    mode: "scan",
    key,
    scannedIds: [...scannedIds],
    focusId: found ? key : null,
    pathNodeIds: [],
    focusNodeId: null,
    pagesRead,
    nodesVisited: 0,
    heapFetched: false,
    rowId: found ? key : null,
    explanation: found
      ? `Scan finished: ${pagesRead} page I/O for one row (of ${pageCount} pages). Linear in how far the key sits.`
      : `Scan finished: read all ${pagesRead} heap page${pagesRead === 1 ? "" : "s"} — id ${key} is missing.`,
    done: true,
  });

  return frames;
}

export function buildIndexLookupFrames(
  key: number,
  steps: SearchStep[],
  heapPage: number | null
): IndexDemoFrame[] {
  const frames: IndexDemoFrame[] = [
    {
      mode: "index",
      key,
      scannedIds: [],
      focusId: null,
      pathNodeIds: [],
      focusNodeId: null,
      pagesRead: 0,
      nodesVisited: 0,
      heapFetched: false,
      rowId: null,
      explanation: `B-tree index lookup for id ${key}: follow a short root-to-leaf path.`,
      done: false,
    },
  ];

  const pathNodeIds: string[] = [];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    pathNodeIds.push(step.nodeId);
    const nodesVisited = pathNodeIds.length;
    const isLast = i === steps.length - 1;
    let explanation: string;
    if (step.found) {
      explanation = `Index node ${nodesVisited}: key ${key} found. Next, fetch its heap page.`;
    } else if (isLast) {
      explanation = `Read index node ${nodesVisited} (1 page I/O). Key ${key} is absent from this leaf — stop; no further descent.`;
    } else {
      explanation = `Read index node ${nodesVisited} (1 page I/O). Narrow the range and descend.`;
    }
    frames.push({
      mode: "index",
      key,
      scannedIds: [],
      focusId: null,
      pathNodeIds: [...pathNodeIds],
      focusNodeId: step.nodeId,
      pagesRead: nodesVisited,
      nodesVisited,
      heapFetched: false,
      rowId: null,
      explanation,
      done: false,
    });
  }

  if (heapPage != null) {
    frames.push({
      mode: "index",
      key,
      scannedIds: [],
      focusId: null,
      pathNodeIds: [...pathNodeIds],
      focusNodeId: pathNodeIds[pathNodeIds.length - 1] ?? null,
      pagesRead: pathNodeIds.length + 1,
      nodesVisited: pathNodeIds.length,
      heapFetched: true,
      rowId: key,
      explanation: `Fetch heap page ${heapPage} (1 more I/O). Total: ${pathNodeIds.length + 1} page reads — height-bounded, not table-sized.`,
      done: true,
    });
  } else {
    frames.push({
      mode: "index",
      key,
      scannedIds: [],
      focusId: null,
      pathNodeIds: [...pathNodeIds],
      focusNodeId: pathNodeIds[pathNodeIds.length - 1] ?? null,
      pagesRead: pathNodeIds.length,
      nodesVisited: pathNodeIds.length,
      heapFetched: false,
      rowId: null,
      explanation: `Key absent after ${pathNodeIds.length} index node read${pathNodeIds.length === 1 ? "" : "s"} — no heap fetch needed.`,
      done: true,
    });
  }

  return frames;
}

export function compareIoCost(scanPages: number, indexPages: number): string {
  if (scanPages <= 0 && indexPages <= 0) {
    return "Run both lookups to compare simulated I/O.";
  }
  if (scanPages <= 0) {
    return `Index used ${indexPages} page read${indexPages === 1 ? "" : "s"}. Run a table scan on the same id to compare.`;
  }
  if (indexPages <= 0) {
    return `Scan used ${scanPages} page read${scanPages === 1 ? "" : "s"}. Run the B-tree index on the same id to compare.`;
  }
  if (indexPages < scanPages) {
    const ratio = (scanPages / indexPages).toFixed(1);
    return `Same id: scan ${scanPages} I/O vs index ${indexPages} I/O — about ${ratio}× fewer page reads with the B-tree.`;
  }
  if (indexPages === scanPages) {
    return `Same id: both paths used ${scanPages} page read${scanPages === 1 ? "" : "s"} on this tiny table — the index stays near tree height while a scan grows with the heap.`;
  }
  return `Same id: scan ${scanPages} I/O vs index ${indexPages} I/O. On this toy heap the key was early, so the scan looked cheap — try a late id like 69 or 72 to see the index win, and remember real tables have millions of pages.`;
}

/**
 * Play frames sequentially. Calls `onFrame` for each frame, waiting `stepMs`
 * between frames (and `holdMs` after the last). Aborts cleanly via signal.
 */
export async function playFrames<T>(
  frames: T[],
  onFrame: (frame: T, index: number) => void | Promise<void>,
  options: {
    stepMs?: number;
    holdMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<void> {
  const stepMs = options.stepMs ?? DEMO_STEP_MS;
  const holdMs = options.holdMs ?? DEMO_HOLD_MS;
  const { signal } = options;

  for (let i = 0; i < frames.length; i += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    await onFrame(frames[i], i);
    const delay = i === frames.length - 1 ? holdMs : stepMs;
    await sleep(delay, signal);
  }
}
