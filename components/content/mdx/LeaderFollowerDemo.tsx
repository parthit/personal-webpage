"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createLeaderCluster,
  type WriteMode,
} from "@/lib/replication/model";
import {
  buildCatchupFrames,
  buildFailoverFrames,
  buildLeaderWriteFrames,
  buildReadFrames,
} from "@/lib/replication/frames";
import { figureShell, packetCaption, ReplicaCard } from "./replication/ReplicaCard";
import { useSimPlayback } from "./replication/useSimPlayback";

const IDLE =
  "Write a likes count to the leader. Sync waits for followers; async acks first and replicas lag.";

export function LeaderFollowerDemo() {
  const { view, busy, replicasRef, run, reset } = useSimPlayback(
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
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            New likes value
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              inputMode="numeric"
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-60 sm:h-9 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>
          <fieldset className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            <legend>Durability</legend>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "asynchronous" ? "default" : "outline"}
                disabled={busy}
                aria-pressed={mode === "asynchronous"}
                onClick={() => setMode("asynchronous")}
              >
                Async
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "synchronous" ? "default" : "outline"}
                disabled={busy}
                aria-pressed={mode === "synchronous"}
                onClick={() => setMode("synchronous")}
              >
                Sync
              </Button>
            </div>
          </fieldset>
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

        {busy ? (
          <p
            className="text-xs font-medium text-amber-700 dark:text-amber-300"
            aria-live="polite"
          >
            Animating
            {view.stepInfo
              ? ` — step ${view.stepInfo.index} of ${view.stepInfo.total}`
              : "…"}
          </p>
        ) : null}
      </div>

      <div
        className="flex gap-3 overflow-x-auto p-3 sm:p-4"
        role="img"
        aria-label="Leader and two follower replicas"
      >
        {view.replicas.map((replica) => (
          <ReplicaCard
            key={replica.id}
            replica={replica}
            highlight={view.highlightIds.includes(replica.id)}
            packetLabel={
              view.highlightIds.includes(replica.id) ? packet : undefined
            }
          />
        ))}
      </div>

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
