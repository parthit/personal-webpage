"use client";

import { useMemo, useState } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { SequenceDiagram } from "@/components/animation/SequenceDiagram";
import { useAnimationPlayer } from "@/components/animation/useAnimationPlayer";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { figureShell } from "@/components/content/mdx/replication/ReplicaCard";
import {
  ISOLATION_HINTS,
  ISOLATION_LABELS,
  type IsolationLevel,
} from "@/lib/transactions/model";
import {
  buildIsolationSteps,
  idleSnapshot,
  TX_STEP_MS,
  type IsolationSnapshot,
} from "@/lib/transactions/frames";
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
  const script = ISOLATION_SCRIPTS[scenarioId];
  const levels = SCENARIO_LEVELS[scenarioId];
  const [level, setLevel] = useState<IsolationLevel>(levels[0]);
  const idle = useMemo(() => idleSnapshot(script, level), [script, level]);
  const player = useAnimationPlayer<IsolationSnapshot>(
    {
      snapshot: idle,
      label: idle.caption,
      durationMs: TX_STEP_MS,
    },
    TX_STEP_MS
  );
  const view = player.current.snapshot;
  const busy = player.isActive;

  function changeLevel(next: IsolationLevel) {
    setLevel(next);
    const nextIdle = idleSnapshot(script, next);
    player.reset({
      snapshot: nextIdle,
      label: nextIdle.caption,
      durationMs: TX_STEP_MS,
    });
  }

  async function run() {
    await player.run(buildIsolationSteps(script, level));
  }

  function reset() {
    const nextIdle = idleSnapshot(script, level);
    player.reset({
      snapshot: nextIdle,
      label: nextIdle.caption,
      durationMs: TX_STEP_MS,
    });
  }

  const options = levels.map((value) => ({
    value,
    label: ISOLATION_LABELS[value],
    hint: ISOLATION_HINTS[value],
  }));

  return (
    <figure className={figureShell} data-isolation-demo={scenarioId}>
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
        <RecordStrip records={view.records} />
      </div>

      <div className="p-3 sm:p-4">
        <SequenceDiagram
          scenario={view.scenario}
          fromNow={view.fromNow}
          toNow={view.toNow}
          stepProgress={player.stepProgress}
          highlightActorIds={view.highlightActorIds}
          highlightMessageIds={view.highlightMessageIds}
          ariaLabel={`${script.title} sequence diagram`}
        />
      </div>

      <AnimationPlayer player={player} />

      <p
        className="border-t border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-800 sm:px-4 dark:border-gray-700 dark:text-gray-200"
        data-isolation-status
        aria-live="polite"
      >
        {view.outcome ?? view.caption}
      </p>
    </figure>
  );
}

function RecordStrip({
  records,
}: {
  records: IsolationSnapshot["records"];
}) {
  return (
    <ul className="flex flex-wrap gap-2" data-isolation-records>
      {records.map((record) => (
        <li
          key={record.id}
          data-record-id={record.id}
          data-record-committed={record.committed}
          data-record-dirty={record.dirty ?? ""}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-xs",
            record.dirty != null
              ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
              : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950"
          )}
        >
          <span className="font-medium text-gray-800 dark:text-gray-100">
            {record.label}
          </span>
          <span className="ml-2 tabular-nums text-gray-600 dark:text-gray-300">
            {formatRecord(record.committed, record.unit)}
            {record.dirty != null
              ? ` · dirty ${formatRecord(record.dirty, record.unit)}`
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
