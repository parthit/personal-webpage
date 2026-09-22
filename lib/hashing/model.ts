/**
 * A small, deterministic consistent-hashing model for the blog playground.
 * Positions live on a 360-slot ring so the figure can be an actual circle.
 */

export const RING_SIZE = 360;

export type PlacementMode = "modulo" | "ring";

export type NodeSpec = {
  id: string;
  label: string;
  color: "sky" | "amber" | "emerald" | "violet" | "rose";
};

export const NODE_CATALOG: NodeSpec[] = [
  { id: "nyc", label: "NYC", color: "sky" },
  { id: "lon", label: "LON", color: "amber" },
  { id: "syd", label: "SYD", color: "emerald" },
  { id: "sfo", label: "SFO", color: "violet" },
  { id: "bom", label: "BOM", color: "rose" },
];

export const DEFAULT_NODE_IDS = ["nyc", "lon", "syd"] as const;
export const DEFAULT_VNODES = 3;
export const MIN_NODES = 2;
export const MAX_VNODES = 8;

export const KEY_IDS = [
  "cart",
  "user",
  "session",
  "invoice",
  "cache",
  "feed",
  "auth",
  "search",
  "email",
  "order",
  "image",
  "video",
] as const;

/**
 * Keys sit in a few arcs that SFO will steal and on stable stretches of the
 * ring. That makes “add a node” visible without relying on an unlucky hash.
 */
export const KEY_POSITIONS: Record<(typeof KEY_IDS)[number], number> = {
  cart: 28,
  user: 188,
  session: 308,
  invoice: 5,
  cache: 120,
  feed: 240,
  auth: 350,
  search: 250,
  email: 48,
  order: 168,
  image: 280,
  video: 82,
};

/**
 * Stable vnode positions, spread across the whole circle. Keeping positions
 * stable means adding a physical node only inserts its own tokens. Each later
 * vnode fills another gap, so the 1-vnode view stays intentionally lumpy while
 * the default 3-vnode view is balanced and readable.
 */
const TOKEN_POSITIONS: Record<string, number[]> = {
  nyc: [20, 140, 260, 80, 200, 320, 50, 230],
  lon: [60, 180, 300, 120, 240, 0, 90, 270],
  syd: [100, 220, 340, 160, 280, 40, 130, 310],
  sfo: [35, 195, 315, 95, 215, 335, 65, 245],
  bom: [75, 255, 135, 15, 175, 295, 105, 225],
};

export type HashToken = {
  id: string;
  nodeId: string;
  vnode: number;
  position: number;
};

export type HashKey = {
  id: string;
  position: number;
};

export type RemapReport = {
  moved: string[];
  stayed: string[];
  movedCount: number;
  total: number;
};

export type HashWalk = {
  from: number;
  to: number;
  tokenId: string;
  /** The walker has already arrived; do not replay the arc. */
  settled?: boolean;
};

export type HashSnapshot = {
  mode: PlacementMode;
  nodeIds: string[];
  vnodes: number;
  keys: HashKey[];
  tokens: HashToken[];
  assignment: Record<string, string>;
  highlightKeyIds: string[];
  highlightNodeIds: string[];
  highlightTokenIds: string[];
  movedKeyIds: string[];
  walk: HashWalk | null;
  lookupKeyId: string | null;
  movedCount: number | null;
  moduloWouldMove: number | null;
  message: string;
};

/** FNV-1a 32-bit. Stable across Node and the browser, no crypto subtle. */
export function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function ringPosition(input: string, ringSize = RING_SIZE): number {
  return fnv1a(input) % ringSize;
}

export function nodeSpec(id: string): NodeSpec {
  const found = NODE_CATALOG.find((node) => node.id === id);
  if (!found) {
    throw new Error(`Unknown hash-ring node "${id}"`);
  }
  return found;
}

export function nextNodeId(currentIds: string[]): string | null {
  return NODE_CATALOG.find((node) => !currentIds.includes(node.id))?.id ?? null;
}

export function tokenId(nodeId: string, vnode: number): string {
  return `${nodeId}#${vnode}`;
}

export function tokenPosition(nodeId: string, vnode: number): number {
  return TOKEN_POSITIONS[nodeId]?.[vnode] ?? ringPosition(`${nodeId}:${vnode}`);
}

export function keyPosition(keyId: string): number {
  if (Object.hasOwn(KEY_POSITIONS, keyId)) {
    return KEY_POSITIONS[keyId as (typeof KEY_IDS)[number]];
  }
  return ringPosition(keyId);
}

export function tokensFor(nodeIds: string[], vnodes: number): HashToken[] {
  const replicas = Math.max(1, Math.min(MAX_VNODES, vnodes));
  const tokens: HashToken[] = [];
  for (const id of nodeIds) {
    for (let vnode = 0; vnode < replicas; vnode += 1) {
      tokens.push({
        id: tokenId(id, vnode),
        nodeId: id,
        vnode,
        position: tokenPosition(id, vnode),
      });
    }
  }
  return tokens.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function keysFor(keyIds: readonly string[] = KEY_IDS): HashKey[] {
  return keyIds.map((id) => ({ id, position: keyPosition(id) }));
}

/** Clockwise distance on the ring, 0 when the points coincide. */
export function clockwiseDelta(
  from: number,
  to: number,
  ringSize = RING_SIZE
): number {
  return (to - from + ringSize) % ringSize;
}

export function interpolateClockwise(
  from: number,
  to: number,
  progress: number,
  ringSize = RING_SIZE
): number {
  const clamped = Math.min(1, Math.max(0, progress));
  const delta = clockwiseDelta(from, to, ringSize);
  return (from + delta * clamped) % ringSize;
}

/**
 * First token at or after `position`, wrapping to the lowest token.
 * Ties at the same slot prefer the token that sorts first after position.
 */
export function successorToken(
  position: number,
  tokens: HashToken[]
): HashToken | null {
  if (tokens.length === 0) return null;
  const ordered = [...tokens].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id)
  );
  const atOrAfter = ordered.find((token) => token.position >= position);
  return atOrAfter ?? ordered[0];
}

export function ringOwner(position: number, tokens: HashToken[]): string | null {
  return successorToken(position, tokens)?.nodeId ?? null;
}

export function moduloOwner(keyId: string, nodeIds: string[]): string | null {
  if (nodeIds.length === 0) return null;
  return nodeIds[fnv1a(keyId) % nodeIds.length];
}

export function assignKeys(
  keys: HashKey[],
  nodeIds: string[],
  tokens: HashToken[],
  mode: PlacementMode
): Record<string, string> {
  const assignment: Record<string, string> = {};
  for (const key of keys) {
    const owner =
      mode === "modulo"
        ? moduloOwner(key.id, nodeIds)
        : ringOwner(key.position, tokens);
    if (owner) assignment[key.id] = owner;
  }
  return assignment;
}

export function remapReport(
  before: Record<string, string>,
  after: Record<string, string>
): RemapReport {
  const moved: string[] = [];
  const stayed: string[] = [];
  const ids = Object.keys(before);
  for (const id of ids) {
    if (before[id] !== after[id]) moved.push(id);
    else stayed.push(id);
  }
  return { moved, stayed, movedCount: moved.length, total: ids.length };
}

export function loadCounts(
  assignment: Record<string, string>,
  nodeIds: string[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of nodeIds) counts[id] = 0;
  for (const owner of Object.values(assignment)) {
    counts[owner] = (counts[owner] ?? 0) + 1;
  }
  return counts;
}

export function maxLoadSkew(counts: Record<string, number>): number {
  const values = Object.values(counts);
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}
