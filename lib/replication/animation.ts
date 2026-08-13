/**
 * Timed walkthrough playback for replication demos.
 * Decorative CSS may drop under prefers-reduced-motion; step dwell stays
 * readable so the lesson is not collapsed into an instant jump.
 */

export const REPL_STEP_MS = 1600;
export const REPL_HOLD_MS = 2200;

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;

    const cleanup = () => {
      if (timer != null) clearTimeout(timer);
      if (raf && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(raf);
      }
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(abortError());
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    const finish = () => {
      cleanup();
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      resolve();
    };

    const lead =
      typeof requestAnimationFrame === "function" ? Math.max(0, ms - 16) : ms;
    timer = setTimeout(() => {
      timer = null;
      if (typeof requestAnimationFrame === "function") {
        raf = requestAnimationFrame(() => {
          raf = 0;
          finish();
        });
      } else {
        finish();
      }
    }, lead);
  });
}

export function effectiveStepMs(
  _prefersReducedMotion: boolean,
  stepMs = REPL_STEP_MS
): number {
  return stepMs;
}

export async function playFrames<T>(
  frames: T[],
  onFrame: (frame: T, index: number) => void | Promise<void>,
  options: {
    stepMs?: number;
    holdMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<void> {
  const stepMs = options.stepMs ?? REPL_STEP_MS;
  const holdMs = options.holdMs ?? REPL_HOLD_MS;
  const { signal } = options;

  for (let i = 0; i < frames.length; i += 1) {
    if (signal?.aborted) throw abortError();
    await onFrame(frames[i], i);
    if (signal?.aborted) throw abortError();
    const delay = i === frames.length - 1 ? holdMs : stepMs;
    await sleep(delay, signal);
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
