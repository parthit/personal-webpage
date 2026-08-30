"use client";

import { useState } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  createLeaderCluster,
  type WriteMode,
} from "@/lib/replication/model";
import { WRITE_MODE_OPTIONS } from "./replication/writeMode";
import {
  buildCatchupFrames,
  buildFailoverFrames,
  buildLeaderWriteFrames,
  buildReadFrames,
} from "@/lib/replication/frames";
import { figureShell, packetCaption } from "./replication/ReplicaCard";
import { ReplicaGraph } from "./replication/ReplicaGraph";
import { useSimPlayback } from "./replication/useSimPlayback";

const IDLE =
  "Pick how the leader acknowledges, write a likes count, then read each replica to see who has caught up.";

export function LeaderFollowerDemo() {
  const { view, busy, motion, replicasRef, run, reset, playback } =
    useSimPlayback(
      createLeaderCluster(),
      IDLE
    );
  const [mode, setMode] = useState<WriteMode>("asynchronous");
  const [value, setValue] = useState("7");

  async function onWrite() {
    const next = value.trim();
    if (!next) return;
    const frames = buildLeaderWriteFrames(replicasRef.current, next, mode);
    await run(frames);
  }

  async function onRead(id: string) {
    await run(buildReadFrames(replicasRef.current, id));
  }

  async function onFailover() {
    await run(buildFailoverFrames(replicasRef.current));
  }

  async function onCatchup() {
    await run(buildCatchupFrames(replicasRef.current));
  }

  const packet = packetCaption(view.fromId, view.toId, view.kind);

  return (
    <figure className={figureShell} data-leader-follower-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Single-leader replication — watch a write fan out, then read each replica
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          <label className="flex w-full flex-col gap-1.5 text-xs font-medium text-gray-600 sm:w-40 dark:text-gray-400">
            New likes value
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              inputMode="numeric"
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-60 sm:h-8 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>
          <SegmentedControl
            label="How the leader acknowledges the write"
            value={mode}
            options={WRITE_MODE_OPTIONS}
            onValueChange={setMode}
            disabled={busy}
            hint
            className="w-full sm:min-w-0 sm:flex-1 sm:basis-64"
            data-testid="write-mode"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void onWrite()}
          >
            Write to leader
          </Button>
          {view.replicas.map((r) => (
            <Button
              key={r.id}
              type="button"
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={busy || !r.alive}
              onClick={() => void onRead(r.id)}
            >
              Read {r.name}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void onCatchup()}
          >
            Catch up replicas
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void onFailover()}
          >
            Crash leader
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="col-span-2 w-full sm:col-span-1 sm:w-auto"
            onClick={() => {
              setMode("asynchronous");
              setValue("7");
              reset(createLeaderCluster(), IDLE);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <ReplicaGraph
          replicas={view.replicas}
          highlightIds={view.highlightIds}
          kind={view.kind}
          fromId={view.fromId}
          toId={view.toId}
          packetLabel={packet}
          playing={motion.playing}
          stepDurationMs={motion.stepDurationMs}
          stepProgress={motion.stepProgress}
          topology="leader-tree"
          ariaLabel="Leader and two follower replicas"
        />
      </div>

      <AnimationPlayer player={playback} />

      <p
        className="border-t border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-800 sm:px-4 dark:border-gray-700 dark:text-gray-200"
        data-replication-status
        aria-live="polite"
      >
        {view.message}
      </p>
    </figure>
  );
}
