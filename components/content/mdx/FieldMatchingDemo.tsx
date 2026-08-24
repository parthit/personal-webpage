"use client";

import { useMemo, useState } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { useAnimationPlayer } from "@/components/animation/useAnimationPlayer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_THRESHOLD,
  INVOICE_SCENE,
  type MatchDecision,
} from "@/lib/document-ai/model";
import {
  FIELD_STEP_MS,
  buildFieldMatchingSteps,
  idleSnapshot,
  type FieldMatchingSnapshot,
} from "@/lib/document-ai/frames";
import { figureShell } from "./replication/ReplicaCard";

const DECISION_STYLE: Record<
  MatchDecision,
  { label: string; className: string }
> = {
  auto: {
    label: "Auto",
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  },
  review: {
    label: "Review",
    className:
      "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
  },
  ask: {
    label: "Ask user",
    className: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100",
  },
};

function DecisionBadge({ decision }: { decision: MatchDecision }) {
  const style = DECISION_STYLE[decision];
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        style.className
      )}
      data-decision={decision}
    >
      {style.label}
    </span>
  );
}

function PdfPage({ snapshot }: { snapshot: FieldMatchingSnapshot }) {
  const active = useMemo(
    () => new Set(snapshot.activeSpanIds),
    [snapshot.activeSpanIds]
  );

  return (
    <div
      className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-gray-300 bg-[#f7f4ee] shadow-sm dark:border-gray-600 dark:bg-[#1c1916]"
      data-pdf-page
      aria-label="Simulated invoice PDF page"
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-black/5 px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 dark:border-white/10 dark:text-gray-400">
        <span>Invoice PDF</span>
        <span>OCR overlay</span>
      </div>
      <div className="absolute left-3 top-10 text-sm font-semibold text-gray-800 dark:text-gray-100">
        Acme Supplies
      </div>
      {INVOICE_SCENE.spans.map((span) => {
        const isActive = active.has(span.id);
        const matchedField = Object.values(snapshot.matches).find(
          (m) => m.best?.spanId === span.id
        );
        return (
          <div
            key={span.id}
            data-ocr-span={span.id}
            data-ocr-active={isActive ? "true" : "false"}
            className={cn(
              "absolute rounded border px-1.5 py-0.5 text-[10px] leading-tight transition-all duration-300 sm:text-[11px]",
              isActive
                ? "z-10 border-sky-500 bg-sky-200/90 text-sky-950 shadow dark:border-sky-400 dark:bg-sky-900/80 dark:text-sky-50"
                : "border-gray-400/50 bg-white/70 text-gray-700 dark:border-gray-500 dark:bg-gray-900/50 dark:text-gray-300",
              matchedField?.decision === "auto" && !isActive
                ? "ring-2 ring-emerald-400/70"
                : null,
              matchedField?.decision === "review" && !isActive
                ? "ring-2 ring-amber-400/70"
                : null,
              matchedField?.decision === "ask" && !isActive
                ? "ring-2 ring-rose-400/70"
                : null
            )}
            style={{
              left: `${span.box.x}%`,
              top: `${span.box.y}%`,
              width: `${span.box.w}%`,
              minHeight: `${span.box.h}%`,
            }}
          >
            <span className="block truncate font-mono">{span.rawText}</span>
            <span className="block text-[9px] opacity-70">
              OCR {(span.ocrConfidence * 100).toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreBars({ snapshot }: { snapshot: FieldMatchingSnapshot }) {
  if (snapshot.scorePreview.length === 0) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Candidate scores appear when a field is being matched.
      </p>
    );
  }
  return (
    <ul className="space-y-2" data-score-bars>
      {snapshot.scorePreview.map((score) => {
        if (!score) return null;
        const span = INVOICE_SCENE.spans.find((s) => s.id === score.spanId);
        return (
          <li key={score.spanId} className="text-xs">
            <div className="mb-1 flex justify-between gap-2 font-mono text-gray-700 dark:text-gray-300">
              <span className="truncate">{span?.rawText ?? score.spanId}</span>
              <span className="tabular-nums">
                {(score.combined * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
              <div
                className="h-full rounded bg-sky-500 transition-[width] duration-500 dark:bg-sky-400"
                style={{ width: `${Math.round(score.combined * 100)}%` }}
              />
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <span>lex {(score.lexical * 100).toFixed(0)}%</span>
              <span>sem {(score.semantic * 100).toFixed(0)}%</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function FieldMatchingDemo() {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const playback = useAnimationPlayer<FieldMatchingSnapshot>(
    {
      snapshot: idleSnapshot(DEFAULT_THRESHOLD),
      label:
        "Set a threshold, then run the matcher to walk OCR → scores → decisions.",
    },
    FIELD_STEP_MS
  );
  const snapshot = playback.current.snapshot;
  const busy = playback.isActive;

  function runMatcher() {
    void playback.run(buildFieldMatchingSteps(INVOICE_SCENE, threshold));
  }

  function onReset() {
    setThreshold(DEFAULT_THRESHOLD);
    playback.reset({
      snapshot: idleSnapshot(DEFAULT_THRESHOLD),
      label: "Reset — adjust the threshold and run again.",
    });
  }

  return (
    <figure className={figureShell} data-field-matching-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Document AI playground — OCR spans → field matching → trust decisions
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          Auto-accept threshold = {(threshold * 100).toFixed(0)}%
          <input
            type="range"
            min={70}
            max={95}
            step={1}
            value={Math.round(threshold * 100)}
            disabled={busy}
            aria-label="Auto-accept confidence threshold"
            onChange={(e) => setThreshold(Number(e.target.value) / 100)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={runMatcher}
          >
            Run matcher
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onReset}
          >
            Reset
          </Button>
        </div>
        {busy ? (
          <p
            className="text-xs font-medium text-amber-700 dark:text-amber-300"
            aria-live="polite"
          >
            Animating — step {playback.index + 1} of {playback.steps.length}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <PdfPage snapshot={snapshot} />
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Schema fields
            </h4>
            <ul className="space-y-2" data-schema-fields>
              {INVOICE_SCENE.schema.map((field) => {
                const match = snapshot.matches[field.id];
                const active = snapshot.activeFieldId === field.id;
                return (
                  <li
                    key={field.id}
                    data-field-id={field.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
                        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {field.label}
                      </span>
                      {match ? (
                        <DecisionBadge decision={match.decision} />
                      ) : (
                        <span className="text-[10px] uppercase text-gray-400">
                          pending
                        </span>
                      )}
                    </div>
                    {match?.proposedValue ? (
                      <p className="mt-1 font-mono text-xs text-gray-700 dark:text-gray-300">
                        → {match.proposedValue}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Active scores
            </h4>
            <ScoreBars snapshot={snapshot} />
          </div>
        </div>
      </div>

      <AnimationPlayer player={playback} title="Field matching timeline" />

      <p
        className="border-t border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-800 sm:px-4 dark:border-gray-700 dark:text-gray-200"
        data-field-matching-status
        aria-live="polite"
      >
        {snapshot.message}
      </p>
    </figure>
  );
}
