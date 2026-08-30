"use client";

import { useEffect, useRef } from "react";
import {
  History,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  StepBack,
  StepForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { PLAYBACK_RATES, type PlaybackRate } from "@/lib/animation/core";
import { cn } from "@/lib/utils";
import type { AnimationPlayer as AnimationPlayerState } from "./useAnimationPlayer";

const RATE_OPTIONS = PLAYBACK_RATES.map((rate) => ({
  value: String(rate),
  label: `${rate}×`,
}));

const STATUS_COPY: Record<
  AnimationPlayerState<unknown>["status"],
  { text: string; dot: string }
> = {
  idle: { text: "Ready", dot: "bg-gray-400 dark:bg-gray-500" },
  playing: {
    text: "Playing",
    dot: "bg-amber-500 motion-safe:animate-pulse dark:bg-amber-400",
  },
  paused: { text: "Paused", dot: "bg-sky-500 dark:bg-sky-400" },
  complete: { text: "Finished", dot: "bg-emerald-500 dark:bg-emerald-400" },
};

export function AnimationPlayer<T>({
  player,
  title = "Animation timeline",
}: {
  player: AnimationPlayerState<T>;
  title?: string;
}) {
  const playing = player.status === "playing";
  const hasTimeline = player.steps.length > 1;
  const showReplay = hasTimeline && !playing && player.atEnd;
  const historyRef = useRef<HTMLOListElement | null>(null);
  const status = STATUS_COPY[player.status];

  // Long walkthroughs overflow the history box; keep the active step in view so
  // the list stays a readable transcript instead of scrolling away from you.
  useEffect(() => {
    const list = historyRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[aria-current="step"]');
    if (!active) return;
    // Rect deltas rather than offsetTop: the list is not the offset parent.
    const listBox = list.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    if (activeBox.top < listBox.top) {
      list.scrollTop -= listBox.top - activeBox.top;
    } else if (activeBox.bottom > listBox.bottom) {
      list.scrollTop += activeBox.bottom - listBox.bottom;
    }
  }, [player.index, player.steps.length]);

  return (
    <section
      className="border-t border-gray-200 bg-white/70 px-3 py-3 sm:px-4 dark:border-gray-700 dark:bg-gray-950/40"
      aria-label={title}
      data-animation-player
      data-playback-status={player.status}
      data-playback-index={player.index}
      data-playback-rate={player.rate}
      data-playback-at-end={player.atEnd ? "true" : "false"}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={() => player.seek(0)}
          disabled={!player.canStepBackward}
          aria-label="Go to beginning"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={player.stepBackward}
          disabled={!player.canStepBackward}
          aria-label="Previous step"
        >
          <StepBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={playing ? player.pause : player.play}
          disabled={!hasTimeline}
          aria-label={
            playing
              ? "Pause animation"
              : showReplay
                ? "Replay animation"
                : "Play animation"
          }
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : showReplay ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={player.stepForward}
          disabled={!player.canStepForward}
          aria-label="Next step"
        >
          <StepForward className="h-3.5 w-3.5" />
        </Button>

        <div className="min-w-0 flex-1 px-1">
          <Slider
            min={0}
            max={Math.max(0, player.steps.length - 1)}
            step={1}
            value={[player.index]}
            onValueChange={([index]) => player.seek(index)}
            aria-label="Animation step"
            disabled={player.steps.length <= 1}
          />
        </div>
        <span
          className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400"
          data-animation-step-count
        >
          {player.index + 1} / {player.steps.length}
        </span>
      </div>

      {/* Dwell meter: how much of the current step's hold time is left. */}
      {hasTimeline ? (
        <div
          className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          aria-hidden="true"
        >
          <div
            key={`${player.index}-${player.steps.length}-${player.rate}`}
            data-animation-step-progress
            className="anim-step-progress h-full w-full rounded-full bg-amber-500 dark:bg-amber-400"
            style={{
              animationDuration: `${Math.max(player.currentDurationMs, 1)}ms`,
              animationPlayState: playing ? "running" : "paused",
            }}
          />
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {hasTimeline ? (
          <p
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300"
            aria-live="polite"
            data-playback-state-label
          >
            <span
              aria-hidden="true"
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dot)}
            />
            {status.text}
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Run an operation above and every step lands here — scrub, replay, or
            slow it down.
          </p>
        )}
        <SegmentedControl
          label="Speed"
          orientation="inline"
          size="sm"
          value={String(player.rate)}
          options={RATE_OPTIONS}
          onValueChange={(next) =>
            player.setRate(Number(next) as PlaybackRate)
          }
          data-testid="playback-rate"
        />
      </div>

      <details className="group mt-3" open>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-gray-600 marker:hidden dark:text-gray-300">
          <History className="h-3.5 w-3.5" />
          Step history
          <span className="text-gray-400">({player.steps.length})</span>
        </summary>
        <ol
          ref={historyRef}
          className="mt-2 max-h-32 space-y-1 overflow-y-auto overscroll-contain pr-1 text-xs"
          aria-label="Animation step history"
          data-animation-history
        >
          {player.steps.map((step, index) => {
            const active = index === player.index;
            const past = index < player.index;
            return (
              <li key={`${index}-${step.label}`}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors",
                    active
                      ? "bg-amber-100 font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100"
                      : past
                        ? "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        : "text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
                  )}
                  onClick={() => player.seek(index)}
                  aria-label={`Go to animation step ${index + 1}`}
                  aria-current={active ? "step" : undefined}
                  data-history-step={index}
                >
                  <span className="w-5 shrink-0 text-right tabular-nums">
                    {index + 1}.
                  </span>
                  <span>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
