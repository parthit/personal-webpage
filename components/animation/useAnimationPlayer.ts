"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  appendSteps,
  clampStep,
  type AnimationStep,
  type AnimationTimeline,
  type PlaybackStatus,
} from "@/lib/animation/core";

export type AnimationPlayer<T> = {
  steps: AnimationStep<T>[];
  index: number;
  current: AnimationStep<T>;
  latest: AnimationStep<T>;
  status: PlaybackStatus;
  isActive: boolean;
  canStepBackward: boolean;
  canStepForward: boolean;
  run: (steps: AnimationStep<T>[]) => Promise<boolean>;
  play: () => void;
  pause: () => void;
  seek: (index: number) => void;
  stepBackward: () => void;
  stepForward: () => void;
  reset: (step: AnimationStep<T>) => void;
};

export function useAnimationPlayer<T>(
  initialStep: AnimationStep<T>,
  defaultDurationMs: number
): AnimationPlayer<T> {
  const [timeline, setTimeline] = useState<AnimationTimeline<T>>({
    steps: [initialStep],
    index: 0,
  });
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const timelineRef = useRef(timeline);
  const statusRef = useRef(status);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionRef = useRef<((completed: boolean) => void) | null>(null);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const resolveRun = useCallback((completed: boolean) => {
    completionRef.current?.(completed);
    completionRef.current = null;
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const step = timeline.steps[timeline.index];
    if (!step) return;

    clearTimer();
    timerRef.current = setTimeout(() => {
      const current = timelineRef.current;
      if (current.index < current.steps.length - 1) {
        setTimeline({ ...current, index: current.index + 1 });
      } else {
        setStatus("complete");
        resolveRun(true);
      }
    }, step.durationMs ?? defaultDurationMs);

    return clearTimer;
  }, [
    clearTimer,
    defaultDurationMs,
    resolveRun,
    status,
    timeline.index,
    timeline.steps,
  ]);

  useEffect(
    () => () => {
      clearTimer();
      resolveRun(false);
    },
    [clearTimer, resolveRun]
  );

  const run = useCallback(
    (steps: AnimationStep<T>[]): Promise<boolean> => {
      if (steps.length === 0) return Promise.resolve(false);
      clearTimer();
      resolveRun(false);

      const next = appendSteps(timelineRef.current, steps);
      timelineRef.current = next;
      setTimeline(next);
      setStatus("playing");

      return new Promise<boolean>((resolve) => {
        completionRef.current = resolve;
      });
    },
    [clearTimer, resolveRun]
  );

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    clearTimer();
    setStatus("paused");
  }, [clearTimer]);

  const play = useCallback(() => {
    const current = timelineRef.current;
    if (
      current.index >= current.steps.length - 1 &&
      statusRef.current !== "paused"
    ) {
      return;
    }
    setStatus("playing");
  }, []);

  const seek = useCallback(
    (index: number) => {
      clearTimer();
      const current = timelineRef.current;
      const next = {
        ...current,
        index: clampStep(index, current.steps.length),
      };
      timelineRef.current = next;
      setTimeline(next);
      if (statusRef.current === "playing") setStatus("paused");
    },
    [clearTimer]
  );

  const stepBackward = useCallback(() => {
    seek(timelineRef.current.index - 1);
  }, [seek]);

  const stepForward = useCallback(() => {
    seek(timelineRef.current.index + 1);
  }, [seek]);

  const reset = useCallback(
    (step: AnimationStep<T>) => {
      clearTimer();
      resolveRun(false);
      const next = { steps: [step], index: 0 };
      timelineRef.current = next;
      setTimeline(next);
      setStatus("idle");
    },
    [clearTimer, resolveRun]
  );

  return useMemo(() => {
    const current = timeline.steps[timeline.index] ?? timeline.steps[0];
    const latest = timeline.steps[timeline.steps.length - 1];
    return {
      steps: timeline.steps,
      index: timeline.index,
      current,
      latest,
      status,
      isActive: status === "playing" || status === "paused",
      canStepBackward: timeline.index > 0,
      canStepForward: timeline.index < timeline.steps.length - 1,
      run,
      play,
      pause,
      seek,
      stepBackward,
      stepForward,
      reset,
    };
  }, [
    pause,
    play,
    reset,
    run,
    seek,
    status,
    stepBackward,
    stepForward,
    timeline,
  ]);
}
