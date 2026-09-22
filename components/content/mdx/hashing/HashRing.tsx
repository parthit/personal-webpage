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
  sky: "fill-[#6673a8]",
  amber: "fill-[#d98b68]",
  emerald: "fill-[#72927f]",
  violet: "fill-[#8a7dab]",
  rose: "fill-[#bd6f78]",
};

const KEY_DOT: Record<NodeSpecColor, string> = {
  sky: "fill-[#6673a8]",
  amber: "fill-[#d98b68]",
  emerald: "fill-[#72927f]",
  violet: "fill-[#8a7dab]",
  rose: "fill-[#bd6f78]",
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
      className="mx-auto h-auto w-full max-w-[32rem]"
    >
      <defs>
        <filter id="hash-token-shadow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#4b443b" floodOpacity="0.22" />
        </filter>
        <filter id="hash-key-shadow" x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#4b443b" floodOpacity="0.2" />
        </filter>
        <linearGradient id="hash-ring-track" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eee7dc" />
          <stop offset="100%" stopColor="#d8cfc2" />
        </linearGradient>
      </defs>
      <circle
        cx={cx}
        cy={cy + 5}
        r={tokenR + 9}
        className="fill-[#d8d0c5]/40"
      />
      <circle
        cx={cx}
        cy={cy}
        r={tokenR}
        fill="none"
        stroke="url(#hash-ring-track)"
        strokeWidth={18}
      />
      <circle
        cx={cx}
        cy={cy}
        r={tokenR}
        className="fill-none stroke-white/60 dark:stroke-white/10"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        className="fill-[#343a4a] text-[13px] font-bold tracking-[0.16em] dark:fill-stone-100"
      >
        {snapshot.mode === "ring" ? "HASH RING" : "HASH % N"}
      </text>
      <text
        x={cx}
        y={cy + 7}
        textAnchor="middle"
        className="fill-[#777064] text-[10px] dark:fill-stone-400"
      >
        {snapshot.mode === "ring"
          ? `${snapshot.keys.length} keys · ${snapshot.tokens.length} tokens`
          : `${snapshot.nodeIds.length} buckets`}
      </text>
      <path
        d={`M ${cx + 43} ${cy + 33} A 50 50 0 0 1 ${cx + 67} ${cy + 7}`}
        fill="none"
        className="stroke-[#b3aa9d] dark:stroke-stone-600"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + 64} ${cy + 7} l 7 -1 l -3 7`}
        fill="none"
        className="stroke-[#b3aa9d] dark:stroke-stone-600"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {walkPath ? (
        <path
          d={walkPath}
          fill="none"
          className="stroke-amber-400 dark:stroke-amber-300"
          strokeWidth={5}
          strokeLinecap="round"
          data-hash-walk
        />
      ) : null}
      {walker ? (
        <circle
          cx={walker.x}
          cy={walker.y}
          r={7}
          className="fill-[#f0b554] stroke-white dark:stroke-stone-950"
          strokeWidth={2.5}
          filter="url(#hash-key-shadow)"
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
              r={active ? 11 : 9}
              className={cn(
                NODE_DOT[color],
                "stroke-[#faf7f1] dark:stroke-stone-950",
                active && "stroke-[#f0b554]"
              )}
              strokeWidth={active ? 4 : 3}
              filter="url(#hash-token-shadow)"
            >
              <title>{`${nodeSpec(token.nodeId).label} vnode ${token.vnode}`}</title>
            </circle>
            {token.vnode === 0 ? (
              <text
                x={pt.x}
                y={pt.y + (pt.y < cy ? -17 : 23)}
                textAnchor="middle"
                className="fill-[#4b4750] text-[9px] font-bold tracking-wide dark:fill-stone-200"
              >
                {nodeSpec(token.nodeId).label}
              </text>
            ) : null}
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
              r={active || moved ? 7 : 5}
              className={cn(
                KEY_DOT[color],
                "stroke-[#fffaf2] dark:stroke-stone-950",
                (active || moved) && "stroke-[#f0b554]"
              )}
              strokeWidth={active || moved ? 3 : 2}
              filter="url(#hash-key-shadow)"
            >
              <title>{`${key.id} → ${owner ? nodeSpec(owner).label : "unassigned"}`}</title>
            </circle>
            {active || moved ? (
              <g>
                <rect
                  x={pt.x - Math.max(22, key.id.length * 3.8)}
                  y={pt.y + (pt.y >= cy ? 11 : -29)}
                  width={Math.max(44, key.id.length * 7.6)}
                  height={18}
                  rx={9}
                  className="fill-[#fffaf2] stroke-[#d9cfc0] dark:fill-stone-800 dark:stroke-stone-600"
                />
                <text
                  x={pt.x}
                  y={pt.y + (pt.y >= cy ? 24 : -16)}
                  textAnchor="middle"
                  className="fill-[#343a4a] text-[9px] font-semibold dark:fill-stone-100"
                >
                  {key.id}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
