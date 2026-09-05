"use client";

import { useEffect, useState } from "react";
import { liveStepProgress } from "@/lib/animation/core";

/**
 * Turn the player's sampled step fraction into a frame-by-frame clock while
 * a step is playing. Replica graphs can use CSS `dwellClock` instead; sequence
 * diagrams have too many time-dependent marks for a single CSS animation.
 */
export function useLiveStepProgress(
  playing: boolean,
  sampledProgress: number,
  durationMs: number
): number {
  const playKey = `${playing}:${sampledProgress}:${durationMs}`;
  const [clock, setClock] = useState({ key: playKey, elapsed: 0 });

  useEffect(() => {
    if (!playing) return;

    const startedAt = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      setClock({ key: playKey, elapsed });
      if (liveStepProgress(sampledProgress, elapsed, durationMs, true) < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playKey, playing, sampledProgress, durationMs]);

  const elapsed = playing && clock.key === playKey ? clock.elapsed : 0;
  return liveStepProgress(sampledProgress, elapsed, durationMs, playing);
}
