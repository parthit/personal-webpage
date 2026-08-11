import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clear,
  contains,
  createBTree,
  inOrder,
  insert,
  remove,
  search,
  withDegree,
} from "./btree";

describe("B-tree", () => {
  it("inserts and keeps keys sorted in-order", () => {
    let tree = createBTree(2);
    for (const key of [10, 20, 5, 6, 12, 30, 7, 17]) {
      tree = insert(tree, key);
    }
    assert.deepEqual(inOrder(tree.root), [5, 6, 7, 10, 12, 17, 20, 30]);
    assert.equal(tree.size, 8);
  });

  it("rejects duplicate keys", () => {
    let tree = createBTree(2);
    tree = insert(tree, 5);
    tree = insert(tree, 5);
    assert.equal(tree.size, 1);
    assert.deepEqual(inOrder(tree.root), [5]);
  });

  it("searches with a path of visited nodes", () => {
    let tree = createBTree(2);
    for (const key of [1, 2, 3, 4, 5, 6, 7]) {
      tree = insert(tree, key);
    }
    const hit = search(tree.root, 5);
    assert.equal(hit.found, true);
    assert.ok(hit.steps.length >= 1);
    assert.equal(hit.steps[hit.steps.length - 1].found, true);

    const miss = search(tree.root, 99);
    assert.equal(miss.found, false);
  });

  it("deletes keys and shrinks the root when needed", () => {
    let tree = createBTree(2);
    for (const key of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      tree = insert(tree, key);
    }
    for (const key of [3, 1, 9, 7, 5]) {
      tree = remove(tree, key);
    }
    assert.deepEqual(inOrder(tree.root), [2, 4, 6, 8]);
    assert.equal(contains(tree, 3), false);
  });

  it("rebuilds when degree changes", () => {
    let tree = createBTree(2);
    for (const key of [10, 20, 30, 40, 50]) {
      tree = insert(tree, key);
    }
    tree = withDegree(tree, 3);
    assert.equal(tree.t, 3);
    assert.deepEqual(inOrder(tree.root), [10, 20, 30, 40, 50]);
  });

  it("clears the tree", () => {
    let tree = createBTree(2);
    tree = insert(tree, 1);
    tree = insert(tree, 2);
    tree = clear(tree);
    assert.equal(tree.root, null);
    assert.equal(tree.size, 0);
  });
});
