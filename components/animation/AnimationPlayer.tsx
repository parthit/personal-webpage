"use client";

import { History, Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { AnimationPlayer as AnimationPlayerState } from "./useAnimationPlayer";

export function AnimationPlayer<T>({
  player,
  title = "Animation timeline",
}: {
  player: AnimationPlayerState<T>;
  title?: string;
}) {
  const atEnd = player.index === player.steps.length - 1;
  const playing = player.status === "playing";

  return (
    <section
      className="border-t border-gray-200 bg-white/70 px-3 py-3 sm:px-4 dark:border-gray-700 dark:bg-gray-950/40"
      aria-label={title}
      data-animation-player
      data-playback-status={player.status}
      data-playback-index={player.index}
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
          <RotateCcw className="h-3.5 w-3.5" />
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
          disabled={!playing && atEnd}
          aria-label={playing ? "Pause animation" : "Play animation"}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" />
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
          aria-live="polite"
          data-animation-step-count
        >
          {player.index + 1} / {player.steps.length}
        </span>
      </div>

      <details className="group mt-3" open>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-gray-600 marker:hidden dark:text-gray-300">
          <History className="h-3.5 w-3.5" />
          Step history
          <span className="text-gray-400">({player.steps.length})</span>
        </summary>
        <ol
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
