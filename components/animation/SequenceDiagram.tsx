"use client";

import { useId, useMemo, useRef, useSyncExternalStore } from "react";
import {
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  reducedMotionSubscribe,
  visiblePlayhead,
} from "@/lib/animation/core";
import { useLiveStepProgress } from "./useLiveStepProgress";
import {
  arrowEndpoints,
  layoutSequence,
  viewAt,
  xAt,
  type SequenceActor,
  type SequenceScenario,
  type ViewedMessage,
} from "@/lib/animation/sequence";
import { cn } from "@/lib/utils";
import { ScrollableFigure } from "@/components/content/mdx/ScrollableFigure";

export function SequenceDiagram({
  scenario,
  fromNow,
  toNow,
  stepProgress = 0,
  playing = false,
  stepDurationMs = 0,
  highlightActorIds = [],
  highlightMessageIds = [],
  ariaLabel,
}: {
  scenario: SequenceScenario;
  fromNow: number;
  toNow: number;
  stepProgress?: number;
  /** True only while the timeline is running; sampled progress is not live. */
  playing?: boolean;
  /** Current step dwell, already scaled by playback rate. */
  stepDurationMs?: number;
  highlightActorIds?: string[];
  highlightMessageIds?: string[];
  ariaLabel: string;
}) {
  const markerId = useId().replace(/:/g, "");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useSyncExternalStore(
    reducedMotionSubscribe,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const layout = useMemo(() => layoutSequence(scenario), [scenario]);
  const progress = useLiveStepProgress(
    playing && !reducedMotion,
    stepProgress,
    stepDurationMs
  );
  const now = visiblePlayhead(fromNow, toNow, progress, reducedMotion);
  const view = useMemo(() => viewAt(scenario, now), [scenario, now]);
  const highlightActors = useMemo(
    () => new Set(highlightActorIds),
    [highlightActorIds]
  );
  const highlightMessages = useMemo(
    () => new Set(highlightMessageIds),
    [highlightMessageIds]
  );

  return (
    <ScrollableFigure
      scrollRef={scrollRef}
      revision={`${layout.width}:${scenario.id}`}
      label="Scroll sideways to follow time across the tracks"
      fadeClassName="from-gray-50 dark:from-gray-900"
      data-sequence-diagram={scenario.id}
      data-playhead={now.toFixed(2)}
    >
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="block max-w-none"
        role="img"
        aria-label={ariaLabel}
        data-sequence-svg
      >
        <defs>
          <marker
            id={`${markerId}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="fill-gray-500 dark:fill-gray-400"
            />
          </marker>
          <marker
            id={`${markerId}-arrow-active`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="fill-amber-500 dark:fill-amber-400"
            />
          </marker>
          <marker
            id={`${markerId}-time`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="fill-gray-400 dark:fill-gray-500"
            />
          </marker>
        </defs>

        {layout.groups.map((group) => (
          <g key={group.name} data-sequence-group={group.name}>
            <rect
              x={8}
              y={group.y0}
              width={layout.width - 16}
              height={group.y1 - group.y0}
              rx={10}
              className="fill-gray-100/80 dark:fill-gray-800/40"
            />
            <text
              x={18}
              y={group.y0 + 14}
              className="fill-gray-500 text-[10px] font-semibold uppercase tracking-wider dark:fill-gray-400"
            >
              {group.name}
            </text>
          </g>
        ))}

        {layout.tracks.map((track) => {
          const active = highlightActors.has(track.actor.id);
          return (
            <g
              key={track.actor.id}
              data-sequence-actor={track.actor.id}
              data-sequence-actor-kind={track.actor.kind}
              data-sequence-actor-active={active ? "true" : "false"}
            >
              <line
                x1={layout.plotLeft}
                y1={track.y}
                x2={layout.plotRight}
                y2={track.y}
                className={
                  active
                    ? "stroke-amber-400 dark:stroke-amber-500"
                    : "stroke-gray-300 dark:stroke-gray-600"
                }
                strokeWidth={active ? 1.8 : 1.15}
              />
              <line
                x1={layout.plotRight}
                y1={track.y}
                x2={layout.plotRight + 28}
                y2={track.y}
                className="stroke-gray-300 dark:stroke-gray-600"
                strokeWidth={1.15}
                strokeDasharray="4 3"
                markerEnd={`url(#${markerId}-time)`}
              />
              <ActorGlyph actor={track.actor} x={18} y={track.y} active={active} />
              <text
                x={44}
                y={track.y - 4}
                className={cn(
                  "text-[12px] font-semibold",
                  active
                    ? "fill-amber-900 dark:fill-amber-100"
                    : "fill-gray-800 dark:fill-gray-100"
                )}
              >
                {track.actor.label}
              </text>
              {track.actor.subtitle ? (
                <text
                  x={44}
                  y={track.y + 12}
                  className="fill-gray-500 text-[10px] dark:fill-gray-400"
                >
                  {track.actor.subtitle}
                </text>
              ) : null}
            </g>
          );
        })}

        <text
          x={layout.plotRight + 30}
          y={layout.plotTop + 4}
          className="fill-gray-400 text-[10px] dark:fill-gray-500"
        >
          time
        </text>

        {view.spans.map((span) => {
          const y = layout.tracks.find((t) => t.actor.id === span.actorId)?.y;
          if (y === undefined) return null;
          const x1 = xAt(layout, span.t0, scenario.duration);
          const x2 = Math.max(
            x1 + 6,
            xAt(layout, span.t1, scenario.duration)
          );
          return (
            <rect
              key={span.id}
              x={x1}
              y={y - 10}
              width={x2 - x1}
              height={20}
              rx={4}
              data-sequence-span={span.actorId}
              data-sequence-span-status={span.status}
              className={
                span.status === "aborted"
                  ? "fill-rose-400/25 dark:fill-rose-400/20"
                  : span.status === "committed"
                    ? "fill-emerald-400/25 dark:fill-emerald-400/20"
                    : "fill-amber-400/25 dark:fill-amber-400/20"
              }
            />
          );
        })}

        {view.messages
          .filter((message) => message.status !== "pending")
          .map((message) => (
            <MessageArrow
              key={message.id}
              message={message}
              layout={layout}
              duration={scenario.duration}
              markerId={markerId}
              highlight={highlightMessages.has(message.id)}
            />
          ))}

        {view.notes.map((note) => {
          const y = layout.tracks.find((t) => t.actor.id === note.actorId)?.y;
          if (y === undefined) return null;
          const x = xAt(layout, note.at, scenario.duration);
          return (
            <text
              key={note.id}
              x={x}
              y={y + 22}
              textAnchor="middle"
              data-sequence-note={note.actorId}
              className="fill-gray-600 text-[10px] dark:fill-gray-300"
            >
              {note.text}
            </text>
          );
        })}

        {view.events.map((event) => {
          const y = layout.tracks.find((t) => t.actor.id === event.actorId)?.y;
          if (y === undefined) return null;
          const x = xAt(layout, event.at, scenario.duration);
          const abort = event.kind === "abort";
          return (
            <g key={event.id} data-sequence-event={event.kind} data-sequence-event-actor={event.actorId}>
              <line
                x1={x}
                y1={y - 14}
                x2={x}
                y2={y + 14}
                className={
                  abort
                    ? "stroke-rose-500 dark:stroke-rose-400"
                    : event.kind === "commit"
                      ? "stroke-emerald-600 dark:stroke-emerald-400"
                      : "stroke-gray-500 dark:stroke-gray-400"
                }
                strokeWidth={1.8}
              />
              <text
                x={x + 4}
                y={y - 18}
                className={
                  abort
                    ? "fill-rose-700 text-[10px] font-semibold dark:fill-rose-300"
                    : event.kind === "commit"
                      ? "fill-emerald-700 text-[10px] font-semibold dark:fill-emerald-300"
                      : "fill-gray-600 text-[10px] dark:fill-gray-300"
                }
              >
                {event.label}
              </text>
            </g>
          );
        })}

        {now > 0 ? (
          <line
            x1={xAt(layout, now, scenario.duration)}
            y1={layout.plotTop}
            x2={xAt(layout, now, scenario.duration)}
            y2={layout.plotBottom}
            className="stroke-amber-500/70 dark:stroke-amber-400/70"
            strokeWidth={1.2}
            strokeDasharray="3 4"
            data-sequence-playhead-line
          />
        ) : null}
      </svg>
    </ScrollableFigure>
  );
}

function ActorGlyph({
  actor,
  x,
  y,
  active,
}: {
  actor: SequenceActor;
  x: number;
  y: number;
  active: boolean;
}) {
  const stroke = active
    ? "stroke-amber-600 dark:stroke-amber-300"
    : "stroke-gray-600 dark:stroke-gray-300";
  const fill = active
    ? "fill-amber-100 dark:fill-amber-950"
    : "fill-white dark:fill-gray-950";

  if (actor.kind === "record") {
    return (
      <g transform={`translate(${x}, ${y})`} aria-hidden="true">
        <ellipse cx={10} cy={-7} rx={10} ry={4} className={cn(fill, stroke)} />
        <path
          d="M 0 -7 V 8"
          className={stroke}
          fill="none"
        />
        <path
          d="M 20 -7 V 8"
          className={stroke}
          fill="none"
        />
        <ellipse cx={10} cy={8} rx={10} ry={4} className={cn(fill, stroke)} />
      </g>
    );
  }

  return (
    <g transform={`translate(${x}, ${y})`} aria-hidden="true">
      <circle cx={10} cy={-8} r={5} className={cn(fill, stroke)} />
      <path
        d="M 10 -2 L 10 8 M 10 2 L 3 10 M 10 2 L 17 10 M 10 8 L 6 16 M 10 8 L 14 16"
        className={cn(stroke)}
        fill="none"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </g>
  );
}

function MessageArrow({
  message,
  layout,
  duration,
  markerId,
  highlight,
}: {
  message: ViewedMessage;
  layout: ReturnType<typeof layoutSequence>;
  duration: number;
  markerId: string;
  highlight: boolean;
}) {
  const geom = arrowEndpoints(layout, duration, message, message.progress);
  if (!geom) return null;
  const active = highlight || message.status === "inflight";
  const labelY =
    message.kind === "request"
      ? Math.min(geom.y1, geom.y2) - 8
      : Math.max(geom.y1, geom.y2) + 14;

  return (
    <g
      data-sequence-message={message.id}
      data-sequence-message-kind={message.kind}
      data-sequence-message-status={message.status}
    >
      <line
        x1={geom.x1}
        y1={geom.y1}
        x2={geom.x2}
        y2={geom.y2}
        className={
          active
            ? "stroke-amber-500 dark:stroke-amber-400"
            : "stroke-gray-500 dark:stroke-gray-400"
        }
        strokeWidth={active ? 1.8 : 1.35}
        markerEnd={`url(#${markerId}-${active ? "arrow-active" : "arrow"})`}
      />
      {message.label ? (
        <text
          x={geom.mx}
          y={labelY}
          textAnchor="middle"
          className={
            active
              ? "fill-amber-800 text-[10px] font-medium dark:fill-amber-200"
              : "fill-gray-600 text-[10px] dark:fill-gray-300"
          }
        >
          {message.label}
        </text>
      ) : null}
    </g>
  );
}
