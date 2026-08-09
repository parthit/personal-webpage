import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDraftFlag } from "./writing";

describe("parseDraftFlag", () => {
  it("keeps boolean values", () => {
    assert.equal(parseDraftFlag(true), true);
    assert.equal(parseDraftFlag(false), false);
  });

  it("treats common string falsey values as published", () => {
    assert.equal(parseDraftFlag("false"), false);
    assert.equal(parseDraftFlag("False"), false);
    assert.equal(parseDraftFlag("0"), false);
    assert.equal(parseDraftFlag("no"), false);
    assert.equal(parseDraftFlag(""), false);
  });

  it("treats common string truthy values as drafts", () => {
    assert.equal(parseDraftFlag("true"), true);
    assert.equal(parseDraftFlag("True"), true);
    assert.equal(parseDraftFlag("1"), true);
    assert.equal(parseDraftFlag("yes"), true);
  });

  it("defaults unknown or missing values to published", () => {
    assert.equal(parseDraftFlag(undefined), false);
    assert.equal(parseDraftFlag(null), false);
    assert.equal(parseDraftFlag({}), false);
  });
});
