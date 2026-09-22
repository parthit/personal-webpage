"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { useAnimationPlayer } from "@/components/animation/useAnimationPlayer";
import { useLiveStepProgress } from "@/components/animation/useLiveStepProgress";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { figureShell } from "@/components/content/mdx/replication/ReplicaCard";
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
  sky: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
  amber: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
  emerald: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
  violet: "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100",
  rose: "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-100",
};

const BAR: Record<string, string> = {
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
};

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
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Consistent hashing — add a node and count how many keys change owner
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <SegmentedControl
          label="Placement"
          value={scene.mode}
          options={MODE_OPTIONS}
          onValueChange={(next) => changeMode(next as PlacementMode)}
          disabled={busy}
          hint
          data-testid="hash-mode"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            Lookup key
            <select
              value={lookupKey}
              disabled={busy}
              onChange={(e) => setLookupKey(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-60 sm:h-8 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              aria-label="Lookup key"
            >
              {snapshot.keys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.id}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
            <span>
              Virtual nodes{" "}
              <span className="tabular-nums text-gray-900 dark:text-gray-100">
                {scene.vnodes}
              </span>
              {scene.mode === "modulo" ? " (ring only)" : ""}
            </span>
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
              <span className="shrink-0 text-[10px] font-normal text-gray-400 dark:text-gray-500">
                1–{MAX_VNODES}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void runLookup()}
          >
            Lookup {lookupKey}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={busy || !canAdd}
            onClick={() => void runMembership("add")}
          >
            Add node
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={busy || !canRemove}
            onClick={() => void runMembership("remove")}
          >
            Remove node
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={reset}
          >
            Reset
          </Button>
        </div>

        <LoadStrip
          nodeIds={snapshot.nodeIds}
          counts={counts}
          total={totalKeys}
          highlightIds={snapshot.highlightNodeIds}
        />
      </div>

      <div className="p-3 sm:p-4">
        <HashRing snapshot={snapshot} walkProgress={walkProgress} />
      </div>

      <AnimationPlayer player={player} />

      <p
        className="border-t border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-800 sm:px-4 dark:border-gray-700 dark:text-gray-200"
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
    <ul className="space-y-2" data-hash-load>
      {nodeIds.map((id) => {
        const spec = NODE_CATALOG.find((node) => node.id === id) ?? nodeSpec(id);
        const count = counts[id] ?? 0;
        const pct = total === 0 ? 0 : (count / total) * 100;
        return (
          <li
            key={id}
            data-hash-load-node={id}
            data-hash-load-count={String(count)}
            className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2 text-xs"
          >
            <span
              className={cn(
                "inline-flex justify-center rounded px-1.5 py-0.5 font-semibold",
                NODE_CHIP[spec.color],
                highlighted.has(id) && "ring-2 ring-amber-400"
              )}
            >
              {spec.label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <span
                className={cn("block h-full rounded-full", BAR[spec.color])}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="tabular-nums text-gray-600 dark:text-gray-400">
              {count}/{total}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
