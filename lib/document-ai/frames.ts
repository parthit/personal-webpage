import type { AnimationStep } from "@/lib/animation/core";
import {
  INVOICE_SCENE,
  matchField,
  type DocumentScene,
  type FieldMatch,
  type MatchDecision,
} from "./model";

export const FIELD_STEP_MS = 900;
export const FIELD_HOLD_MS = 1200;

export type FieldPhase =
  | "idle"
  | "scan"
  | "extract"
  | "score"
  | "decide"
  | "done";

export type FieldMatchingSnapshot = {
  phase: FieldPhase;
  threshold: number;
  /** Spans currently highlighted on the page */
  activeSpanIds: string[];
  /** Schema field currently being matched */
  activeFieldId: string | null;
  /** Completed matches keyed by field id */
  matches: Record<string, FieldMatch>;
  /** Score bars for the active field's candidates */
  scorePreview: FieldMatch["best"][];
  message: string;
  focusDecision: MatchDecision | null;
};

export function idleSnapshot(threshold: number): FieldMatchingSnapshot {
  return {
    phase: "idle",
    threshold,
    activeSpanIds: [],
    activeFieldId: null,
    matches: {},
    scorePreview: [],
    message:
      "Run the matcher to walk OCR → candidates → confidence → auto / review / ask.",
    focusDecision: null,
  };
}

function cloneMatches(
  matches: Record<string, FieldMatch>
): Record<string, FieldMatch> {
  return { ...matches };
}

export function buildFieldMatchingSteps(
  scene: DocumentScene = INVOICE_SCENE,
  threshold: number
): AnimationStep<FieldMatchingSnapshot>[] {
  const steps: AnimationStep<FieldMatchingSnapshot>[] = [];
  const matches: Record<string, FieldMatch> = {};

  steps.push({
    label: "Scan the PDF page for text regions",
    durationMs: FIELD_STEP_MS,
    snapshot: {
      phase: "scan",
      threshold,
      activeSpanIds: scene.spans.map((s) => s.id),
      activeFieldId: null,
      matches: {},
      scorePreview: [],
      message:
        "OCR draws boxes first. Treat every box as untrusted — confidence is a hint, not truth.",
      focusDecision: null,
    },
  });

  steps.push({
    label: "Extract noisy span text",
    durationMs: FIELD_STEP_MS,
    snapshot: {
      phase: "extract",
      threshold,
      activeSpanIds: scene.spans
        .filter((s) => s.label !== "noise")
        .map((s) => s.id),
      activeFieldId: null,
      matches: {},
      scorePreview: [],
      message:
        "Raw text still has OCR errors: Vend0r, 2O26, Supp1ies. Matching must survive that.",
      focusDecision: null,
    },
  });

  for (const field of scene.schema) {
    const ranked = scene.scores[field.id] ?? [];
    const result = matchField(scene, field.id, threshold);

    steps.push({
      label: `Score candidates for ${field.label}`,
      durationMs: FIELD_STEP_MS,
      group: field.id,
      snapshot: {
        phase: "score",
        threshold,
        activeSpanIds: ranked.map((c) => c.spanId),
        activeFieldId: field.id,
        matches: cloneMatches(matches),
        scorePreview: ranked,
        message: `Lexical + semantic scores for “${field.label}”. Combined = 0.45·lexical + 0.55·semantic (assumed weights).`,
        focusDecision: null,
      },
    });

    matches[field.id] = result;

    steps.push({
      label: `Decide ${field.label}: ${result.decision}`,
      durationMs: FIELD_HOLD_MS,
      group: field.id,
      snapshot: {
        phase: "decide",
        threshold,
        activeSpanIds: result.best ? [result.best.spanId] : [],
        activeFieldId: field.id,
        matches: cloneMatches(matches),
        scorePreview: ranked,
        message: result.reason,
        focusDecision: result.decision,
      },
    });
  }

  const auto = Object.values(matches).filter((m) => m.decision === "auto").length;
  const review = Object.values(matches).filter(
    (m) => m.decision === "review"
  ).length;
  const ask = Object.values(matches).filter((m) => m.decision === "ask").length;

  steps.push({
    label: "Pipeline complete",
    durationMs: FIELD_HOLD_MS,
    snapshot: {
      phase: "done",
      threshold,
      activeSpanIds: [],
      activeFieldId: null,
      matches: cloneMatches(matches),
      scorePreview: [],
      message: `Done — ${auto} auto, ${review} soft-confirm, ${ask} ask-user. Raise the threshold to trust less; lower it to automate more.`,
      focusDecision: null,
    },
  });

  return steps;
}
