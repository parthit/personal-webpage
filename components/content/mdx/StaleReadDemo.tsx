"use client";

import { useState } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { createLeaderCluster, type WriteMode } from "@/lib/replication/model";
import {
  buildCatchupFrames,
  buildLeaderWriteFrames,
  buildReadFrames,
} from "@/lib/replication/frames";
import { figureShell, packetCaption } from "./replication/ReplicaCard";
import { ReplicaGraph } from "./replication/ReplicaGraph";
import { useSimPlayback } from "./replication/useSimPlayback";
import { WRITE_MODE_OPTIONS } from "./replication/writeMode";

const IDLE =
  "Write, then immediately read a follower. Async replication makes read-your-writes fail unless you pin the session to the leader.";

export function StaleReadDemo() {
  const { view, busy, motion, replicasRef, run, reset, playback } =
    useSimPlayback(
      createLeaderCluster(),
      IDLE
    );
  const [mode, setMode] = useState<WriteMode>("asynchronous");

  async function writeThenReadFollower() {
    const write = buildLeaderWriteFrames(replicasRef.current, "11", mode);
    const ack = write.find((f) => f.kind === "client-ack");
    const snapshot = ack?.replicas ?? write.at(-1)!.replicas;
    const read = buildReadFrames(snapshot, "lon");
    await run([...write, ...read]);
  }

  async function writeThenReadLeader() {
    const write = buildLeaderWriteFrames(replicasRef.current, "11", mode);
    const ack = write.find((f) => f.kind === "client-ack");
    const snapshot = ack?.replicas ?? write.at(-1)!.replicas;
    const leaderId =
      snapshot.find((r) => r.role === "leader" && r.alive)?.id ?? "nyc";
    const read = buildReadFrames(snapshot, leaderId);
    await run([...write, ...read]);
  }

  const packet = packetCaption(view.fromId, view.toId, view.kind);
  const outcome =
    view.readValue != null
      ? view.stale
        ? `Read likes=${view.readValue} — stale`
        : `Read likes=${view.readValue} — up to date`
      : null;

  return (
    <figure className={figureShell} data-stale-read-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Replication lag — the same write, then a read from leader vs follower
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <SegmentedControl
          label="How the leader acknowledges the write"
          value={mode}
          options={WRITE_MODE_OPTIONS}
          onValueChange={setMode}
          disabled={busy}
          hint
          data-testid="write-mode"
        />
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void writeThenReadFollower()}
          >
            Write, then read London
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void writeThenReadLeader()}
          >
            Write, then read leader
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void run(buildCatchupFrames(replicasRef.current))}
          >
            Catch up replicas
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              setMode("asynchronous");
              reset(createLeaderCluster(), IDLE);
            }}
          >
            Reset
          </Button>
        </div>
        {outcome ? (
          <p
            className="text-xs font-medium text-gray-700 dark:text-gray-300"
            data-read-outcome
          >
            {outcome}
          </p>
        ) : null}
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
          ariaLabel="Replicas used for a stale-read walkthrough"
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
