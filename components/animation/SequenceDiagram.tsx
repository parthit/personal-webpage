"use client";

import { useEffect, useId, useMemo, useRef } from "react";
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
  now,
  stepFrom = now,
  stepTo = now,
  followPlayhead = false,
  highlightActorIds = [],
  highlightMessageIds = [],
  ariaLabel,
}: {
  scenario: SequenceScenario;
  /** Single source of truth for all time-dependent geometry. */
  now: number;
  /** Current teaching interval, exposed for tests and diagnostics. */
  stepFrom?: number;
  stepTo?: number;
  /** Keep the current time in view on narrow horizontal scrollers. */
  followPlayhead?: boolean;
  highlightActorIds?: string[];
  highlightMessageIds?: string[];
  ariaLabel: string;
}) {
  const markerId = useId().replace(/:/g, "");
  const descriptionId = `${markerId}-sequence-description`;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const layout = useMemo(() => layoutSequence(scenario), [scenario]);
  const view = useMemo(() => viewAt(scenario, now), [scenario, now]);
  const highlightActors = useMemo(
    () => new Set(highlightActorIds),
    [highlightActorIds]
  );
  const highlightMessages = useMemo(
    () => new Set(highlightMessageIds),
    [highlightMessageIds]
  );

  useEffect(() => {
    if (!followPlayhead) return;
    const scroller = scrollRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 1) return;
    const x = xAt(layout, now, scenario.duration);
    const leftGuard = scroller.scrollLeft + Math.min(120, scroller.clientWidth / 3);
    const rightGuard = scroller.scrollLeft + scroller.clientWidth - 48;
    const before = scroller.scrollLeft;
    if (x > rightGuard) {
      scroller.scrollLeft = x - scroller.clientWidth + 48;
    } else if (x < leftGuard) {
      scroller.scrollLeft = Math.max(0, x - Math.min(120, scroller.clientWidth / 3));
    }
    if (scroller.scrollLeft !== before) {
      // #region agent log
      void fetch("/api/agent-debug", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hypothesisId: "B",
          location: "SequenceDiagram.tsx:follow-playhead",
          message: "Sequence scroller position mutated",
          data: {
            scenarioId: scenario.id,
            now,
            followPlayhead,
            before,
            after: scroller.scrollLeft,
            x,
            clientWidth: scroller.clientWidth,
            scrollWidth: scroller.scrollWidth,
          },
        }),
      });
      // #endregion
    }
  }, [followPlayhead, layout, now, scenario.duration, scenario.id]);

  return (
    <>
      <p id={descriptionId} className="sr-only">
        {scenario.title}. Logical time runs left to right across tracks for{" "}
        {scenario.actors.map((actor) => actor.label).join(", ")}. Requests,
        database processing, client waiting, responses, and transaction end
        events appear as the playhead advances. The step history provides the
        same sequence as text.
      </p>
      <ul
        className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400"
        aria-label="Sequence diagram timing legend"
        data-sequence-legend
      >
        <LegendItem className="bg-amber-500" label="request" />
        <LegendItem className="bg-sky-500" label="database processing" />
        <LegendItem className="bg-violet-500" label="client waiting" />
        <LegendItem className="bg-gray-500" label="response" />
      </ul>
      <ScrollableFigure
      scrollRef={scrollRef}
      revision={`${layout.width}:${scenario.id}`}
      label="Scroll sideways to follow time across the tracks"
      ariaLabel={`${ariaLabel}. Scroll horizontally to follow logical time.`}
      fadeClassName="from-gray-50 dark:from-gray-900"
      data-sequence-diagram={scenario.id}
      data-playhead={now.toFixed(2)}
      data-playhead-from={stepFrom.toFixed(2)}
      data-playhead-to={stepTo.toFixed(2)}
    >
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="block max-w-none"
        role="img"
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
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
          logical time
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

        {view.intervals.map((interval) => {
          const y = layout.tracks.find(
            (track) => track.actor.id === interval.actorId
          )?.y;
          if (y === undefined) return null;
          const x1 = xAt(layout, interval.t0, scenario.duration);
          const x2 = Math.max(
            x1 + 2,
            xAt(layout, interval.t1, scenario.duration)
          );
          const processing = interval.kind === "processing";
          const barY = processing ? y - 7 : y + 12;
          const barHeight = processing ? 14 : 5;
          const width = x2 - x1;
          return (
            <g
              key={interval.id}
              data-sequence-interval={interval.id}
              data-sequence-interval-kind={interval.kind}
              data-sequence-interval-status={interval.status}
            >
              <rect
                x={x1}
                y={barY}
                width={width}
                height={barHeight}
                rx={barHeight / 2}
                className={
                  processing
                    ? interval.status === "active"
                      ? "fill-sky-500 dark:fill-sky-400"
                      : "fill-sky-300/80 dark:fill-sky-500/60"
                    : interval.status === "active"
                      ? "fill-violet-500/70 dark:fill-violet-400/70"
                      : "fill-violet-300/60 dark:fill-violet-500/40"
                }
              />
              {width >= (processing ? 30 : 80) ? (
                <text
                  x={x1 + width / 2}
                  y={processing ? barY - 4 : barY + 14}
                  textAnchor="middle"
                  className={
                    processing
                      ? "fill-sky-700 text-[9px] font-medium dark:fill-sky-200"
                      : "fill-violet-700 text-[9px] font-medium dark:fill-violet-200"
                  }
                >
                  {interval.label}
                </text>
              ) : null}
            </g>
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
    </>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-4 rounded-full", className)}
      />
      {label}
    </li>
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
  const request = message.kind === "request";
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
          request
            ? "stroke-amber-500 dark:stroke-amber-400"
            : "stroke-gray-500 dark:stroke-gray-300"
        }
        strokeWidth={active ? 1.8 : 1.35}
        markerEnd={`url(#${markerId}-${request ? "arrow-active" : "arrow"})`}
      />
      {message.label ? (
        <text
          x={geom.mx}
          y={labelY}
          textAnchor="middle"
          className={
            request
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
