import { cn } from "@/lib/utils";
import type { Replica } from "@/lib/replication/model";

export const figureShell =
  "not-prose relative z-10 my-8 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 lg:left-1/2 lg:w-[min(56rem,calc(100vw-2.5rem))] lg:max-w-none lg:-translate-x-1/2";

export function ReplicaCard({
  replica,
  highlight,
  packetLabel,
  compact = false,
}: {
  replica: Replica;
  highlight: boolean;
  packetLabel?: string;
  compact?: boolean;
}) {
  const roleLabel =
    replica.role === "leader"
      ? "leader"
      : replica.role === "follower"
        ? "follower"
        : "replica";

  return (
    <div
      data-replica-id={replica.id}
      data-replica-alive={replica.alive ? "true" : "false"}
      data-replica-role={replica.role}
      className={cn(
        "relative h-full w-full rounded-2xl border bg-white shadow-sm transition-shadow dark:bg-gray-950",
        compact ? "flex flex-col justify-center p-2.5" : "min-w-[8.5rem] flex-1 basis-[9rem] p-3",
        replica.alive
          ? "border-gray-200 dark:border-gray-700"
          : "border-red-300 bg-red-50 opacity-80 dark:border-red-800 dark:bg-red-950/40",
        highlight &&
          replica.alive &&
          "ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-50 motion-safe:animate-pulse dark:ring-offset-gray-900"
      )}
    >
      <div className={cn("flex flex-col", compact ? "gap-0.5" : "mb-1")}>
        <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
          {replica.name}
        </p>
        <span
          className={cn(
            "w-fit rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            !replica.alive
              ? "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100"
              : replica.role === "leader"
                ? "bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100"
                : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          )}
        >
          {replica.alive ? roleLabel : "down"}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-tight text-gray-500 dark:text-gray-400">
        {replica.region}
      </p>
      <p className="mt-1 break-words font-mono text-sm leading-tight text-gray-900 dark:text-gray-100">
        {replica.value || "(empty)"}
      </p>
      <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
        v{replica.version}
      </p>
      {packetLabel && highlight ? (
        <p
          className="mt-1 truncate text-[11px] font-medium text-amber-800 dark:text-amber-200"
          data-packet-label
        >
          {packetLabel}
        </p>
      ) : null}
    </div>
  );
}

export function packetCaption(fromId?: string, toId?: string, kind?: string) {
  if (kind === "idle" || kind === "failover" || kind === "lost-write") {
    return undefined;
  }
  if (kind === "client-send") return "write from client";
  if (kind === "leader-apply") return "apply locally";
  if (kind === "replicate") return "replication stream";
  if (kind === "follower-apply" || kind === "follower-ack") return "ack → leader";
  if (kind === "read") return fromId ? "read response" : "read request";
  if (kind === "stale-read") return "stale read";
  if (kind === "quorum-read") return fromId ? "read response" : "quorum read";
  if (kind === "quorum-write") return "write + ack";
  if (kind === "partition") return "link down";
  if (kind === "conflict") return "reconcile";
  if (kind === "client-ack") return "client ack";
  if (!fromId && !toId) return undefined;
  return "in flight";
}
