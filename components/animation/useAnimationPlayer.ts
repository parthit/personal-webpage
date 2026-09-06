"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  advanceDwell,
  appendSteps,
  clampStep,
  remainingDwellMs,
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
  /**
   * Fraction of the current step's dwell already served, sampled at the last
   * playback change. Views that animate in CSS start from here (a negative
   * `animation-delay`) so their clock matches the step timer through a pause,
   * a resume, or a speed change.
   */
  stepProgress: number;
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
  const [stepProgress, setStepProgress] = useState(0);
  const timelineRef = useRef(timeline);
  const statusRef = useRef(status);
  const rateRef = useRef(rate);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionRef = useRef<((completed: boolean) => void) | null>(null);
  const progressRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const stepDwellRef = useRef(0);

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

  /** Fold the time spent playing into the current step's served fraction. */
  const commitDwell = useCallback(() => {
    const startedAt = startedAtRef.current;
    startedAtRef.current = null;
    if (startedAt === null) return;
    progressRef.current = advanceDwell(
      progressRef.current,
      Date.now() - startedAt,
      stepDwellRef.current
    );
  }, []);

  const setDwell = useCallback((progress: number) => {
    progressRef.current = progress;
    startedAtRef.current = null;
    setStepProgress(progress);
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
    const dwellMs = scaleDuration(step.durationMs ?? defaultDurationMs, rate);
    stepDwellRef.current = dwellMs;
    startedAtRef.current = Date.now();
    // Every transition publishes before it renders; this only backstops a ref
    // that moved without one, so the timer and the CSS clocks cannot drift.
    setStepProgress(progressRef.current);

    timerRef.current = setTimeout(
      () => {
        const current = timelineRef.current;
        if (current.index < current.steps.length - 1) {
          setDwell(0);
          setTimeline({ ...current, index: current.index + 1 });
        } else {
          setDwell(1);
          setStatus("complete");
          resolveRun(true);
        }
      },
      remainingDwellMs(dwellMs, progressRef.current)
    );

    return () => {
      clearTimer();
      commitDwell();
    };
  }, [
    clearTimer,
    commitDwell,
    defaultDurationMs,
    rate,
    resolveRun,
    setDwell,
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
      setDwell(0);
      setTimeline(next);
      setStatus("playing");

      return new Promise<boolean>((resolve) => {
        completionRef.current = resolve;
      });
    },
    [clearTimer, resolveRun, setDwell]
  );

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    clearTimer();
    commitDwell();
    setStepProgress(progressRef.current);
    setStatus("paused");
  }, [clearTimer, commitDwell]);

  /**
   * Settle the served fraction before the new rate renders. Publishing it later
   * would let the figures paint one frame rewound to the start of the step.
   */
  const changeRate = useCallback(
    (next: PlaybackRate) => {
      if (next === rateRef.current) return;
      clearTimer();
      commitDwell();
      setStepProgress(progressRef.current);
      setRate(next);
    },
    [clearTimer, commitDwell]
  );

  const seekTo = useCallback(
    (index: number, nextStatus?: PlaybackStatus) => {
      clearTimer();
      const current = timelineRef.current;
      const next = {
        ...current,
        index: clampStep(index, current.steps.length),
      };
      timelineRef.current = next;
      // Landing on a step by hand shows it from the start of its dwell.
      setDwell(0);
      setTimeline(next);
      if (nextStatus) {
        setStatus(nextStatus);
      } else if (statusRef.current === "playing") {
        setStatus("paused");
      }
    },
    [clearTimer, setDwell]
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
      setDwell(0);
      setTimeline(next);
      setStatus("idle");
    },
    [clearTimer, resolveRun, setDwell]
  );

  return useMemo<AnimationPlayer<T>>(() => {
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
      stepProgress,
      run,
      play,
      pause,
      replay,
      setRate: changeRate,
      seek,
      stepBackward,
      stepForward,
      reset,
    };
  }, [
    changeRate,
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
    stepProgress,
    timeline,
  ]);
}
