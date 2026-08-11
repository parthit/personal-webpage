/**
 * Educational B-tree (CLRS-style) with minimum degree `t`.
 * - Every node has at most 2t − 1 keys
 * - Every non-root node has at least t − 1 keys
 * - An internal node with k keys has k + 1 children
 */

export type BTreeNode = {
  id: string;
  keys: number[];
  children: BTreeNode[];
  leaf: boolean;
};

export type SearchStep = {
  nodeId: string;
  keyIndex: number | null;
  found: boolean;
};

export type BTreeSnapshot = {
  root: BTreeNode | null;
  t: number;
  height: number;
  size: number;
};

let nextId = 1;

function createNode(leaf: boolean): BTreeNode {
  return {
    id: `n${nextId++}`,
    keys: [],
    children: [],
    leaf,
  };
}

export function resetBTreeIds(start = 1) {
  nextId = start;
}

export function createBTree(t = 2): BTreeSnapshot {
  if (t < 2) throw new Error("Minimum degree t must be >= 2");
  // Do not reset the module id counter here — multiple demos can coexist on one page.
  return { root: null, t, height: 0, size: 0 };
}

export function cloneTree(node: BTreeNode | null): BTreeNode | null {
  if (!node) return null;
  return {
    id: node.id,
    keys: [...node.keys],
    leaf: node.leaf,
    children: node.children.map((child) => cloneTree(child)!),
  };
}

function heightOf(node: BTreeNode | null): number {
  if (!node) return 0;
  let h = 1;
  let cur = node;
  while (!cur.leaf && cur.children.length > 0) {
    cur = cur.children[0];
    h += 1;
  }
  return h;
}

function countKeys(node: BTreeNode | null): number {
  if (!node) return 0;
  return (
    node.keys.length +
    node.children.reduce((sum, child) => sum + countKeys(child), 0)
  );
}

function refresh(tree: BTreeSnapshot): BTreeSnapshot {
  return {
    ...tree,
    height: heightOf(tree.root),
    size: countKeys(tree.root),
  };
}

export function search(
  node: BTreeNode | null,
  key: number,
  steps: SearchStep[] = []
): { found: boolean; steps: SearchStep[] } {
  if (!node) return { found: false, steps };

  let i = 0;
  while (i < node.keys.length && key > node.keys[i]) i += 1;

  if (i < node.keys.length && key === node.keys[i]) {
    steps.push({ nodeId: node.id, keyIndex: i, found: true });
    return { found: true, steps };
  }

  steps.push({ nodeId: node.id, keyIndex: null, found: false });
  if (node.leaf) return { found: false, steps };
  return search(node.children[i], key, steps);
}

function splitChild(parent: BTreeNode, index: number, t: number) {
  const full = parent.children[index];
  const right = createNode(full.leaf);
  const mid = t - 1;

  right.keys = full.keys.splice(mid + 1);
  const promoted = full.keys.pop()!;

  if (!full.leaf) {
    right.children = full.children.splice(mid + 1);
  }

  parent.children.splice(index + 1, 0, right);
  parent.keys.splice(index, 0, promoted);
}

function insertNonFull(node: BTreeNode, key: number, t: number) {
  let i = node.keys.length - 1;

  if (node.leaf) {
    while (i >= 0 && key < node.keys[i]) i -= 1;
    // Reject duplicates
    if (i >= 0 && node.keys[i] === key) return false;
    if (i + 1 < node.keys.length && node.keys[i + 1] === key) return false;
    node.keys.splice(i + 1, 0, key);
    return true;
  }

  while (i >= 0 && key < node.keys[i]) i -= 1;
  i += 1;

  if (i > 0 && node.keys[i - 1] === key) return false;

  if (node.children[i].keys.length === 2 * t - 1) {
    // Check if key already exists in the full child before splitting
    const childSearch = search(node.children[i], key);
    if (childSearch.found) return false;

    splitChild(node, i, t);
    if (key === node.keys[i]) return false;
    if (key > node.keys[i]) i += 1;
  }

  return insertNonFull(node.children[i], key, t);
}

export function insert(tree: BTreeSnapshot, key: number): BTreeSnapshot {
  if (!Number.isFinite(key)) return tree;
  const next: BTreeSnapshot = {
    ...tree,
    root: cloneTree(tree.root),
  };

  if (!next.root) {
    const root = createNode(true);
    root.keys = [key];
    next.root = root;
    return refresh(next);
  }

  // Duplicate check
  if (search(next.root, key).found) return tree;

  if (next.root.keys.length === 2 * next.t - 1) {
    const newRoot = createNode(false);
    newRoot.children = [next.root];
    splitChild(newRoot, 0, next.t);
    next.root = newRoot;
  }

  const inserted = insertNonFull(next.root, key, next.t);
  if (!inserted) return tree;
  return refresh(next);
}

function getPredecessor(node: BTreeNode): number {
  let cur = node;
  while (!cur.leaf) cur = cur.children[cur.children.length - 1];
  return cur.keys[cur.keys.length - 1];
}

function getSuccessor(node: BTreeNode): number {
  let cur = node;
  while (!cur.leaf) cur = cur.children[0];
  return cur.keys[0];
}

function mergeChildren(parent: BTreeNode, index: number) {
  const left = parent.children[index];
  const right = parent.children[index + 1];
  left.keys.push(parent.keys[index], ...right.keys);
  if (!left.leaf) {
    left.children.push(...right.children);
  }
  parent.keys.splice(index, 1);
  parent.children.splice(index + 1, 1);
}

function borrowFromPrev(parent: BTreeNode, index: number) {
  const child = parent.children[index];
  const sibling = parent.children[index - 1];

  child.keys.unshift(parent.keys[index - 1]);
  if (!child.leaf) {
    child.children.unshift(sibling.children.pop()!);
  }
  parent.keys[index - 1] = sibling.keys.pop()!;
}

function borrowFromNext(parent: BTreeNode, index: number) {
  const child = parent.children[index];
  const sibling = parent.children[index + 1];

  child.keys.push(parent.keys[index]);
  if (!child.leaf) {
    child.children.push(sibling.children.shift()!);
  }
  parent.keys[index] = sibling.keys.shift()!;
}

function fill(parent: BTreeNode, index: number, t: number) {
  if (index > 0 && parent.children[index - 1].keys.length >= t) {
    borrowFromPrev(parent, index);
  } else if (
    index < parent.children.length - 1 &&
    parent.children[index + 1].keys.length >= t
  ) {
    borrowFromNext(parent, index);
  } else if (index < parent.children.length - 1) {
    mergeChildren(parent, index);
  } else {
    mergeChildren(parent, index - 1);
  }
}

function removeFromNode(node: BTreeNode, key: number, t: number): boolean {
  let idx = 0;
  while (idx < node.keys.length && node.keys[idx] < key) idx += 1;

  if (idx < node.keys.length && node.keys[idx] === key) {
    if (node.leaf) {
      node.keys.splice(idx, 1);
      return true;
    }

    const left = node.children[idx];
    const right = node.children[idx + 1];

    if (left.keys.length >= t) {
      const pred = getPredecessor(left);
      node.keys[idx] = pred;
      return removeFromNode(left, pred, t);
    }

    if (right.keys.length >= t) {
      const succ = getSuccessor(right);
      node.keys[idx] = succ;
      return removeFromNode(right, succ, t);
    }

    mergeChildren(node, idx);
    return removeFromNode(left, key, t);
  }

  if (node.leaf) return false;

  // idx is in [0, keys.length]; last child is at keys.length.
  const descendingIntoLastChild = idx === node.children.length - 1;
  if (node.children[idx].keys.length < t) {
    fill(node, idx, t);
  }

  // Merging the last child into its left sibling shrinks the child array;
  // descend into the merged node at idx - 1.
  if (descendingIntoLastChild && idx > node.keys.length) {
    return removeFromNode(node.children[idx - 1], key, t);
  }
  return removeFromNode(node.children[idx], key, t);
}

export function remove(tree: BTreeSnapshot, key: number): BTreeSnapshot {
  if (!tree.root) return tree;
  if (!search(tree.root, key).found) return tree;

  const next: BTreeSnapshot = {
    ...tree,
    root: cloneTree(tree.root),
  };

  removeFromNode(next.root!, key, next.t);

  if (next.root && next.root.keys.length === 0) {
    next.root = next.root.leaf ? null : next.root.children[0] ?? null;
  }

  return refresh(next);
}

export function contains(tree: BTreeSnapshot, key: number): boolean {
  return search(tree.root, key).found;
}

export function inOrder(node: BTreeNode | null, out: number[] = []): number[] {
  if (!node) return out;
  for (let i = 0; i < node.keys.length; i += 1) {
    if (!node.leaf) inOrder(node.children[i], out);
    out.push(node.keys[i]);
  }
  if (!node.leaf) inOrder(node.children[node.keys.length], out);
  return out;
}

export function clear(tree: BTreeSnapshot): BTreeSnapshot {
  return { root: null, t: tree.t, height: 0, size: 0 };
}

export function withDegree(tree: BTreeSnapshot, t: number): BTreeSnapshot {
  const keys = inOrder(tree.root);
  let next = createBTree(t);
  for (const key of keys) {
    next = insert(next, key);
  }
  return next;
}

/** Layout helpers for SVG rendering */
export type LayoutNode = {
  id: string;
  keys: number[];
  leaf: boolean;
  x: number;
  y: number;
  width: number;
  children: LayoutNode[];
};

const KEY_W = 28;
const KEY_PAD = 8;
const NODE_H = 32;
const LEVEL_GAP = 64;
const SIBLING_GAP = 16;

function nodeWidth(keyCount: number) {
  return Math.max(KEY_W + KEY_PAD, keyCount * KEY_W + KEY_PAD);
}

function layoutSubtree(
  node: BTreeNode,
  depth: number,
  left: number
): { layout: LayoutNode; width: number; right: number } {
  const width = nodeWidth(node.keys.length);

  if (node.leaf || node.children.length === 0) {
    const layout: LayoutNode = {
      id: node.id,
      keys: [...node.keys],
      leaf: node.leaf,
      x: left + width / 2,
      y: depth * LEVEL_GAP,
      width,
      children: [],
    };
    return { layout, width, right: left + width };
  }

  const childLayouts: LayoutNode[] = [];
  let cursor = left;
  let totalWidth = 0;

  node.children.forEach((child, i) => {
    const result = layoutSubtree(child, depth + 1, cursor);
    childLayouts.push(result.layout);
    cursor = result.right + SIBLING_GAP;
    totalWidth = result.right - left;
    if (i < node.children.length - 1) {
      // gap already added via cursor
    }
  });

  // Remove trailing gap from total
  totalWidth = Math.max(totalWidth, width);
  const first = childLayouts[0];
  const last = childLayouts[childLayouts.length - 1];
  const childrenSpan = last.x - first.x;
  const center = first.x + childrenSpan / 2;

  const layout: LayoutNode = {
    id: node.id,
    keys: [...node.keys],
    leaf: node.leaf,
    x: center,
    y: depth * LEVEL_GAP,
    width,
    children: childLayouts,
  };

  return {
    layout,
    width: Math.max(totalWidth, width),
    right: left + Math.max(totalWidth, width),
  };
}

export function layoutTree(root: BTreeNode | null): {
  nodes: LayoutNode[];
  edges: { from: string; to: string; fromX: number; fromY: number; toX: number; toY: number }[];
  width: number;
  height: number;
} {
  if (!root) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const { layout, width } = layoutSubtree(root, 0, 0);
  const nodes: LayoutNode[] = [];
  const edges: {
    from: string;
    to: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }[] = [];

  function walk(n: LayoutNode) {
    nodes.push(n);
    for (const child of n.children) {
      edges.push({
        from: n.id,
        to: child.id,
        fromX: n.x,
        fromY: n.y + NODE_H / 2,
        toX: child.x,
        toY: child.y - NODE_H / 2,
      });
      walk(child);
    }
  }

  walk(layout);

  // Normalize so nodes sit fully inside the SVG viewBox (pad on all sides).
  // Root is laid out at y=0 (center), so without a Y shift the top half is clipped.
  const pad = 24;
  const minX = Math.min(...nodes.map((n) => n.x - n.width / 2));
  const minY = Math.min(...nodes.map((n) => n.y - NODE_H / 2));
  for (const n of nodes) {
    n.x = n.x - minX + pad;
    n.y = n.y - minY + pad;
  }
  for (const e of edges) {
    e.fromX = e.fromX - minX + pad;
    e.toX = e.toX - minX + pad;
    e.fromY = e.fromY - minY + pad;
    e.toY = e.toY - minY + pad;
  }

  const maxX = Math.max(...nodes.map((n) => n.x + n.width / 2));
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H / 2));

  return {
    nodes,
    edges,
    width: maxX + pad,
    height: maxY + pad,
  };
}

export const LAYOUT = { KEY_W, KEY_PAD, NODE_H, LEVEL_GAP, SIBLING_GAP };
