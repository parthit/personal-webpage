"use client";

import { useId, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/replication/animation";
import type { Replica, SimKind } from "@/lib/replication/model";
import {
  layoutReplicas,
  packetHops,
  type GraphNode,
  type GraphTopology,
} from "@/lib/replication/layout";
import { ReplicaCard } from "./ReplicaCard";

export function ReplicaGraph({
  replicas,
  highlightIds,
  kind,
  fromId,
  toId,
  packetLabel,
  topology,
  linkBroken = false,
  ariaLabel,
}: {
  replicas: Replica[];
  highlightIds: string[];
  kind: SimKind;
  fromId?: string;
  toId?: string;
  packetLabel?: string;
  topology: GraphTopology;
  linkBroken?: boolean;
  ariaLabel: string;
}) {
  const markerId = useId().replace(/:/g, "");
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);
  const layout = useMemo(
    () => layoutReplicas(replicas, topology, { linkBroken }),
    [replicas, topology, linkBroken]
  );
  const hops = useMemo(
    () =>
      packetHops(layout, {
        kind,
        fromId,
        toId,
        highlightIds,
        label: packetLabel,
      }),
    [layout, kind, fromId, toId, highlightIds, packetLabel]
  );

  const nodeById = useMemo(() => {
    const map = new Map(layout.nodes.map((n) => [n.id, n]));
    return map;
  }, [layout]);

  const hopKey = hops.map((h) => `${h.fromId}->${h.toId}:${kind}`).join("|");
  const replicaById = useMemo(() => {
    const map = new Map(replicas.map((r) => [r.id, r]));
    return map;
  }, [replicas]);

  return (
    <div
      className="min-w-0 w-full overflow-x-auto overscroll-x-contain touch-pan-x"
      data-repl-graph={topology}
    >
      <div
        className="relative mx-auto"
        style={{
          width: layout.width,
          height: layout.height,
          minWidth: layout.width,
        }}
        role="img"
        aria-label={ariaLabel}
      >
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="absolute inset-0 block overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <marker
              id={`${markerId}-arrow`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                className="fill-gray-400 dark:fill-gray-500"
              />
            </marker>
            <marker
              id={`${markerId}-arrow-active`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                className="fill-amber-500 dark:fill-amber-400"
              />
            </marker>
          </defs>
          {layout.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const pts = edgeEndpoints(from, to);
            const active = hops.some(
              (h) =>
                (h.fromId === edge.from && h.toId === edge.to) ||
                (h.fromId === edge.to && h.toId === edge.from)
            );
            return (
              <line
                key={edge.id}
                x1={pts.x1}
                y1={pts.y1}
                x2={pts.x2}
                y2={pts.y2}
                data-repl-edge={edge.kind}
                data-repl-edge-from={edge.from}
                data-repl-edge-to={edge.to}
                data-repl-edge-broken={edge.broken ? "true" : "false"}
                data-repl-edge-active={active ? "true" : "false"}
                className={cn(
                  "repl-edge",
                  edge.broken
                    ? "stroke-red-400 dark:stroke-red-500"
                    : active
                      ? "stroke-amber-500 dark:stroke-amber-400"
                      : "stroke-gray-300 dark:stroke-gray-600"
                )}
                strokeWidth={active ? 2.4 : edge.kind === "peer" ? 1.6 : 1.8}
                strokeDasharray={
                  edge.broken ? "6 5" : edge.kind === "peer" ? "4 6" : undefined
                }
                markerEnd={
                  edge.kind === "replication" || edge.kind === "client"
                    ? `url(#${markerId}-${active ? "arrow-active" : "arrow"})`
                    : undefined
                }
              />
            );
          })}
          {hops.map((hop) => {
            const from = nodeById.get(hop.fromId);
            const to = nodeById.get(hop.toId);
            if (!from || !to) return null;
            const pts = edgeEndpoints(from, to);
            const d = `M ${pts.x1} ${pts.y1} L ${pts.x2} ${pts.y2}`;
            const midX = (pts.x1 + pts.x2) / 2;
            const midY = (pts.y1 + pts.y2) / 2;
            const reduced = reducedMotion;
            const restX = pts.x1 + (pts.x2 - pts.x1) * 0.72;
            const restY = pts.y1 + (pts.y2 - pts.y1) * 0.72;
            return (
              <g key={`${hop.fromId}-${hop.toId}-${hopKey}`}>
                {reduced ? (
                  <circle
                    cx={restX}
                    cy={restY}
                    r={5.5}
                    data-repl-packet
                    className="fill-amber-500 dark:fill-amber-400"
                  />
                ) : (
                  <circle
                    r={5.5}
                    data-repl-packet
                    className="fill-amber-500 dark:fill-amber-400"
                  >
                    <animateMotion dur="1.2s" fill="freeze" path={d} />
                  </circle>
                )}
                {hop.label ? (
                  <text
                    x={midX}
                    y={midY - 10}
                    textAnchor="middle"
                    className="fill-amber-800 text-[10px] font-medium dark:fill-amber-200"
                    data-packet-label
                  >
                    {hop.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {layout.nodes.map((node) => {
          if (node.kind === "client") {
            return (
              <div
                key={node.id}
                data-repl-client={node.id}
                className="pointer-events-none absolute flex items-center justify-center rounded-full border border-gray-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-950 dark:text-gray-300"
                style={{
                  left: node.x - node.width / 2,
                  top: node.y - node.height / 2,
                  width: node.width,
                  height: node.height,
                }}
              >
                {node.label}
              </div>
            );
          }
          const replica = replicaById.get(node.replicaId ?? "");
          if (!replica) return null;
          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: node.x - node.width / 2,
                top: node.y - node.height / 2,
                width: node.width,
                height: node.height,
              }}
            >
              <ReplicaCard
                replica={replica}
                highlight={highlightIds.includes(replica.id)}
                compact
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function edgeEndpoints(from: GraphNode, to: GraphNode) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const start = rectExit(from, ux, uy);
  const end = rectExit(to, -ux, -uy);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

function rectExit(
  box: GraphNode,
  ux: number,
  uy: number
): { x: number; y: number } {
  const hx = box.width / 2;
  const hy = box.height / 2;
  const tx = ux === 0 ? Number.POSITIVE_INFINITY : hx / Math.abs(ux);
  const ty = uy === 0 ? Number.POSITIVE_INFINITY : hy / Math.abs(uy);
  const t = Math.min(tx, ty);
  return { x: box.x + ux * t, y: box.y + uy * t };
}
