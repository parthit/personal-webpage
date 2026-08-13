import { cn } from "@/lib/utils";
import type { Replica } from "@/lib/replication/model";

export const figureShell =
  "not-prose relative my-8 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 lg:left-1/2 lg:w-[min(56rem,calc(100vw-2.5rem))] lg:max-w-none lg:-translate-x-1/2";

export function ReplicaCard({
  replica,
  highlight,
  packetLabel,
}: {
  replica: Replica;
  highlight: boolean;
  packetLabel?: string;
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
        "relative min-w-[8.5rem] flex-1 basis-[9rem] rounded-lg border bg-white p-3 shadow-sm transition-shadow dark:bg-gray-950",
        replica.alive
          ? "border-gray-200 dark:border-gray-700"
          : "border-red-300 bg-red-50 opacity-80 dark:border-red-800 dark:bg-red-950/40",
        highlight &&
          replica.alive &&
          "ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-50 motion-safe:animate-pulse dark:ring-offset-gray-900"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {replica.name}
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
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
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {replica.region}
      </p>
      <p className="mt-2 font-mono text-sm text-gray-900 dark:text-gray-100">
        {replica.value || "(empty)"}
      </p>
      <p className="mt-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">
        v{replica.version}
      </p>
      {packetLabel && highlight ? (
        <p
          className="mt-2 text-[11px] font-medium text-amber-800 dark:text-amber-200"
          data-packet-label
        >
          {packetLabel}
        </p>
      ) : null}
    </div>
  );
}

export function packetCaption(fromId?: string, toId?: string, kind?: string) {
  if (!fromId && !toId) return undefined;
  if (kind === "client-send") return "← write from client";
  if (kind === "replicate") return "replication stream";
  if (kind === "follower-apply" || kind === "follower-ack") return "ack → leader";
  if (kind === "read" || kind === "stale-read" || kind === "quorum-read")
    return "read response";
  if (kind === "quorum-write") return "write + ack";
  return "in flight";
}
