import type { AnimationStep } from "@/lib/animation/core";
import type { SequenceScenario } from "@/lib/animation/sequence";
import {
  simulate,
  type IsolationBeat,
  type IsolationLevel,
  type IsolationRun,
  type IsolationScript,
} from "./model";

export const TX_MIN_STEP_MS = 900;
export const TX_MAX_STEP_MS = 2400;
export const TX_HOLD_MS = 2600;

export type IsolationSnapshot = {
  scenario: SequenceScenario;
  beats: IsolationBeat[];
  summary: string;
  started: boolean;
  fromNow: number;
  toNow: number;
  outcome: string;
  settled: boolean;
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
      intervals: [],
    },
    beats: run.beats,
    summary: script.summary,
    started: false,
    fromNow: 0,
    toNow: 0,
    outcome: run.outcome,
    settled: false,
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

  beats.forEach((beat) => {
    const delta = beat.now - fromNow;
    steps.push({
      label: beat.caption,
      durationMs: sequenceDwellMs(delta),
      snapshot: {
        scenario: run.scenario,
        beats: run.beats,
        summary: script.summary,
        started: true,
        fromNow,
        toNow: beat.now,
        outcome: run.outcome,
        settled: false,
        level,
      },
    });
    fromNow = beat.now;
  });

  steps.push({
    label: run.outcome,
    durationMs: TX_HOLD_MS,
    snapshot: {
      scenario: run.scenario,
      beats: run.beats,
      summary: script.summary,
      started: true,
      fromNow,
      toNow: fromNow,
      outcome: run.outcome,
      settled: true,
      level,
    },
  });

  return steps;
}

/** Preserve relative time without making tiny hops unreadably fast. */
export function sequenceDwellMs(delta: number): number {
  if (delta <= 0) return TX_HOLD_MS;
  return Math.min(
    TX_MAX_STEP_MS,
    Math.max(TX_MIN_STEP_MS, Math.round(delta * 1000))
  );
}

export function isolationPresentationAt(
  run: Pick<IsolationRun, "beats" | "outcome"> & {
    summary?: string;
    started?: boolean;
  },
  now: number,
  settled = false
): IsolationBeat & { outcome: string | null } {
  let current = run.beats[0];
  for (const beat of run.beats) {
    if (beat.now > now + 1e-9) break;
    current = beat;
  }
  if (run.started === false) {
    return {
      ...current,
      caption: run.summary ?? current.caption,
      highlightActorIds: [],
      highlightMessageIds: [],
      outcome: null,
    };
  }
  return {
    ...current,
    outcome: settled ? run.outcome : null,
  };
}
