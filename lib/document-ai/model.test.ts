import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_THRESHOLD,
  decideMatch,
  matchAll,
  matchField,
  summarizeDecisions,
  INVOICE_SCENE,
} from "./model";

describe("document-ai matching", () => {
  it("auto-accepts high combined scores", () => {
    assert.equal(decideMatch(0.96, DEFAULT_THRESHOLD), "auto");
  });

  it("asks when far below threshold", () => {
    assert.equal(decideMatch(0.5, DEFAULT_THRESHOLD), "ask");
  });

  it("soft-reviews near the threshold band", () => {
    assert.equal(decideMatch(0.75, DEFAULT_THRESHOLD), "review");
  });

  it("matches invoice number confidently on the fixture", () => {
    const result = matchField(INVOICE_SCENE, "invoice_number", DEFAULT_THRESHOLD);
    assert.equal(result.decision, "auto");
    assert.equal(result.proposedValue, "INV-1042");
  });

  it("asks on weak GL match at default threshold", () => {
    const result = matchField(INVOICE_SCENE, "gl_account", DEFAULT_THRESHOLD);
    assert.equal(result.decision, "ask");
    assert.equal(result.proposedValue, null);
  });

  it("summarizes a full pass", () => {
    const matches = matchAll(INVOICE_SCENE, DEFAULT_THRESHOLD);
    const summary = summarizeDecisions(matches);
    assert.equal(summary.auto + summary.review + summary.ask, 5);
    assert.ok(summary.auto >= 2);
    assert.ok(summary.ask >= 1);
  });
});
