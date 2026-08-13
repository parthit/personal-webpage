"use client";

import { useEffect, useRef, useState } from "react";
import {
  effectiveStepMs,
  isAbortError,
  playFrames,
  prefersReducedMotion,
  REPL_HOLD_MS,
  REPL_STEP_MS,
} from "@/lib/replication/animation";
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
  const [view, setView] = useState<FrameView>(() =>
    viewFromReplicas(initial, idleMessage)
  );
  const [busy, setBusy] = useState(false);
  const replicasRef = useRef(initial);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    runIdRef.current += 1;
  }

  function reset(replicas: Replica[], message: string) {
    cancel();
    replicasRef.current = replicas;
    setBusy(false);
    setView(viewFromReplicas(replicas, message));
  }

  async function run(frames: SimFrame[]): Promise<boolean> {
    if (frames.length === 0) return false;
    cancel();
    const controller = new AbortController();
    const runId = runIdRef.current;
    abortRef.current = controller;
    setBusy(true);

    const reduced = prefersReducedMotion();
    const stepMs = effectiveStepMs(reduced, REPL_STEP_MS);
    const holdMs = effectiveStepMs(reduced, REPL_HOLD_MS);

    try {
      await playFrames(
        frames,
        (frame, index) => {
          if (runId !== runIdRef.current || controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          replicasRef.current = frame.replicas;
          setView({
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
            stepInfo: { index: index + 1, total: frames.length },
          });
        },
        { stepMs, holdMs, signal: controller.signal }
      );
      return runId === runIdRef.current;
    } catch (err) {
      if (isAbortError(err)) return false;
      throw err;
    } finally {
      if (abortRef.current === controller && runId === runIdRef.current) {
        abortRef.current = null;
        setBusy(false);
        setView((prev) => ({ ...prev, stepInfo: null }));
      }
    }
  }

  return { view, busy, replicasRef, run, reset, cancel };
}
