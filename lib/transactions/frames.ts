import type { AnimationStep } from "@/lib/animation/core";
import type { SequenceScenario } from "@/lib/animation/sequence";
import {
  simulate,
  type IsolationBeat,
  type IsolationLevel,
  type IsolationScript,
  type RecordView,
} from "./model";

export const TX_STEP_MS = 1800;
export const TX_HOLD_MS = 2600;

export type IsolationSnapshot = {
  scenario: SequenceScenario;
  fromNow: number;
  toNow: number;
  caption: string;
  highlightActorIds: string[];
  highlightMessageIds: string[];
  records: RecordView[];
  outcome: string | null;
  level: IsolationLevel;
};

export function idleSnapshot(
  script: IsolationScript,
  level: IsolationLevel
): IsolationSnapshot {
  const run = simulate(script, level);
  return {
    scenario: {
      ...run.scenario,
      messages: [],
      notes: initialNotes(script),
      events: [],
      spans: [],
    },
    fromNow: 0,
    toNow: 0,
    caption: script.summary,
    highlightActorIds: [],
    highlightMessageIds: [],
    records: script.records.map((record) => ({
      id: record.id,
      label: record.label,
      committed: record.value,
      dirty: null,
      unit: record.unit,
    })),
    outcome: null,
    level,
  };
}

function initialNotes(script: IsolationScript) {
  return script.records.map((record, index) => ({
    id: `idle-note-${index}`,
    actorId: record.id,
    at: 0,
    text:
      record.unit === "bool"
        ? `${record.label} = ${record.value ? "on call" : "off"}`
        : `${record.label} = ${record.value}`,
  }));
}

export function buildIsolationSteps(
  script: IsolationScript,
  level: IsolationLevel
): AnimationStep<IsolationSnapshot>[] {
  const run = simulate(script, level);
  const steps: AnimationStep<IsolationSnapshot>[] = [];
  let fromNow = 0;

  const timed = run.beats.filter((beat) => beat.now > 0);
  const source = timed.length > 0 ? timed : run.beats;
  const beats: IsolationBeat[] = source.filter((beat, index, all) => {
    if (index === 0) return true;
    return beat.now > all[index - 1].now;
  });

  beats.forEach((beat, index) => {
    const last = index === beats.length - 1;
    steps.push({
      label: beat.caption,
      durationMs: last ? TX_HOLD_MS : TX_STEP_MS,
      snapshot: {
        scenario: run.scenario,
        fromNow,
        toNow: beat.now,
        caption: beat.caption,
        highlightActorIds: beat.highlightActorIds,
        highlightMessageIds: beat.highlightMessageIds,
        records: beat.records,
        outcome: last ? run.outcome : null,
        level,
      },
    });
    fromNow = beat.now;
  });

  return steps;
}
