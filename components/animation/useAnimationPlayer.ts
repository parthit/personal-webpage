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
  scaleDuration,
  type AnimationStep,
  type AnimationTimeline,
  type PlaybackRate,
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
  atEnd: boolean;
  rate: PlaybackRate;
  /** Dwell of the current step at the selected rate, in ms. */
  currentDurationMs: number;
  run: (steps: AnimationStep<T>[]) => Promise<boolean>;
  play: () => void;
  pause: () => void;
  replay: () => void;
  setRate: (rate: PlaybackRate) => void;
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
  const [rate, setRate] = useState<PlaybackRate>(1);
  const timelineRef = useRef(timeline);
  const statusRef = useRef(status);
  const rateRef = useRef(rate);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionRef = useRef<((completed: boolean) => void) | null>(null);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

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
    timerRef.current = setTimeout(
      () => {
        const current = timelineRef.current;
        if (current.index < current.steps.length - 1) {
          setTimeline({ ...current, index: current.index + 1 });
        } else {
          setStatus("complete");
          resolveRun(true);
        }
      },
      scaleDuration(step.durationMs ?? defaultDurationMs, rate)
    );

    return clearTimer;
  }, [
    clearTimer,
    defaultDurationMs,
    rate,
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

  const seekTo = useCallback(
    (index: number, nextStatus?: PlaybackStatus) => {
      clearTimer();
      const current = timelineRef.current;
      const next = {
        ...current,
        index: clampStep(index, current.steps.length),
      };
      timelineRef.current = next;
      setTimeline(next);
      if (nextStatus) {
        setStatus(nextStatus);
      } else if (statusRef.current === "playing") {
        setStatus("paused");
      }
    },
    [clearTimer]
  );

  /**
   * Replaying from the top is the way out of a finished timeline. Without it the
   * play button dead-ends once the last step lands.
   */
  const replay = useCallback(() => {
    if (timelineRef.current.steps.length <= 1) return;
    seekTo(0, "playing");
  }, [seekTo]);

  const play = useCallback(() => {
    const current = timelineRef.current;
    if (current.index >= current.steps.length - 1) {
      replay();
      return;
    }
    setStatus("playing");
  }, [replay]);

  const seek = useCallback((index: number) => seekTo(index), [seekTo]);

  const stepBackward = useCallback(() => {
    seekTo(timelineRef.current.index - 1);
  }, [seekTo]);

  const stepForward = useCallback(() => {
    seekTo(timelineRef.current.index + 1);
  }, [seekTo]);

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
      atEnd: timeline.index >= timeline.steps.length - 1,
      rate,
      currentDurationMs: scaleDuration(
        current?.durationMs ?? defaultDurationMs,
        rate
      ),
      run,
      play,
      pause,
      replay,
      setRate,
      seek,
      stepBackward,
      stepForward,
      reset,
    };
  }, [
    defaultDurationMs,
    pause,
    play,
    rate,
    replay,
    reset,
    run,
    seek,
    status,
    stepBackward,
    stepForward,
    timeline,
  ]);
}
