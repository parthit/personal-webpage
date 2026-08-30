"use client";

import { useId, useMemo, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { ScrollableFigure } from "../ScrollableFigure";
import {
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  reducedMotionSubscribe,
} from "@/lib/replication/animation";
import type { Replica, SimKind } from "@/lib/replication/model";
import {
  layoutReplicas,
  packetHops,
  type GraphNode,
  type GraphTopology,
} from "@/lib/replication/layout";
import { ReplicaCard } from "./ReplicaCard";

/** Packets should land a little before the next step swaps the frame. */
const PACKET_FLIGHT_FRACTION = 0.72;
const PACKET_MIN_MS = 280;

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
  playing = false,
  stepDurationMs,
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
  /** Packets only fly while the timeline is running. */
  playing?: boolean;
  /** Dwell of the current step, already scaled by playback speed. */
  stepDurationMs?: number;
}) {
  const markerId = useId().replace(/:/g, "");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useSyncExternalStore(
    reducedMotionSubscribe,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
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

  const replicaNodes = layout.nodes.filter((n) => n.kind === "replica");
  const centroid = replicaNodes.length
    ? {
        x: replicaNodes.reduce((s, n) => s + n.x, 0) / replicaNodes.length,
        y: replicaNodes.reduce((s, n) => s + n.y, 0) / replicaNodes.length,
      }
    : { x: layout.width / 2, y: layout.height / 2 };

  return (
    <ScrollableFigure
      scrollRef={scrollRef}
      revision={layout.width}
      label="Scroll sideways to see the whole cluster"
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
            const d = edgePath(from, to, edge.kind, centroid);
            const active = hops.some(
              (h) =>
                (h.fromId === edge.from && h.toId === edge.to) ||
                (h.fromId === edge.to && h.toId === edge.from)
            );
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                data-repl-edge={edge.kind}
                data-repl-edge-from={edge.from}
                data-repl-edge-to={edge.to}
                data-repl-edge-broken={edge.broken ? "true" : "false"}
                data-repl-edge-active={active ? "true" : "false"}
                className={cn(
                  "repl-edge",
                  edge.broken
                    ? "stroke-red-500 dark:stroke-red-400"
                    : active
                      ? "stroke-amber-500 dark:stroke-amber-400"
                      : edge.kind === "peer"
                        ? "stroke-gray-500 dark:stroke-gray-400"
                        : "stroke-gray-400 dark:stroke-gray-500"
                )}
                strokeWidth={active ? 2.6 : edge.kind === "peer" ? 2.2 : 1.8}
                strokeDasharray={
                  edge.broken ? "7 5" : edge.kind === "peer" ? "5 5" : undefined
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
            const kind =
              layout.edges.find(
                (e) =>
                  (e.from === hop.fromId && e.to === hop.toId) ||
                  (e.from === hop.toId && e.to === hop.fromId)
              )?.kind ?? "client";
            const d = edgePath(from, to, kind, centroid);
            const ctrl = controlPoint(from, to, kind, centroid);
            const inFlight = playing && !reducedMotion;
            return (
              <g key={`${hop.fromId}-${hop.toId}-${hopKey}`}>
                {/* Ringed so the token stays readable on top of the amber wire. */}
                <circle
                  cx={0}
                  cy={0}
                  r={6}
                  strokeWidth={2.5}
                  data-repl-packet
                  data-repl-packet-flying={inFlight ? "true" : "false"}
                  className={cn(
                    "fill-amber-500 stroke-white dark:fill-amber-300 dark:stroke-gray-950",
                    inFlight && "repl-packet"
                  )}
                  style={{
                    offsetPath: `path("${d}")`,
                    offsetRotate: "0deg",
                    ...(inFlight
                      ? {
                          ["--repl-packet-duration" as string]: `${packetFlightMs(
                            stepDurationMs
                          )}ms`,
                        }
                      : { offsetDistance: "100%" }),
                  }}
                />
                {hop.label ? (
                  <text
                    x={ctrl.x}
                    y={ctrl.y - 8}
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
          // Positioned by transform so a failover reshuffle glides between
          // layouts instead of teleporting the cards.
          const placement = {
            left: 0,
            top: 0,
            width: node.width,
            height: node.height,
            transform: `translate(${node.x - node.width / 2}px, ${
              node.y - node.height / 2
            }px)`,
          };

          if (node.kind === "client") {
            return (
              <div
                key={node.id}
                data-repl-client={node.id}
                className="repl-node pointer-events-none absolute flex items-center justify-center rounded-full border border-gray-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-950 dark:text-gray-300"
                style={placement}
              >
                {node.label}
              </div>
            );
          }
          const replica = replicaById.get(node.replicaId ?? "");
          if (!replica) return null;
          return (
            <div key={node.id} className="repl-node absolute" style={placement}>
              <ReplicaCard
                replica={replica}
                highlight={highlightIds.includes(replica.id)}
                compact
              />
            </div>
          );
        })}
      </div>
    </ScrollableFigure>
  );
}

function packetFlightMs(stepDurationMs?: number): number {
  if (!stepDurationMs || stepDurationMs <= 0) return 1200;
  return Math.max(PACKET_MIN_MS, Math.round(stepDurationMs * PACKET_FLIGHT_FRACTION));
}

function edgePath(
  from: GraphNode,
  to: GraphNode,
  kind: "client" | "replication" | "peer",
  centroid: { x: number; y: number }
): string {
  const pts = edgeEndpoints(from, to);
  if (kind !== "peer") {
    return `M ${pts.x1} ${pts.y1} L ${pts.x2} ${pts.y2}`;
  }
  const ctrl = controlPoint(from, to, kind, centroid);
  return `M ${pts.x1} ${pts.y1} Q ${ctrl.x} ${ctrl.y} ${pts.x2} ${pts.y2}`;
}

function controlPoint(
  from: GraphNode,
  to: GraphNode,
  kind: "client" | "replication" | "peer",
  centroid: { x: number; y: number }
): { x: number; y: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  if (kind !== "peer") return { x: mx, y: my };

  const dx = mx - centroid.x;
  const dy = my - centroid.y;
  const len = Math.hypot(dx, dy);
  if (len < 4) {
    return { x: mx, y: my + Math.max(from.height, to.height) / 2 + 18 };
  }
  const bump = 28;
  return { x: mx + (dx / len) * bump, y: my + (dy / len) * bump };
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
