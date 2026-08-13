"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createPeerCluster,
  quorumSafe,
  readQuorumIds,
  writeQuorumIds,
} from "@/lib/replication/model";
import {
  buildQuorumReadFrames,
  buildQuorumWriteFrames,
} from "@/lib/replication/frames";
import { figureShell, packetCaption, ReplicaCard } from "./replication/ReplicaCard";
import { useSimPlayback } from "./replication/useSimPlayback";

const N = 5;
const IDLE =
  "Writes go to the first W nodes; reads come from the last R. Sets overlap only when W+R > N.";

export function QuorumDemo() {
  const { view, busy, replicasRef, run, reset } = useSimPlayback(
    createPeerCluster(N),
    IDLE
  );
  const [w, setW] = useState(2);
  const [r, setR] = useState(2);
  const [value, setValue] = useState("42");

  const writeIds = useMemo(() => writeQuorumIds(N, w), [w]);
  const readIds = useMemo(() => readQuorumIds(N, r), [r]);
  const safe = quorumSafe(N, w, r);

  async function onWrite() {
    const next = value.trim() || "42";
    await run(buildQuorumWriteFrames(replicasRef.current, next, w));
  }

  async function onRead() {
    await run(buildQuorumReadFrames(replicasRef.current, r, w));
  }

  const packet = packetCaption(view.fromId, view.toId, view.kind);

  return (
    <figure className={figureShell} data-quorum-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Leaderless quorum — N=5, tune W and R, then write and read
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            Value
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-60 sm:h-9 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            W (write quorum) = {w}
            <input
              type="range"
              min={1}
              max={N}
              value={w}
              disabled={busy}
              onChange={(e) => setW(Number(e.target.value))}
              aria-label="Write quorum W"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            R (read quorum) = {r}
            <input
              type="range"
              min={1}
              max={N}
              value={r}
              disabled={busy}
              onChange={(e) => setR(Number(e.target.value))}
              aria-label="Read quorum R"
            />
          </label>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400" data-quorum-math>
          W+R = {w + r} {safe ? ">" : "≤"} N={N}
          {safe
            ? " — any write set and read set must overlap, so a completed write cannot be missed."
            : " — write set " +
              writeIds.join(", ") +
              " and read set " +
              readIds.join(", ") +
              " can be disjoint."}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void onWrite()}
          >
            Write
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void onRead()}
          >
            Read
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="col-span-2 w-full sm:col-span-1 sm:w-auto"
            onClick={() => {
              setW(2);
              setR(2);
              setValue("42");
              reset(createPeerCluster(N), IDLE);
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
        className="flex flex-wrap gap-3 p-3 sm:p-4"
        role="img"
        aria-label="Five leaderless replicas"
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
