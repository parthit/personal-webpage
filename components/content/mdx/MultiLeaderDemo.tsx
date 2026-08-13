"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createMultiLeaderCluster,
  type ConflictStrategy,
} from "@/lib/replication/model";
import {
  buildPartitionWrites,
  buildReconcileFrames,
} from "@/lib/replication/frames";
import { figureShell, packetCaption, ReplicaCard } from "./replication/ReplicaCard";
import { useSimPlayback } from "./replication/useSimPlayback";

const IDLE =
  "Both datacenters start with bread. Partition them, add milk in NYC and eggs in London, then heal the link.";

export function MultiLeaderDemo() {
  const { view, busy, replicasRef, run, reset } = useSimPlayback(
    createMultiLeaderCluster(),
    IDLE
  );
  const [strategy, setStrategy] = useState<ConflictStrategy>("last-write-wins");

  async function onPartition() {
    await run(buildPartitionWrites(replicasRef.current, "milk", "eggs"));
  }

  async function onHeal() {
    await run(buildReconcileFrames(replicasRef.current, strategy, "nyc"));
  }

  const packet = packetCaption(view.fromId, view.toId, view.kind);

  return (
    <figure className={figureShell} data-multi-leader-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Multi-leader conflict — two shopping carts diverge, then reconcile
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <fieldset className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          <legend>On heal</legend>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={strategy === "last-write-wins" ? "default" : "outline"}
              disabled={busy}
              aria-pressed={strategy === "last-write-wins"}
              onClick={() => setStrategy("last-write-wins")}
            >
              Last-write-wins
            </Button>
            <Button
              type="button"
              size="sm"
              variant={strategy === "union-merge" ? "default" : "outline"}
              disabled={busy}
              aria-pressed={strategy === "union-merge"}
              onClick={() => setStrategy("union-merge")}
            >
              Union merge
            </Button>
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void onPartition()}
          >
            Partition and write both
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void onHeal()}
          >
            Heal and reconcile
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="col-span-2 w-full sm:col-span-1 sm:w-auto"
            onClick={() => {
              setStrategy("last-write-wins");
              reset(createMultiLeaderCluster(), IDLE);
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
        aria-label="Two multi-leader datacenters"
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
