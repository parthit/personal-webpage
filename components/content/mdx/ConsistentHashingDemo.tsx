"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Minus, Plus, RotateCcw, Search, Server } from "lucide-react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { useAnimationPlayer } from "@/components/animation/useAnimationPlayer";
import { useLiveStepProgress } from "@/components/animation/useLiveStepProgress";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { HashRing } from "@/components/content/mdx/hashing/HashRing";
import {
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  reducedMotionSubscribe,
  visiblePlayhead,
} from "@/lib/animation/core";
import {
  HASH_STEP_MS,
  buildLookupSteps,
  buildMembershipSteps,
  createScene,
  idleSnapshot,
  type HashScene,
} from "@/lib/hashing/frames";
import {
  MAX_VNODES,
  MIN_NODES,
  NODE_CATALOG,
  nextNodeId,
  loadCounts,
  nodeSpec,
  type PlacementMode,
} from "@/lib/hashing/model";
import { cn } from "@/lib/utils";

const MODE_OPTIONS = [
  {
    value: "ring" as const,
    label: "Hash ring",
    hint: "Key and node hashes share a circle. Walk clockwise to the next vnode.",
  },
  {
    value: "modulo" as const,
    label: "Modulo",
    hint: "Owner is hash(key) % N. Changing N rewrites almost every address.",
  },
];

const NODE_CHIP: Record<string, string> = {
  sky: "bg-[#e0e4f2] text-[#3f4b7a] dark:bg-[#303852] dark:text-[#dce2ff]",
  amber: "bg-[#f4dfd4] text-[#864c38] dark:bg-[#56372d] dark:text-[#ffdccc]",
  emerald: "bg-[#dce9e1] text-[#476859] dark:bg-[#30463c] dark:text-[#d6eee1]",
  violet: "bg-[#e8e2f0] text-[#5f5379] dark:bg-[#433a55] dark:text-[#e8e0f5]",
  rose: "bg-[#f1dde0] text-[#78434b] dark:bg-[#52343a] dark:text-[#f4dbe0]",
};

const BAR: Record<string, string> = {
  sky: "bg-[#6673a8]",
  amber: "bg-[#d98b68]",
  emerald: "bg-[#72927f]",
  violet: "bg-[#8a7dab]",
  rose: "bg-[#bd6f78]",
};

const figureShell =
  "not-prose relative z-10 my-8 w-full overflow-hidden rounded-[1.4rem] border border-[#d9d0c3] bg-[#f6f1e9] shadow-[0_18px_60px_-36px_rgba(70,60,48,0.55)] dark:border-stone-700 dark:bg-stone-900 lg:left-1/2 lg:w-[min(60rem,calc(100vw-2.5rem))] lg:max-w-none lg:-translate-x-1/2";

export function ConsistentHashingDemo() {
  const [scene, setScene] = useState<HashScene>(() => createScene("ring"));
  const [lookupKey, setLookupKey] = useState("cart");
  const idle = useMemo(() => idleSnapshot(scene), [scene]);
  const player = useAnimationPlayer(
    { snapshot: idle, label: idle.message, durationMs: HASH_STEP_MS },
    HASH_STEP_MS
  );
  const snapshot = player.current.snapshot;
  const busy = player.isActive;
  const reducedMotion = useSyncExternalStore(
    reducedMotionSubscribe,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const progress = useLiveStepProgress(
    player.status === "playing" && !reducedMotion,
    player.stepProgress,
    player.currentDurationMs,
    `${snapshot.walk?.from}:${snapshot.walk?.to}:${snapshot.lookupKeyId}`
  );
  const walkProgress =
    snapshot.walk == null
      ? 0
      : snapshot.walk.settled
        ? 1
        : visiblePlayhead(0, 1, progress, reducedMotion);

  const counts = loadCounts(snapshot.assignment, snapshot.nodeIds);
  const totalKeys = snapshot.keys.length;
  const canAdd = nextNodeId(scene.nodeIds) != null;
  const canRemove = scene.nodeIds.length > MIN_NODES;

  function applyScene(next: HashScene) {
    setScene(next);
    const nextIdle = idleSnapshot(next);
    player.reset({
      snapshot: nextIdle,
      label: nextIdle.message,
      durationMs: HASH_STEP_MS,
    });
  }

  function changeMode(mode: PlacementMode) {
    applyScene(createScene(mode, scene.nodeIds, scene.vnodes));
  }

  function changeVnodes(vnodes: number) {
    applyScene({ ...scene, vnodes });
  }

  async function runLookup() {
    await player.run(buildLookupSteps(scene, lookupKey));
  }

  async function runMembership(action: "add" | "remove") {
    const result = buildMembershipSteps(scene, action);
    if (!result) return;
    const ok = await player.run(result.steps);
    if (ok) setScene(result.nextScene);
  }

  function reset() {
    applyScene(createScene(scene.mode));
    setLookupKey("cart");
  }

  return (
    <figure className={figureShell} data-consistent-hashing-demo>
      <figcaption className="flex flex-col gap-1 border-b border-[#ded5c9] px-4 py-4 sm:px-6 dark:border-stone-700">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b8175] dark:text-stone-400">
          Distribution playground
        </span>
        <span className="text-lg font-semibold tracking-tight text-[#303544] dark:text-stone-100">
          Watch ownership change, not the whole cluster
        </span>
      </figcaption>

      <div className="grid lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="space-y-5 border-b border-[#ded5c9] p-4 sm:p-5 lg:border-r lg:border-b-0 dark:border-stone-700">
          <SegmentedControl
            label="Placement strategy"
            value={scene.mode}
            options={MODE_OPTIONS}
            onValueChange={(next) => changeMode(next as PlacementMode)}
            disabled={busy}
            hint
            className="[&_[data-segmented-hint]]:text-[#7c746a]"
            data-testid="hash-mode"
          />

          <section className="rounded-2xl border border-[#ddd3c6] bg-white/65 p-3.5 shadow-sm dark:border-stone-700 dark:bg-stone-950/35">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#7b7267] dark:text-stone-400">
              <Search className="h-3.5 w-3.5" />
              Follow one key
            </div>
            <label className="sr-only" htmlFor="hash-lookup-key">
              Lookup key
            </label>
            <div className="flex gap-2">
              <select
                id="hash-lookup-key"
                value={lookupKey}
                disabled={busy}
                onChange={(e) => setLookupKey(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-[#d8cfc3] bg-[#fffcf7] px-3 text-sm font-medium text-[#343a4a] outline-none focus:border-[#6673a8] focus:ring-2 focus:ring-[#6673a8]/20 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
                aria-label="Lookup key"
              >
                {snapshot.keys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.id}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                className="h-10 rounded-xl bg-[#59658f] px-4 text-white shadow-sm hover:bg-[#4d587e]"
                disabled={busy}
                onClick={() => void runLookup()}
              >
                Trace
                <span className="sr-only">Lookup {lookupKey}</span>
              </Button>
            </div>
          </section>

          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#7b7267] dark:text-stone-400">
                <Server className="h-3.5 w-3.5" />
                Cluster
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px] text-[#7b7267]"
                onClick={reset}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                className="h-9 rounded-xl bg-[#d37d64] text-white shadow-sm hover:bg-[#bf6d56]"
                disabled={busy || !canAdd}
                onClick={() => void runMembership("add")}
              >
                <Plus className="h-3.5 w-3.5" />
                Add node
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 rounded-xl border-[#d8cfc3] bg-white/55 text-[#4f4a45] hover:bg-white"
                disabled={busy || !canRemove}
                onClick={() => void runMembership("remove")}
              >
                <Minus className="h-3.5 w-3.5" />
                Remove
                <span className="sr-only"> node</span>
              </Button>
            </div>
          </section>

          <section
            className={cn(
              "space-y-2 transition-opacity",
              scene.mode === "modulo" && "opacity-45"
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#5f5952] dark:text-stone-300">
                Vnodes per server
              </span>
              <span className="rounded-full bg-[#e4ded4] px-2 py-0.5 font-bold tabular-nums text-[#4d556f] dark:bg-stone-700 dark:text-stone-100">
                {scene.vnodes}
              </span>
            </div>
            <div className="flex h-8 items-center gap-3">
              <Slider
                min={1}
                max={MAX_VNODES}
                step={1}
                value={[scene.vnodes]}
                disabled={busy || scene.mode === "modulo"}
                onValueChange={([next]) => changeVnodes(next)}
                aria-label="Virtual nodes per server"
              />
              <span className="shrink-0 text-[10px] text-[#92897f]">
                1–{MAX_VNODES}
              </span>
            </div>
          </section>

          <LoadStrip
            nodeIds={snapshot.nodeIds}
            counts={counts}
            total={totalKeys}
            highlightIds={snapshot.highlightNodeIds}
          />
        </div>

        <div className="flex min-w-0 flex-col bg-[#fbf8f2]/55 p-3 sm:p-5 dark:bg-stone-950/20">
          <div className="flex min-h-[24rem] flex-1 items-center justify-center">
            <HashRing snapshot={snapshot} walkProgress={walkProgress} />
          </div>
          <p
            className="rounded-2xl border border-[#ddd3c6] bg-white/75 px-4 py-3 text-sm leading-relaxed text-[#45413d] shadow-sm dark:border-stone-700 dark:bg-stone-950/45 dark:text-stone-200"
            data-hash-status
            data-hash-moved={
              snapshot.movedCount == null ? "none" : String(snapshot.movedCount)
            }
            data-hash-modulo-would-move={
              snapshot.moduloWouldMove == null
                ? "none"
                : String(snapshot.moduloWouldMove)
            }
            data-hash-node-count={String(snapshot.nodeIds.length)}
            data-hash-vnodes={String(scene.vnodes)}
            aria-live="polite"
          >
            {snapshot.message}
          </p>
        </div>
      </div>

      <AnimationPlayer
        player={player}
        idleHint="Run a trace or change the cluster. Playback controls appear here."
        historyDefaultOpen={false}
        className="border-[#ded5c9] bg-[#eee8de]/70 dark:border-stone-700 dark:bg-stone-950/40"
      />
    </figure>
  );
}

function LoadStrip({
  nodeIds,
  counts,
  total,
  highlightIds,
}: {
  nodeIds: string[];
  counts: Record<string, number>;
  total: number;
  highlightIds: string[];
}) {
  const highlighted = new Set(highlightIds);
  return (
    <ul className="grid grid-cols-2 gap-2" data-hash-load>
      {nodeIds.map((id) => {
        const spec = NODE_CATALOG.find((node) => node.id === id) ?? nodeSpec(id);
        const count = counts[id] ?? 0;
        const pct = total === 0 ? 0 : (count / total) * 100;
        return (
          <li
            key={id}
            data-hash-load-node={id}
            data-hash-load-count={String(count)}
            className={cn(
              "rounded-xl border border-[#ddd3c6] bg-white/60 p-2.5 text-xs shadow-sm transition-shadow dark:border-stone-700 dark:bg-stone-950/35",
              highlighted.has(id) && "ring-2 ring-[#e0a948]"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className={cn(
                  "inline-flex rounded-lg px-2 py-1 text-[10px] font-bold tracking-wide",
                  NODE_CHIP[spec.color]
                )}
              >
                {spec.label}
              </span>
              <span className="font-semibold tabular-nums text-[#5f5952] dark:text-stone-300">
                {count} {count === 1 ? "key" : "keys"}
              </span>
            </div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-[#e2ddd5] dark:bg-stone-700">
              <span
                className={cn("block h-full rounded-full", BAR[spec.color])}
                style={{ width: `${pct}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
