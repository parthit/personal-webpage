"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { SequenceDiagram } from "@/components/animation/SequenceDiagram";
import { useAnimationPlayer } from "@/components/animation/useAnimationPlayer";
import { useLiveStepProgress } from "@/components/animation/useLiveStepProgress";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { figureShell } from "@/components/content/mdx/replication/ReplicaCard";
import {
  ISOLATION_HINTS,
  ISOLATION_LABELS,
  type IsolationLevel,
  type RecordView,
} from "@/lib/transactions/model";
import {
  buildIsolationSteps,
  idleSnapshot,
  isolationPresentationAt,
  TX_MIN_STEP_MS,
  type IsolationSnapshot,
} from "@/lib/transactions/frames";
import {
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  reducedMotionSubscribe,
  visiblePlayhead,
} from "@/lib/animation/core";
import {
  ISOLATION_SCRIPTS,
  SCENARIO_LEVELS,
  type IsolationScenarioId,
} from "@/lib/transactions/scripts";
import { cn } from "@/lib/utils";

export function IsolationDemo({
  scenario: scenarioId,
}: {
  scenario: IsolationScenarioId;
}) {
  const figureRef = useRef<HTMLElement | null>(null);
  const script = ISOLATION_SCRIPTS[scenarioId];
  const levels = SCENARIO_LEVELS[scenarioId];
  const [level, setLevel] = useState<IsolationLevel>(levels[0]);
  const idle = useMemo(() => idleSnapshot(script, level), [script, level]);
  const player = useAnimationPlayer<IsolationSnapshot>(
    {
      snapshot: idle,
      label: script.summary,
      durationMs: TX_MIN_STEP_MS,
    },
    TX_MIN_STEP_MS
  );
  const snapshot = player.current.snapshot;
  const busy = player.isActive;
  const reducedMotion = useSyncExternalStore(
    reducedMotionSubscribe,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const progress = useLiveStepProgress(
    player.status === "playing" && !reducedMotion,
    player.stepProgress,
    player.currentDurationMs,
    `${snapshot.scenario.id}:${snapshot.fromNow}:${snapshot.toNow}`
  );
  const now = visiblePlayhead(
    snapshot.fromNow,
    snapshot.toNow,
    progress,
    reducedMotion
  );
  const presentation = isolationPresentationAt(snapshot, now, snapshot.settled);

  useEffect(() => {
    // #region agent log
    void fetch("/api/agent-debug", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hypothesisId: "A,D",
        location: "IsolationDemo.tsx:playback-state",
        message: "Isolation playback state rendered",
        data: {
          scenarioId,
          status: player.status,
          index: player.index,
          stepProgress: player.stepProgress,
          fromNow: snapshot.fromNow,
          toNow: snapshot.toNow,
          settled: snapshot.settled,
        },
      }),
    });
    // #endregion
  }, [
    player.index,
    player.status,
    player.stepProgress,
    scenarioId,
    snapshot.fromNow,
    snapshot.settled,
    snapshot.toNow,
  ]);

  useEffect(() => {
    if (player.status !== "complete") return;
    const sample = () => {
      const figure = figureRef.current;
      if (!figure) return;
      const diagram = figure.querySelector<HTMLElement>("[data-sequence-diagram]");
      const history = figure.querySelector<HTMLElement>("[data-animation-history]");
      const figureBox = figure.getBoundingClientRect();
      const lines = Array.from(figure.querySelectorAll<SVGLineElement>("svg line")).map(
        (line, index) => {
          const box = line.getBoundingClientRect();
          const owner = line.closest<SVGGElement>(
            "[data-sequence-message], [data-sequence-event], [data-sequence-actor]"
          );
          return {
            index,
            kind: line.hasAttribute("data-sequence-playhead-line")
              ? "playhead"
              : owner?.getAttribute("data-sequence-message") ??
                owner?.getAttribute("data-sequence-event") ??
                owner?.getAttribute("data-sequence-actor") ??
                "unclassified",
            x1: line.getAttribute("x1"),
            y1: line.getAttribute("y1"),
            x2: line.getAttribute("x2"),
            y2: line.getAttribute("y2"),
            left: Number(box.left.toFixed(2)),
            top: Number(box.top.toFixed(2)),
            right: Number(box.right.toFixed(2)),
            bottom: Number(box.bottom.toFixed(2)),
          };
        }
      );
      // #region agent log
      void fetch("/api/agent-debug", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hypothesisId: "A,B,C,D",
          location: "IsolationDemo.tsx:finished-sample",
          message: "Post-Finished geometry sample",
          data: {
            scenarioId,
            elapsedSinceFinishedMs: Math.round(performance.now() - finishedAt),
            now: diagram?.dataset.playhead,
            from: diagram?.dataset.playheadFrom,
            to: diagram?.dataset.playheadTo,
            windowScrollY: window.scrollY,
            figureTop: Number(figureBox.top.toFixed(2)),
            figureHeight: Number(figureBox.height.toFixed(2)),
            diagramScrollLeft: diagram?.scrollLeft,
            historyScrollTop: history?.scrollTop,
            animations: figure.getAnimations().map((animation) => ({
              currentTime: animation.currentTime,
              playState: animation.playState,
              target: (animation.effect as KeyframeEffect | null)?.target
                ? ((animation.effect as KeyframeEffect).target as Element).getAttribute(
                    "data-animation-step-progress"
                  ) ?? ((animation.effect as KeyframeEffect).target as Element).tagName
                : null,
            })),
            lines,
          },
        }),
      });
      // #endregion
    };
    const finishedAt = performance.now();
    sample();
    const interval = window.setInterval(sample, 250);
    const stop = window.setTimeout(() => window.clearInterval(interval), 4_250);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [player.status, scenarioId]);

  function changeLevel(next: IsolationLevel) {
    setLevel(next);
    const nextIdle = idleSnapshot(script, next);
    player.reset({
      snapshot: nextIdle,
      label: script.summary,
      durationMs: TX_MIN_STEP_MS,
    });
  }

  async function run() {
    await player.run(buildIsolationSteps(script, level));
  }

  function reset() {
    const nextIdle = idleSnapshot(script, level);
    player.reset({
      snapshot: nextIdle,
      label: script.summary,
      durationMs: TX_MIN_STEP_MS,
    });
  }

  const options = levels.map((value) => ({
    value,
    label: ISOLATION_LABELS[value],
    hint: ISOLATION_HINTS[value],
  }));

  return (
    <figure ref={figureRef} className={figureShell} data-isolation-demo={scenarioId}>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        {script.title} — {script.summary}
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <SegmentedControl
          label="Isolation level"
          value={level}
          options={options}
          onValueChange={(next) => changeLevel(next as IsolationLevel)}
          disabled={busy}
          hint
          data-testid="isolation-level"
        />
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void run()}
          >
            Run the interleaving
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={reset}
          >
            Reset
          </Button>
        </div>
        <RecordStrip records={presentation.records} />
      </div>

      <div className="p-3 sm:p-4">
        <SequenceDiagram
          scenario={snapshot.scenario}
          now={now}
          stepFrom={snapshot.fromNow}
          stepTo={snapshot.toNow}
          followPlayhead={player.status === "playing"}
          highlightActorIds={presentation.highlightActorIds}
          highlightMessageIds={presentation.highlightMessageIds}
          ariaLabel={`${script.title} sequence diagram`}
        />
      </div>

      <AnimationPlayer player={player} />

      <p
        className="border-t border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-800 sm:px-4 dark:border-gray-700 dark:text-gray-200"
        data-isolation-status
        aria-live="polite"
      >
        {presentation.outcome ?? presentation.caption}
      </p>
    </figure>
  );
}

function RecordStrip({
  records,
}: {
  records: RecordView[];
}) {
  return (
    <ul className="flex flex-wrap gap-2" data-isolation-records>
      {records.map((record) => (
        <li
          key={record.id}
          data-record-id={record.id}
          data-record-committed={record.committed}
          data-record-uncommitted={record.uncommitted ?? ""}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-xs",
            record.uncommitted != null
              ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
              : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950"
          )}
        >
          <span className="font-medium text-gray-800 dark:text-gray-100">
            {record.label}
          </span>
          <span className="ml-2 tabular-nums text-gray-600 dark:text-gray-300">
            {formatRecord(record.committed, record.unit)}
            {record.uncommitted != null
              ? ` · uncommitted ${formatRecord(record.uncommitted, record.unit)}`
              : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatRecord(value: number, unit?: string) {
  if (unit === "bool") return value ? "on call" : "off";
  return String(value);
}
