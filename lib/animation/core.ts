export type PlaybackStatus = "idle" | "playing" | "paused" | "complete";

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
