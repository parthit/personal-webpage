import { lerp } from "./core";

/**
 * DDIA-style sequence diagrams: actors on parallel tracks, time left-to-right,
 * requests and replies as diagonal arrows, notes and commit ticks on the tracks.
 *
 * The renderer is deliberately clock-agnostic: its owner supplies one `now`
 * value shared by geometry, captions, and state projections.
 */

export type ActorKind = "person" | "record" | "process";

export type SequenceActor = {
  id: string;
  label: string;
  kind: ActorKind;
  /** Optional band, e.g. "Clients" / "Records". */
  group?: string;
  subtitle?: string;
};

export type MessageKind = "request" | "response";

export type SequenceMessage = {
  id: string;
  /** Links the request and response arrows for one round trip. */
  exchangeId?: string;
  from: string;
  to: string;
  t0: number;
  t1: number;
  label: string;
  kind: MessageKind;
};

export type SequenceNote = {
  id: string;
  actorId: string;
  at: number;
  text: string;
};

export type SequenceEventKind = "begin" | "commit" | "abort" | "retry";

export type SequenceEvent = {
  id: string;
  actorId: string;
  at: number;
  label: string;
  kind: SequenceEventKind;
};

export type SequenceSpan = {
  id: string;
  actorId: string;
  t0: number;
  t1: number;
  label?: string;
  status: "active" | "committed" | "aborted";
};

export type SequenceIntervalKind = "waiting" | "processing" | "lock";

/**
 * A duration that matters independently of an arrow: client wait time,
 * server-side work, or time blocked on a lock.
 */
export type SequenceInterval = {
  id: string;
  exchangeId?: string;
  actorId: string;
  t0: number;
  t1: number;
  label: string;
  kind: SequenceIntervalKind;
};

export type SequenceScenario = {
  id: string;
  title: string;
  duration: number;
  actors: SequenceActor[];
  messages: SequenceMessage[];
  notes: SequenceNote[];
  events: SequenceEvent[];
  spans: SequenceSpan[];
  intervals?: SequenceInterval[];
};

export type MessageStatus = "pending" | "inflight" | "arrived";

export type ViewedMessage = SequenceMessage & {
  status: MessageStatus;
  /** 0–1 along the arrow; pending is 0, arrived is 1. */
  progress: number;
};

export type SequenceView = {
  now: number;
  duration: number;
  actors: SequenceActor[];
  messages: ViewedMessage[];
  notes: SequenceNote[];
  events: SequenceEvent[];
  spans: SequenceSpan[];
  intervals: Array<
    SequenceInterval & { status: "active" | "complete" }
  >;
};

export function clampTime(now: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(duration, Math.max(0, now));
}

export function messageProgress(
  message: SequenceMessage,
  now: number
): { status: MessageStatus; progress: number } {
  if (now < message.t0) return { status: "pending", progress: 0 };
  if (message.t1 <= message.t0) {
    return { status: "arrived", progress: 1 };
  }
  if (now >= message.t1) return { status: "arrived", progress: 1 };
  const progress = (now - message.t0) / (message.t1 - message.t0);
  return { status: "inflight", progress: Math.min(1, Math.max(0, progress)) };
}

export function viewAt(scenario: SequenceScenario, now: number): SequenceView {
  const t = clampTime(now, scenario.duration);
  return {
    now: t,
    duration: scenario.duration,
    actors: scenario.actors,
    messages: scenario.messages.map((message) => {
      const { status, progress } = messageProgress(message, t);
      return { ...message, status, progress };
    }),
    notes: scenario.notes.filter((note) => note.at <= t + 1e-9),
    events: scenario.events.filter((event) => event.at <= t + 1e-9),
    spans: scenario.spans
      .filter((span) => span.t0 <= t + 1e-9)
      .map((span) => ({
        ...span,
        t1: Math.min(span.t1, t),
        status: span.t1 <= t + 1e-9 ? span.status : "active",
      })),
    intervals: (scenario.intervals ?? [])
      .filter((interval) => interval.t0 <= t + 1e-9)
      .map((interval) => ({
        ...interval,
        t1: Math.min(interval.t1, t),
        status:
          interval.t1 <= t + 1e-9
            ? ("complete" as const)
            : ("active" as const),
      })),
  };
}

export type SequenceExchange = {
  id: string;
  callerId: string;
  handlerId: string;
  startAt: number;
  requestDuration: number;
  processingDuration: number;
  responseDuration: number;
  requestLabel: string;
  responseLabel: string;
};

/**
 * Compile one request/process/response round trip into diagram primitives.
 * Keeping this timing model in the shared engine prevents callers from drawing
 * a response at the same instant the request arrives.
 */
export function buildSequenceExchange(exchange: SequenceExchange): {
  request: SequenceMessage;
  response: SequenceMessage;
  intervals: SequenceInterval[];
  requestArrivesAt: number;
  responseStartsAt: number;
  responseArrivesAt: number;
} {
  const requestDuration = Math.max(0, exchange.requestDuration);
  const processingDuration = Math.max(0, exchange.processingDuration);
  const responseDuration = Math.max(0, exchange.responseDuration);
  const requestArrivesAt = exchange.startAt + requestDuration;
  const responseStartsAt = requestArrivesAt + processingDuration;
  const responseArrivesAt = responseStartsAt + responseDuration;

  return {
    request: {
      id: `${exchange.id}-request`,
      exchangeId: exchange.id,
      from: exchange.callerId,
      to: exchange.handlerId,
      t0: exchange.startAt,
      t1: requestArrivesAt,
      label: exchange.requestLabel,
      kind: "request",
    },
    response: {
      id: `${exchange.id}-response`,
      exchangeId: exchange.id,
      from: exchange.handlerId,
      to: exchange.callerId,
      t0: responseStartsAt,
      t1: responseArrivesAt,
      label: exchange.responseLabel,
      kind: "response",
    },
    intervals: [
      {
        id: `${exchange.id}-waiting`,
        exchangeId: exchange.id,
        actorId: exchange.callerId,
        t0: exchange.startAt,
        t1: responseArrivesAt,
        label: "waiting for response",
        kind: "waiting",
      },
      {
        id: `${exchange.id}-processing`,
        exchangeId: exchange.id,
        actorId: exchange.handlerId,
        t0: requestArrivesAt,
        t1: responseStartsAt,
        label: "processing",
        kind: "processing",
      },
    ],
    requestArrivesAt,
    responseStartsAt,
    responseArrivesAt,
  };
}

export type SequenceLayout = {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  tracks: Array<{
    actor: SequenceActor;
    y: number;
  }>;
  groups: Array<{ name: string; y0: number; y1: number }>;
};

const LABEL_COL = 138;
const RIGHT_PAD = 52;
const TOP_PAD = 18;
const BOTTOM_PAD = 22;
const LANE_H = 76;
const GROUP_HEADER = 20;
const GROUP_GAP = 10;
const PX_PER_TICK = 34;
const MIN_PLOT_W = 400;

export function layoutSequence(scenario: SequenceScenario): SequenceLayout {
  const groups: Array<{ name: string; actors: SequenceActor[] }> = [];
  const index = new Map<string, number>();
  for (const actor of scenario.actors) {
    const name = actor.group ?? "";
    const existing = index.get(name);
    if (existing === undefined) {
      index.set(name, groups.length);
      groups.push({ name, actors: [actor] });
    } else {
      groups[existing].actors.push(actor);
    }
  }

  const plotLeft = LABEL_COL;
  const plotW = Math.max(MIN_PLOT_W, Math.ceil(scenario.duration * PX_PER_TICK));
  const plotRight = plotLeft + plotW;
  const width = plotRight + RIGHT_PAD;

  const tracks: SequenceLayout["tracks"] = [];
  const groupBoxes: SequenceLayout["groups"] = [];
  let y = TOP_PAD;

  for (const group of groups) {
    const named = group.name.length > 0;
    const y0 = y;
    if (named) y += GROUP_HEADER;
    for (const actor of group.actors) {
      tracks.push({ actor, y: y + LANE_H / 2 });
      y += LANE_H;
    }
    const y1 = y;
    if (named) {
      groupBoxes.push({ name: group.name, y0, y1 });
    }
    y += GROUP_GAP;
  }

  const plotBottom = y - GROUP_GAP;
  const height = plotBottom + BOTTOM_PAD;

  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotTop: TOP_PAD,
    plotBottom,
    tracks,
    groups: groupBoxes,
  };
}

export function xAt(layout: SequenceLayout, t: number, duration: number): number {
  if (duration <= 0) return layout.plotLeft;
  const p = Math.min(1, Math.max(0, t / duration));
  return layout.plotLeft + p * (layout.plotRight - layout.plotLeft);
}

export function trackY(
  layout: SequenceLayout,
  actorId: string
): number | undefined {
  return layout.tracks.find((track) => track.actor.id === actorId)?.y;
}

export function arrowEndpoints(
  layout: SequenceLayout,
  duration: number,
  message: SequenceMessage,
  progress = 1
): { x1: number; y1: number; x2: number; y2: number; mx: number; my: number } | null {
  const y1 = trackY(layout, message.from);
  const y2 = trackY(layout, message.to);
  if (y1 === undefined || y2 === undefined) return null;
  const x1 = xAt(layout, message.t0, duration);
  const xEnd = xAt(layout, message.t1, duration);
  const p = Math.min(1, Math.max(0, progress));
  const x2 = lerp(x1, xEnd, p);
  const yTip = lerp(y1, y2, p);
  return {
    x1,
    y1,
    x2,
    y2: yTip,
    mx: (x1 + x2) / 2,
    my: (y1 + yTip) / 2,
  };
}
