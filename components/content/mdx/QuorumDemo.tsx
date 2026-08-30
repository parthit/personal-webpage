"use client";

import { useMemo, useState } from "react";
import { AnimationPlayer } from "@/components/animation/AnimationPlayer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
import { figureShell, packetCaption } from "./replication/ReplicaCard";
import { ReplicaGraph } from "./replication/ReplicaGraph";
import { useSimPlayback } from "./replication/useSimPlayback";

const N = 5;
const IDLE =
  "Writes go to the first W nodes; reads come from the last R. Sets overlap only when W+R > N.";

function QuorumSlider({
  label,
  ariaLabel,
  max,
  value,
  disabled,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  max: number;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
      <span>
        {label} ={" "}
        <span className="tabular-nums text-gray-900 dark:text-gray-100">
          {value}
        </span>
      </span>
      <div className="flex h-8 items-center gap-3">
        <Slider
          min={1}
          max={max}
          step={1}
          value={[value]}
          disabled={disabled}
          onValueChange={([next]) => onChange(next)}
          aria-label={ariaLabel}
        />
        <span className="shrink-0 text-[10px] font-normal text-gray-400 dark:text-gray-500">
          1–{max}
        </span>
      </div>
    </div>
  );
}

export function QuorumDemo() {
  const { view, busy, motion, replicasRef, run, reset, playback } =
    useSimPlayback(
      createPeerCluster(N),
      IDLE
    );
  const [w, setW] = useState(2);
  const [r, setR] = useState(2);
  const [value, setValue] = useState("42");
  /** W of the last write whose animation finished. Not inferred mid-frame. */
  const [committedW, setCommittedW] = useState<number | null>(null);

  const writeIds = useMemo(() => writeQuorumIds(N, w), [w]);
  const readIds = useMemo(() => readQuorumIds(N, r), [r]);
  const nextSafe = quorumSafe(N, w, r);

  async function onWrite() {
    const writeW = w;
    const next = value.trim() || "42";
    const ok = await run(buildQuorumWriteFrames(replicasRef.current, next, writeW));
    if (ok) setCommittedW(writeW);
  }

  async function onRead() {
    await run(buildQuorumReadFrames(replicasRef.current, r));
  }

  const packet = packetCaption(view.fromId, view.toId, view.kind);

  return (
    <figure className={figureShell} data-quorum-demo>
      <figcaption className="border-b border-gray-200 px-3 py-3 text-sm text-gray-600 sm:px-4 dark:border-gray-700 dark:text-gray-300">
        Leaderless quorum — N=5, tune W and R, then write and read
      </figcaption>

      <div className="space-y-3 border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-gray-700">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            Value
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-60 sm:h-8 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>
          <QuorumSlider
            label="W (write quorum)"
            ariaLabel="Write quorum W"
            max={N}
            value={w}
            disabled={busy}
            onChange={setW}
          />
          <QuorumSlider
            label="R (read quorum)"
            ariaLabel="Read quorum R"
            max={N}
            value={r}
            disabled={busy}
            onChange={setR}
          />
        </div>
        <p
          className="text-xs text-gray-600 dark:text-gray-400"
          data-quorum-math
          data-last-write-w={committedW == null ? "none" : String(committedW)}
        >
          Next write W+R = {w + r} {nextSafe ? ">" : "≤"} N={N}
          {nextSafe
            ? " — any write set of that W and read set of this R must overlap."
            : " — write set " +
              writeIds.join(", ") +
              " and read set " +
              readIds.join(", ") +
              " can be disjoint."}
          {committedW != null && committedW !== w
            ? ` Last completed write used W=${committedW}; a read compares against that write set, not the slider.`
            : committedW != null
              ? ` Last completed write used W=${committedW}.`
              : ""}
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
              setCommittedW(null);
              reset(createPeerCluster(N), IDLE);
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
          topology="quorum"
          ariaLabel="Five leaderless replicas"
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
