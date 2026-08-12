/**
 * Pure helpers that build timed demo frames for the B-tree blog playgrounds.
 * Keeping this logic out of React makes the walkthroughs unit-testable.
 */

import type { SearchStep } from "./btree";

export const DEMO_STEP_MS = 380;
export const DEMO_HOLD_MS = 520;

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
    if (step.found) {
      frames.push({
        highlight,
        accent: { key, kind: "found" },
        message: `Found ${key} in node ${depth} of the path.`,
      });
    } else if (i === steps.length - 1 && !found) {
      frames.push({
        highlight,
        accent: { key, kind: "miss" },
        message: `${key} not in this node — path exhausted (${steps.length} node${steps.length === 1 ? "" : "s"}).`,
      });
    } else {
      frames.push({
        highlight,
        accent: null,
        message: `Visit node ${depth}: compare against its keys, then follow the matching child.`,
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
        ? `Insert ${key}: walk down to the leaf that should hold it.`
        : `Insert ${key}: checking whether it already exists.`,
    },
  ];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const highlight = steps.slice(0, i + 1);
    const depth = i + 1;
    if (step.found) {
      frames.push({
        highlight,
        accent: { key, kind: "miss" },
        message: `${key} already present — duplicates are ignored.`,
      });
      return frames;
    }
    frames.push({
      highlight,
      accent: null,
      message:
        i === steps.length - 1
          ? `Reached the target leaf (node ${depth} on the path).`
          : `Descending via node ${depth}…`,
    });
  }

  if (willInsert) {
    frames.push({
      highlight: steps,
      accent: { key, kind: "insert" },
      message: `Placing ${key} into the leaf (splits may reshape ancestors).`,
      commitMutation: true,
    });
  } else if (steps.length === 0) {
    frames.push({
      highlight: [],
      accent: { key, kind: "insert" },
      message: `Tree was empty — ${key} becomes the new root.`,
      commitMutation: true,
    });
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
      message: `Delete ${key}: locate it first.`,
    },
  ];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const highlight = steps.slice(0, i + 1);
    const depth = i + 1;
    if (step.found) {
      frames.push({
        highlight,
        accent: { key, kind: "delete" },
        message: `Found ${key} — mark it for removal.`,
      });
      frames.push({
        highlight,
        accent: { key, kind: "delete" },
        message: `Removing ${key} (borrow/merge may rebalance).`,
        commitMutation: true,
      });
      return frames;
    }
    frames.push({
      highlight,
      accent: null,
      message:
        i === steps.length - 1
          ? `${key} not found after ${depth} node${depth === 1 ? "" : "s"} — nothing to delete.`
          : `Checking node ${depth}…`,
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
      explanation: step.found
        ? `Index node ${nodesVisited}: key ${key} found. Next, fetch its heap page.`
        : `Read index node ${nodesVisited} (1 page I/O). Narrow the range and descend.`,
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
