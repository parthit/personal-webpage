"use client";

import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { useAnimationPlayer } from "@/components/animation/useAnimationPlayer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FORKLIFT_SCENE,
  speedupFactor,
  type Detection,
} from "@/lib/vision-compare/model";
import {
  VISION_STEP_MS,
  buildVisionCompareSteps,
  idleVisionSnapshot,
  type VisionCompareSnapshot,
} from "@/lib/vision-compare/frames";
import { figureShell } from "./replication/ReplicaCard";

function LatencyMeter({
  label,
  progress,
  latencyMs,
  accent,
}: {
  label: string;
  progress: number;
  latencyMs: number;
  accent: string;
}) {
  return (
    <div className="space-y-1" data-latency-meter={label}>
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>{label}</span>
        <span className="tabular-nums font-mono">
          {progress >= 1 ? `${latencyMs} ms` : `${Math.round(progress * latencyMs)} ms`}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
        <div
          className={cn("h-full rounded transition-[width] duration-500", accent)}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function CameraPane({
  title,
  detections,
  accentBorder,
  dimmed,
}: {
  title: string;
  detections: Detection[];
  accentBorder: string;
  dimmed?: boolean;
}) {
  const byId = new Map(detections.map((d) => [d.objectId, d]));

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-slate-900 text-slate-100",
        accentBorder,
        dimmed ? "opacity-70" : null
      )}
      data-camera-pane={title}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-300">
        <span>{title}</span>
        <span className="font-mono text-slate-400">cam-03</span>
      </div>
      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
        {/* aisle floor cue */}
        <div className="absolute inset-x-[12%] bottom-[8%] top-[55%] rounded-sm bg-slate-700/40" />
        <div className="absolute left-[10%] right-[10%] top-[52%] h-px bg-amber-400/30" />

        {FORKLIFT_SCENE.objects.map((obj) => {
          const hit = byId.get(obj.id);
          return (
            <div
              key={obj.id}
              data-scene-object={obj.id}
              data-detected={hit ? "true" : "false"}
              className={cn(
                "absolute rounded border-2 transition-all duration-500",
                hit
                  ? "border-emerald-400 bg-emerald-400/20 shadow-[0_0_0_1px_rgba(52,211,153,0.35)]"
                  : "border-white/20 bg-white/5"
              )}
              style={{
                left: `${obj.box.x}%`,
                top: `${obj.box.y}%`,
                width: `${obj.box.w}%`,
                height: `${obj.box.h}%`,
              }}
            >
              <span
                className={cn(
                  "absolute -top-5 left-0 max-w-[9rem] truncate rounded px-1 py-0.5 text-[10px] font-medium",
                  hit
                    ? "bg-emerald-400 text-emerald-950"
                    : "bg-black/50 text-slate-300"
                )}
              >
                {hit ? `${hit.label} ${(hit.confidence * 100).toFixed(0)}%` : obj.label}
              </span>
            </div>
          );
        })}

        <div className="absolute bottom-2 left-2 right-2 rounded bg-black/55 px-2 py-1 text-[10px] text-slate-200">
          {FORKLIFT_SCENE.prompt}
        </div>
      </div>
    </div>
  );
}

export function VisionVsVlmDemo() {
  const playback = useAnimationPlayer<VisionCompareSnapshot>(
    {
      snapshot: idleVisionSnapshot(),
      label:
        "Run both paths to compare specialized detector latency against a VLM.",
    },
    VISION_STEP_MS
  );
  const snapshot = playback.current.snapshot;
  const busy = playback.isActive;
  const speedup = speedupFactor();

  return (
    <figure className={figureShell} data-vision-vs-vlm-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Same frame, two stacks — specialized detector vs vision-language model
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void playback.run(buildVisionCompareSteps())}
          >
            Run both paths
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              playback.reset({
                snapshot: idleVisionSnapshot(),
                label: "Reset — run both paths again when ready.",
              })
            }
          >
            Reset
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <LatencyMeter
            label="Specialized"
            progress={snapshot.yoloProgress}
            latencyMs={FORKLIFT_SCENE.yolo.latencyMs}
            accent="bg-teal-500 dark:bg-teal-400"
          />
          <LatencyMeter
            label="VLM"
            progress={snapshot.vlmProgress}
            latencyMs={FORKLIFT_SCENE.vlm.latencyMs}
            accent="bg-indigo-500 dark:bg-indigo-400"
          />
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400" data-speedup-callout>
          Assumed fixture: {FORKLIFT_SCENE.yolo.latencyMs}ms vs{" "}
          {FORKLIFT_SCENE.vlm.latencyMs}ms ≈ <strong>{speedup}×</strong> faster
          specialized path, accuracy within ~
          {Math.round(
            (FORKLIFT_SCENE.vlm.accuracy - FORKLIFT_SCENE.yolo.accuracy) * 100
          )}
          pp.
        </p>
        {busy ? (
          <p
            className="text-xs font-medium text-amber-700 dark:text-amber-300"
            aria-live="polite"
          >
            Animating — step {playback.index + 1} of {playback.steps.length}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-2">
        <CameraPane
          title="Specialized detector"
          detections={snapshot.yoloDetections}
          accentBorder="border-teal-500/40"
          dimmed={snapshot.active === "vlm"}
        />
        <CameraPane
          title="Vision-language model"
          detections={snapshot.vlmDetections}
          accentBorder="border-indigo-500/40"
          dimmed={snapshot.active === "yolo"}
        />
      </div>

      <AnimationPlayer player={playback} title="Vision comparison timeline" />

      <p
        className="border-t border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-800 sm:px-4 dark:border-gray-700 dark:text-gray-200"
        data-vision-compare-status
        aria-live="polite"
      >
        {snapshot.message}
      </p>
    </figure>
  );
}
