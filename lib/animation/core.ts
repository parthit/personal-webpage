export type PlaybackStatus = "idle" | "playing" | "paused" | "complete";

/**
 * Viewer-controlled pacing. Teaching demos ship at 1x on purpose; the other
 * rates exist so a reader can slow a dense walkthrough down or skim a
 * walkthrough they have already seen.
 */
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export function scaleDuration(durationMs: number, rate: PlaybackRate): number {
  if (durationMs <= 0) return 0;
  return Math.max(1, Math.round(durationMs / rate));
}

/**
 * Sample a continuous axis (a sequence-diagram playhead, a packet's path)
 * between two snapshots. Snapshots stay complete; the renderer lerps.
 */
export function lerp(from: number, to: number, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return from + (to - from) * clamped;
}

/**
 * Playhead for a step that moves along a shared time axis. Reduced motion
 * jumps to the step's settled time so the lesson is still on screen.
 */
export function visiblePlayhead(
  from: number,
  to: number,
  progress: number,
  reducedMotion = false
): number {
  if (reducedMotion) return to;
  return lerp(from, to, progress);
}

/**
 * `stepProgress` on the player is sampled at pause / seek / rate / step
 * boundaries, not every frame. Views that draw a continuous axis (sequence
 * playheads, growing arrows) add elapsed playback time on top of that sample.
 */
export function liveStepProgress(
  sampledProgress: number,
  elapsedMs: number,
  durationMs: number,
  playing: boolean
): number {
  if (!playing) {
    return Math.min(1, Math.max(0, sampledProgress));
  }
  return advanceDwell(sampledProgress, elapsedMs, durationMs);
}

/**
 * How much of a step's dwell has been served, tracked as a fraction rather than
 * milliseconds so a mid-step speed change rescales what is left instead of
 * restarting or overshooting it.
 */
export function advanceDwell(
  progress: number,
  spentMs: number,
  durationMs: number
): number {
  if (durationMs <= 0) return 1;
  const next = progress + spentMs / durationMs;
  return Math.min(1, Math.max(0, next));
}

/** What a resumed step still owes, so pausing does not extend it. */
export function remainingDwellMs(durationMs: number, progress: number): number {
  if (durationMs <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.max(0, Math.round(durationMs * (1 - clamped)));
}

/**
 * A CSS clock for motion that spans a step's dwell: how long the animation runs
 * and how far into it to start. Applied as a negative `animation-delay` on an
 * element keyed by these values, it picks up wherever the step timer is instead
 * of restarting on a pause, a resume, or a speed change.
 */
export function dwellClock(
  stepDurationMs: number,
  progress: number,
  animationDurationMs: number = stepDurationMs
): { durationMs: number; delayMs: number } {
  const clamped = Math.min(1, Math.max(0, progress));
  return {
    durationMs: Math.max(1, Math.round(animationDurationMs)),
    delayMs: Math.max(0, Math.round(Math.max(0, stepDurationMs) * clamped)),
  };
}

export type AnimationStep<T> = {
  snapshot: T;
  label: string;
  durationMs?: number;
  group?: string;
};

export type AnimationTimeline<T> = {
  steps: AnimationStep<T>[];
  index: number;
};

export function clampStep(index: number, length: number): number {
  if (length <= 0) return -1;
  return Math.min(Math.max(Math.round(index), 0), length - 1);
}

export function appendSteps<T>(
  timeline: AnimationTimeline<T>,
  steps: AnimationStep<T>[]
): AnimationTimeline<T> {
  if (steps.length === 0) return timeline;
  return {
    steps: [...timeline.steps, ...steps],
    index: timeline.steps.length,
  };
}

export function seekTimeline<T>(
  timeline: AnimationTimeline<T>,
  index: number
): AnimationTimeline<T> {
  return { ...timeline, index: clampStep(index, timeline.steps.length) };
}

export function visibleHistory<T>(timeline: AnimationTimeline<T>): {
  past: AnimationStep<T>[];
  current: AnimationStep<T> | null;
  future: AnimationStep<T>[];
} {
  if (timeline.index < 0) {
    return { past: [], current: null, future: timeline.steps };
  }
  return {
    past: timeline.steps.slice(0, timeline.index),
    current: timeline.steps[timeline.index] ?? null,
    future: timeline.steps.slice(timeline.index + 1),
  };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function reducedMotionSubscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function getReducedMotionSnapshot(): boolean {
  return prefersReducedMotion();
}

export function getReducedMotionServerSnapshot(): boolean {
  return false;
}
