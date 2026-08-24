import type { AnimationStep } from "@/lib/animation/core";
import {
  FORKLIFT_SCENE,
  type DetectorKind,
  type Detection,
  type VisionScene,
} from "./model";

export const VISION_STEP_MS = 700;
export const VISION_HOLD_MS = 1100;

export type VisionPhase =
  | "idle"
  | "frame"
  | "running"
  | "result"
  | "compare"
  | "done";

export type VisionCompareSnapshot = {
  phase: VisionPhase;
  active: DetectorKind | "both" | null;
  /** 0–1 fill for latency meters */
  yoloProgress: number;
  vlmProgress: number;
  yoloDetections: Detection[];
  vlmDetections: Detection[];
  elapsedMs: number;
  message: string;
};

export function idleVisionSnapshot(): VisionCompareSnapshot {
  return {
    phase: "idle",
    active: null,
    yoloProgress: 0,
    vlmProgress: 0,
    yoloDetections: [],
    vlmDetections: [],
    elapsedMs: 0,
    message:
      "Same camera frame, same user prompt. Run both paths to compare latency and what each model returns.",
  };
}

export function buildVisionCompareSteps(
  scene: VisionScene = FORKLIFT_SCENE
): AnimationStep<VisionCompareSnapshot>[] {
  const steps: AnimationStep<VisionCompareSnapshot>[] = [];
  const speedup = Math.round(scene.vlm.latencyMs / scene.yolo.latencyMs);

  steps.push({
    label: "Load camera frame + user prompt",
    durationMs: VISION_STEP_MS,
    snapshot: {
      phase: "frame",
      active: null,
      yoloProgress: 0,
      vlmProgress: 0,
      yoloDetections: [],
      vlmDetections: [],
      elapsedMs: 0,
      message: `Prompt: ${scene.prompt}. Ground truth: one forklift, plus distractors.`,
    },
  });

  // Specialized path finishes almost immediately
  steps.push({
    label: "Specialized detector starts",
    durationMs: VISION_STEP_MS,
    snapshot: {
      phase: "running",
      active: "yolo",
      yoloProgress: 0.35,
      vlmProgress: 0.04,
      yoloDetections: [],
      vlmDetections: [],
      elapsedMs: 10,
      message:
        "Specialized model runs a fixed head over the frame. No token generation — just boxes + class scores.",
    },
  });

  steps.push({
    label: `Specialized result @ ${scene.yolo.latencyMs}ms`,
    durationMs: VISION_HOLD_MS,
    snapshot: {
      phase: "result",
      active: "yolo",
      yoloProgress: 1,
      vlmProgress: 0.08,
      yoloDetections: scene.yolo.detections,
      vlmDetections: [],
      elapsedMs: scene.yolo.latencyMs,
      message: `Specialized detector returns the forklift in ${scene.yolo.latencyMs}ms (assumed). Ready for the next frame.`,
    },
  });

  steps.push({
    label: "VLM still generating…",
    durationMs: VISION_STEP_MS,
    snapshot: {
      phase: "running",
      active: "vlm",
      yoloProgress: 1,
      vlmProgress: 0.45,
      yoloDetections: scene.yolo.detections,
      vlmDetections: [],
      elapsedMs: 380,
      message:
        "VLM encodes the image, conditions on the prompt, and decodes text/boxes. Great flexibility; higher latency.",
    },
  });

  steps.push({
    label: `VLM result @ ${scene.vlm.latencyMs}ms`,
    durationMs: VISION_HOLD_MS,
    snapshot: {
      phase: "result",
      active: "vlm",
      yoloProgress: 1,
      vlmProgress: 1,
      yoloDetections: scene.yolo.detections,
      vlmDetections: scene.vlm.detections,
      elapsedMs: scene.vlm.latencyMs,
      message: `VLM finishes in ${scene.vlm.latencyMs}ms (assumed). It also narrates a non-target pallet — more recall, more noise.`,
    },
  });

  steps.push({
    label: "Compare latency × accuracy",
    durationMs: VISION_HOLD_MS,
    snapshot: {
      phase: "compare",
      active: "both",
      yoloProgress: 1,
      vlmProgress: 1,
      yoloDetections: scene.yolo.detections,
      vlmDetections: scene.vlm.detections,
      elapsedMs: scene.vlm.latencyMs,
      message: `~${speedup}× faster specialized path, similar accuracy on a closed vocabulary. Use VLMs to invent labels; distill to detectors for real-time loops.`,
    },
  });

  steps.push({
    label: "Rule of thumb",
    durationMs: VISION_HOLD_MS,
    snapshot: {
      phase: "done",
      active: "both",
      yoloProgress: 1,
      vlmProgress: 1,
      yoloDetections: scene.yolo.detections,
      vlmDetections: scene.vlm.detections,
      elapsedMs: scene.vlm.latencyMs,
      message:
        "Open vocabulary or one-off questions → VLM. Fixed scenarios at camera rate → specialized detector (+ synthetic data).",
    },
  });

  return steps;
}
