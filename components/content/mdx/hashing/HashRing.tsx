"use client";

import { cn } from "@/lib/utils";
import {
  RING_SIZE,
  interpolateClockwise,
  nodeSpec,
  type HashSnapshot,
} from "@/lib/hashing/model";
import {
  RING_LAYOUT,
  clockwiseArcPath,
  polar,
} from "@/lib/hashing/layout";

const NODE_DOT: Record<NodeSpecColor, string> = {
  sky: "fill-sky-500 dark:fill-sky-400",
  amber: "fill-amber-500 dark:fill-amber-400",
  emerald: "fill-emerald-500 dark:fill-emerald-400",
  violet: "fill-violet-500 dark:fill-violet-400",
  rose: "fill-rose-500 dark:fill-rose-400",
};

const KEY_DOT: Record<NodeSpecColor, string> = {
  sky: "fill-sky-600 dark:fill-sky-300",
  amber: "fill-amber-600 dark:fill-amber-300",
  emerald: "fill-emerald-600 dark:fill-emerald-300",
  violet: "fill-violet-600 dark:fill-violet-300",
  rose: "fill-rose-600 dark:fill-rose-300",
};

type NodeSpecColor = ReturnType<typeof nodeSpec>["color"];

function ownerColor(nodeId: string | undefined): NodeSpecColor {
  return nodeId ? nodeSpec(nodeId).color : "sky";
}

export function HashRing({
  snapshot,
  walkProgress,
}: {
  snapshot: HashSnapshot;
  /** 0–1 progress through the current clockwise walk, if any. */
  walkProgress: number;
}) {
  const { cx, cy, size, tokenR, keyR, walkR } = RING_LAYOUT;
  const walkPos =
    snapshot.walk == null
      ? null
      : interpolateClockwise(
          snapshot.walk.from,
          snapshot.walk.to,
          walkProgress,
          RING_SIZE
        );
  const walkPath =
    snapshot.walk == null
      ? null
      : clockwiseArcPath(
          snapshot.walk.from,
          snapshot.walk.to,
          walkR,
          walkProgress
        );
  const walker = walkPos == null ? null : polar(walkPos, walkR);

  const highlightKeys = new Set(snapshot.highlightKeyIds);
  const movedKeys = new Set(snapshot.movedKeyIds);
  const highlightTokens = new Set(snapshot.highlightTokenIds);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={
        snapshot.mode === "ring"
          ? "Consistent hashing ring with virtual nodes and keys"
          : "Keys on a hash circle, colored by modulo owner"
      }
      data-hash-ring
      data-hash-mode={snapshot.mode}
      className="mx-auto h-auto w-full max-w-[26rem]"
    >
      <circle
        cx={cx}
        cy={cy}
        r={tokenR}
        className="fill-none stroke-gray-300 dark:stroke-gray-600"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        className="fill-gray-500 text-[11px] dark:fill-gray-400"
      >
        {snapshot.mode === "ring" ? "hash ring" : "hash % N"}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        className="fill-gray-400 text-[10px] dark:fill-gray-500"
      >
        {snapshot.mode === "ring"
          ? "next vnode clockwise"
          : `${snapshot.nodeIds.length} buckets`}
      </text>

      {walkPath ? (
        <path
          d={walkPath}
          fill="none"
          className="stroke-amber-400 dark:stroke-amber-300"
          strokeWidth={3}
          strokeLinecap="round"
          data-hash-walk
        />
      ) : null}
      {walker ? (
        <circle
          cx={walker.x}
          cy={walker.y}
          r={5}
          className="fill-amber-400 stroke-white dark:fill-amber-300 dark:stroke-gray-950"
          strokeWidth={1.5}
          data-hash-walker
        />
      ) : null}

      {snapshot.tokens.map((token) => {
        const pt = polar(token.position, tokenR);
        const color = ownerColor(token.nodeId);
        const active = highlightTokens.has(token.id);
        return (
          <g key={token.id} data-hash-token={token.id}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={active ? 9 : 7}
              className={cn(
                NODE_DOT[color],
                "stroke-white dark:stroke-gray-950",
                active && "stroke-amber-400 dark:stroke-amber-300"
              )}
              strokeWidth={active ? 3 : 2}
            >
              <title>{`${nodeSpec(token.nodeId).label} vnode ${token.vnode}`}</title>
            </circle>
          </g>
        );
      })}

      {snapshot.keys.map((key) => {
        const pt = polar(key.position, keyR);
        const owner = snapshot.assignment[key.id];
        const color = ownerColor(owner);
        const active = highlightKeys.has(key.id);
        const moved = movedKeys.has(key.id);
        return (
          <g
            key={key.id}
            data-hash-key={key.id}
            data-hash-owner={owner}
            data-hash-moved={moved ? "true" : "false"}
          >
            <circle
              cx={pt.x}
              cy={pt.y}
              r={active || moved ? 6 : 4.5}
              className={cn(
                KEY_DOT[color],
                "stroke-white dark:stroke-gray-950",
                (active || moved) && "stroke-amber-400 dark:stroke-amber-300"
              )}
              strokeWidth={active || moved ? 2.5 : 1.5}
            />
            <text
              x={pt.x}
              y={pt.y + (pt.y >= cy ? 14 : -8)}
              textAnchor="middle"
              className={cn(
                "fill-gray-600 text-[8px] dark:fill-gray-300",
                (active || moved) && "font-semibold fill-gray-900 dark:fill-white"
              )}
            >
              {key.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
