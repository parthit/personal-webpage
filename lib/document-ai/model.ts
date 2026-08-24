/**
 * Toy Document AI matching model for the blog playground.
 * Numbers are illustrative — not production Intuit metrics.
 */

export type MatchDecision = "auto" | "review" | "ask";

export type SchemaField = {
  id: string;
  label: string;
  expectedHint: string;
};

export type OcrSpan = {
  id: string;
  label: string;
  rawText: string;
  /** 0–1 OCR confidence for the span itself */
  ocrConfidence: number;
  /** Bounding box as % of the page */
  box: { x: number; y: number; w: number; h: number };
};

export type CandidateScore = {
  spanId: string;
  /** Exact / fuzzy string score 0–1 */
  lexical: number;
  /** Embedding / semantic score 0–1 (simulated) */
  semantic: number;
  /** Combined score after weighting */
  combined: number;
};

export type FieldMatch = {
  fieldId: string;
  best: CandidateScore | null;
  decision: MatchDecision;
  reason: string;
  /** Value that would be written if accepted */
  proposedValue: string | null;
};

export type DocumentScene = {
  title: string;
  schema: SchemaField[];
  spans: OcrSpan[];
  /** Precomputed candidate scores: fieldId → candidates ranked */
  scores: Record<string, CandidateScore[]>;
};

export const DEFAULT_THRESHOLD = 0.82;

/** Clean invoice used as the playground fixture. */
export const INVOICE_SCENE: DocumentScene = {
  title: "Invoice — Acme Supplies",
  schema: [
    { id: "vendor", label: "Vendor", expectedHint: "legal name" },
    { id: "invoice_number", label: "Invoice #", expectedHint: "INV-…" },
    { id: "invoice_date", label: "Date", expectedHint: "MM/DD/YYYY" },
    { id: "amount", label: "Amount", expectedHint: "currency" },
    { id: "gl_account", label: "GL account", expectedHint: "chart code" },
  ],
  spans: [
    {
      id: "s_vendor",
      label: "header",
      rawText: "Vend0r: Acme Coffee LLC",
      ocrConfidence: 0.71,
      box: { x: 8, y: 14, w: 52, h: 7 },
    },
    {
      id: "s_inv",
      label: "meta",
      rawText: "Inv #: INV-1042",
      ocrConfidence: 0.94,
      box: { x: 8, y: 28, w: 40, h: 6 },
    },
    {
      id: "s_date",
      label: "meta",
      rawText: "Date: 08/12/2O26",
      ocrConfidence: 0.68,
      box: { x: 8, y: 36, w: 38, h: 6 },
    },
    {
      id: "s_amount",
      label: "total",
      rawText: "Total due: $1,284.50",
      ocrConfidence: 0.91,
      box: { x: 48, y: 72, w: 44, h: 7 },
    },
    {
      id: "s_gl",
      label: "footer",
      rawText: "GL: 6100-Office Supp1ies",
      ocrConfidence: 0.63,
      box: { x: 8, y: 84, w: 58, h: 6 },
    },
    {
      id: "s_noise",
      label: "noise",
      rawText: "Page 1 of 1 · PO ref 88A",
      ocrConfidence: 0.88,
      box: { x: 8, y: 92, w: 50, h: 5 },
    },
  ],
  scores: {
    vendor: [
      {
        spanId: "s_vendor",
        lexical: 0.62,
        semantic: 0.91,
        combined: 0.79,
      },
      {
        spanId: "s_noise",
        lexical: 0.05,
        semantic: 0.12,
        combined: 0.08,
      },
    ],
    invoice_number: [
      {
        spanId: "s_inv",
        lexical: 0.97,
        semantic: 0.95,
        combined: 0.96,
      },
    ],
    invoice_date: [
      {
        spanId: "s_date",
        lexical: 0.74,
        semantic: 0.88,
        combined: 0.81,
      },
    ],
    amount: [
      {
        spanId: "s_amount",
        lexical: 0.93,
        semantic: 0.94,
        combined: 0.93,
      },
    ],
    gl_account: [
      {
        spanId: "s_gl",
        lexical: 0.55,
        semantic: 0.72,
        combined: 0.64,
      },
      {
        spanId: "s_noise",
        lexical: 0.1,
        semantic: 0.18,
        combined: 0.13,
      },
    ],
  },
};

const CLEAN_VALUES: Record<string, string> = {
  vendor: "Acme Coffee LLC",
  invoice_number: "INV-1042",
  invoice_date: "08/12/2026",
  amount: "$1,284.50",
  gl_account: "6100 — Office Supplies",
};

export function decideMatch(
  combined: number,
  threshold: number
): MatchDecision {
  if (combined >= threshold) return "auto";
  if (combined >= threshold - 0.12) return "review";
  return "ask";
}

export function reasonFor(
  fieldId: string,
  best: CandidateScore | null,
  decision: MatchDecision,
  threshold: number
): string {
  if (!best) {
    return "No candidate scored above noise — ask the user.";
  }
  const pct = Math.round(best.combined * 100);
  const bar = Math.round(threshold * 100);
  if (decision === "auto") {
    return `Combined ${pct}% ≥ ${bar}% threshold — auto-accept.`;
  }
  if (decision === "review") {
    if (fieldId === "vendor" || fieldId === "invoice_date") {
      return `Near threshold (${pct}%). OCR noise present — soft confirm.`;
    }
    return `Near threshold (${pct}%). Show candidate with one-tap confirm.`;
  }
  return `Combined ${pct}% well below ${bar}% — ask the user; do not guess.`;
}

export function matchField(
  scene: DocumentScene,
  fieldId: string,
  threshold: number
): FieldMatch {
  const ranked = scene.scores[fieldId] ?? [];
  const best = ranked[0] ?? null;
  const decision = best
    ? decideMatch(best.combined, threshold)
    : "ask";
  return {
    fieldId,
    best,
    decision,
    reason: reasonFor(fieldId, best, decision, threshold),
    proposedValue:
      decision === "ask" ? null : (CLEAN_VALUES[fieldId] ?? null),
  };
}

export function matchAll(
  scene: DocumentScene,
  threshold: number
): FieldMatch[] {
  return scene.schema.map((field) => matchField(scene, field.id, threshold));
}

export function summarizeDecisions(matches: FieldMatch[]): {
  auto: number;
  review: number;
  ask: number;
} {
  return matches.reduce(
    (acc, m) => {
      acc[m.decision] += 1;
      return acc;
    },
    { auto: 0, review: 0, ask: 0 }
  );
}
