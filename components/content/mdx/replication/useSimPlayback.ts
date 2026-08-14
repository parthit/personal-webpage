"use client";

import { useRef } from "react";
import { useAnimationPlayer } from "@/components/animation/useAnimationPlayer";
import { REPL_HOLD_MS, REPL_STEP_MS } from "@/lib/replication/animation";
import type { Replica } from "@/lib/replication/model";
import type { SimFrame } from "@/lib/replication/model";

export type FrameView = {
  replicas: Replica[];
  message: string;
  highlightIds: string[];
  kind: SimFrame["kind"];
  fromId?: string;
  toId?: string;
  clientWaiting: boolean;
  clientAcked: boolean;
  readValue?: string;
  stale?: boolean;
  linkBroken?: boolean;
  stepInfo: { index: number; total: number } | null;
};

export function viewFromReplicas(
  replicas: Replica[],
  message: string
): FrameView {
  return {
    replicas,
    message,
    highlightIds: [],
    kind: "idle",
    clientWaiting: false,
    clientAcked: false,
    stepInfo: null,
  };
}

export function useSimPlayback(initial: Replica[], idleMessage: string) {
  const player = useAnimationPlayer(
    {
      snapshot: viewFromReplicas(initial, idleMessage),
      label: idleMessage,
      durationMs: REPL_STEP_MS,
    },
    REPL_STEP_MS
  );
  const replicasRef = useRef(initial);
  replicasRef.current = player.latest.snapshot.replicas;

  function reset(replicas: Replica[], message: string) {
    replicasRef.current = replicas;
    player.reset({
      snapshot: viewFromReplicas(replicas, message),
      label: message,
      durationMs: REPL_STEP_MS,
    });
  }

  async function run(
    frames: SimFrame[],
    decorate?: (frame: SimFrame, index: number) => Partial<FrameView>
  ): Promise<boolean> {
    if (frames.length === 0) return false;
    return player.run(
      frames.map((frame, index) => ({
        snapshot: {
            replicas: frame.replicas,
            message: frame.message,
            highlightIds: frame.highlightIds,
            kind: frame.kind,
            fromId: frame.fromId,
            toId: frame.toId,
            clientWaiting: frame.clientWaiting,
            clientAcked: frame.clientAcked,
            readValue: frame.readValue,
            stale: frame.stale,
            ...decorate?.(frame, index),
            stepInfo: { index: index + 1, total: frames.length },
          },
        label: frame.message,
        durationMs:
          index === frames.length - 1 ? REPL_HOLD_MS : REPL_STEP_MS,
        group: frame.kind,
      }))
    );
  }

  return {
    view: player.current.snapshot,
    busy: player.isActive,
    replicasRef,
    run,
    reset,
    cancel: player.pause,
    playback: player,
  };
}
