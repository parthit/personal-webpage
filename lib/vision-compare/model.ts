/**
 * Toy comparison model: specialized detector vs vision-language model.
 * Latency and accuracy figures are illustrative blog assumptions.
 */

export type DetectorKind = "yolo" | "vlm";

export type SceneObject = {
  id: string;
  label: string;
  /** Ground truth — is this what the user asked to find? */
  isTarget: boolean;
  box: { x: number; y: number; w: number; h: number };
};

export type Detection = {
  objectId: string;
  label: string;
  confidence: number;
  /** When the box appears in the animation timeline (ms from start) */
  appearAtMs: number;
};

export type DetectorProfile = {
  kind: DetectorKind;
  name: string;
  /** End-to-end latency for one frame */
  latencyMs: number;
  /** Approx accuracy on this toy scenario */
  accuracy: number;
  detections: Detection[];
};

export type VisionScene = {
  prompt: string;
  objects: SceneObject[];
  yolo: DetectorProfile;
  vlm: DetectorProfile;
};

/** Warehouse aisle — user asked to find forklifts in the camera feed. */
export const FORKLIFT_SCENE: VisionScene = {
  prompt: 'Find: "forklift in aisle"',
  objects: [
    {
      id: "forklift",
      label: "forklift",
      isTarget: true,
      box: { x: 18, y: 38, w: 28, h: 42 },
    },
    {
      id: "pallet",
      label: "pallet",
      isTarget: false,
      box: { x: 52, y: 58, w: 22, h: 18 },
    },
    {
      id: "worker",
      label: "person",
      isTarget: false,
      box: { x: 72, y: 40, w: 14, h: 36 },
    },
  ],
  yolo: {
    kind: "yolo",
    name: "Specialized detector (YOLO-class)",
    latencyMs: 28,
    accuracy: 0.84,
    detections: [
      {
        objectId: "forklift",
        label: "forklift",
        confidence: 0.91,
        appearAtMs: 28,
      },
    ],
  },
  vlm: {
    kind: "vlm",
    name: "Vision-language model",
    latencyMs: 840,
    accuracy: 0.86,
    detections: [
      {
        objectId: "forklift",
        label: "forklift in aisle",
        confidence: 0.88,
        appearAtMs: 720,
      },
      {
        objectId: "pallet",
        label: "wooden pallet",
        confidence: 0.61,
        appearAtMs: 780,
      },
    ],
  },
};

export function speedupFactor(scene: VisionScene = FORKLIFT_SCENE): number {
  return Math.round(scene.vlm.latencyMs / scene.yolo.latencyMs);
}

export function accuracyDeltaPp(scene: VisionScene = FORKLIFT_SCENE): number {
  return Math.round((scene.vlm.accuracy - scene.yolo.accuracy) * 100);
}
