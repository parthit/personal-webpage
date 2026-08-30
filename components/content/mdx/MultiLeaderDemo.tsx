"use client";

import { useState } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { Button } from "@/components/ui/button";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/segmented-control";
import {
  createMultiLeaderCluster,
  type ConflictStrategy,
} from "@/lib/replication/model";
import {
  buildPartitionWrites,
  buildReconcileFrames,
} from "@/lib/replication/frames";
import { figureShell, packetCaption } from "./replication/ReplicaCard";
import { ReplicaGraph } from "./replication/ReplicaGraph";
import { useSimPlayback } from "./replication/useSimPlayback";

const IDLE =
  "Both datacenters start with bread. Partition them, add milk in NYC and eggs in London, then heal the link.";

const CONFLICT_STRATEGY_OPTIONS: SegmentedOption<ConflictStrategy>[] = [
  {
    value: "last-write-wins",
    label: "Last write wins",
    hint: "Keep the newer timestamp and drop the other cart. Simple, and it silently loses one shopper's item.",
  },
  {
    value: "union-merge",
    label: "Union merge",
    hint: "Keep both items. Nothing is lost, but the app has to define what merging means for this data.",
  },
];

export function MultiLeaderDemo() {
  const { view, busy, motion, replicasRef, run, reset, playback } =
    useSimPlayback(
      createMultiLeaderCluster(),
      IDLE
    );
  const [strategy, setStrategy] = useState<ConflictStrategy>("last-write-wins");

  async function onPartition() {
    await run(
      buildPartitionWrites(replicasRef.current, "milk", "eggs"),
      () => ({ linkBroken: true })
    );
  }

  async function onHeal() {
    await run(
      buildReconcileFrames(replicasRef.current, strategy, "nyc"),
      () => ({ linkBroken: false })
    );
  }

  const packet = packetCaption(view.fromId, view.toId, view.kind);

  return (
    <figure className={figureShell} data-multi-leader-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Multi-leader conflict — two shopping carts diverge, then reconcile
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <SegmentedControl
          label="What happens to the two carts when the link heals"
          value={strategy}
          options={CONFLICT_STRATEGY_OPTIONS}
          onValueChange={setStrategy}
          disabled={busy}
          hint
          data-testid="conflict-strategy"
        />
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
          topology="multi-leader"
          linkBroken={view.linkBroken ?? false}
          ariaLabel="Two multi-leader datacenters"
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
