import type { AnimationStep } from "@/lib/animation/core";
import {
  DEFAULT_NODE_IDS,
  DEFAULT_VNODES,
  KEY_IDS,
  assignKeys,
  keysFor,
  moduloOwner,
  nextNodeId,
  remapReport,
  successorToken,
  tokensFor,
  type HashKey,
  type HashSnapshot,
  type HashToken,
  type PlacementMode,
} from "./model";

export const HASH_STEP_MS = 1600;
export const HASH_HOLD_MS = 2200;
export const HASH_WALK_MS = 2000;

export type HashScene = {
  mode: PlacementMode;
  nodeIds: string[];
  vnodes: number;
  keys: HashKey[];
};

export function createScene(
  mode: PlacementMode = "ring",
  nodeIds: string[] = [...DEFAULT_NODE_IDS],
  vnodes: number = DEFAULT_VNODES
): HashScene {
  return {
    mode,
    nodeIds: [...nodeIds],
    vnodes,
    keys: keysFor(KEY_IDS),
  };
}

function tokensOf(scene: HashScene): HashToken[] {
  return scene.mode === "ring" ? tokensFor(scene.nodeIds, scene.vnodes) : [];
}

export function idleSnapshot(scene: HashScene): HashSnapshot {
  const tokens = tokensOf(scene);
  const assignment = assignKeys(scene.keys, scene.nodeIds, tokens, scene.mode);
  const n = scene.nodeIds.length;
  return {
    mode: scene.mode,
    nodeIds: [...scene.nodeIds],
    vnodes: scene.vnodes,
    keys: scene.keys,
    tokens,
    assignment,
    highlightKeyIds: [],
    highlightNodeIds: [],
    highlightTokenIds: [],
    movedKeyIds: [],
    walk: null,
    lookupKeyId: null,
    movedCount: null,
    moduloWouldMove: null,
    message:
      scene.mode === "ring"
        ? `${scene.keys.length} keys, ${n} servers, ${scene.vnodes} vnodes each. Add a node or look a key up — ownership is the next token clockwise.`
        : `${scene.keys.length} keys and ${n} servers. Owner is hash(key) % ${n}. Adding a server changes the divisor, so most keys usually move.`,
  };
}

function step(
  snapshot: HashSnapshot,
  label: string,
  durationMs: number
): AnimationStep<HashSnapshot> {
  return { snapshot, label, durationMs };
}

export function buildLookupSteps(
  scene: HashScene,
  keyId: string
): AnimationStep<HashSnapshot>[] {
  const base = idleSnapshot(scene);
  const key = scene.keys.find((item) => item.id === keyId);
  if (!key) {
    return [
      step(
        { ...base, message: `Unknown key “${keyId}”.` },
        "Unknown key",
        HASH_HOLD_MS
      ),
    ];
  }

  if (scene.mode === "modulo") {
    const owner = moduloOwner(key.id, scene.nodeIds) ?? "—";
    return [
      step(
        {
          ...base,
          lookupKeyId: key.id,
          highlightKeyIds: [key.id],
          highlightNodeIds: [owner],
          message: `${key.id} hashes to ${key.position}. Under modulo, owner = hash % ${scene.nodeIds.length} → ${owner.toUpperCase()}.`,
        },
        `Hash ${key.id}`,
        HASH_STEP_MS
      ),
      step(
        {
          ...base,
          lookupKeyId: key.id,
          highlightKeyIds: [key.id],
          highlightNodeIds: [owner],
          message: `${key.id} is stored on ${owner.toUpperCase()}. Change N and this formula points somewhere else.`,
        },
        `${key.id} → ${owner}`,
        HASH_HOLD_MS
      ),
    ];
  }

  const token = successorToken(key.position, base.tokens);
  const owner = token?.nodeId ?? "—";
  const walk =
    token == null
      ? null
      : { from: key.position, to: token.position, tokenId: token.id };

  return [
    step(
      {
        ...base,
        lookupKeyId: key.id,
        highlightKeyIds: [key.id],
        message: `${key.id} lands at ${key.position} on the ring. Walk clockwise to the next vnode.`,
      },
      `Place ${key.id}`,
      HASH_STEP_MS
    ),
    step(
      {
        ...base,
        lookupKeyId: key.id,
        highlightKeyIds: [key.id],
        highlightTokenIds: token ? [token.id] : [],
        highlightNodeIds: [owner],
        walk,
        message: `Walking clockwise from ${key.position} toward ${token ? token.id : "a vnode"}.`,
      },
      "Walk clockwise",
      HASH_WALK_MS
    ),
    step(
      {
        ...base,
        lookupKeyId: key.id,
        highlightKeyIds: [key.id],
        highlightTokenIds: token ? [token.id] : [],
        highlightNodeIds: [owner],
        walk,
        message: `${key.id} is owned by ${owner.toUpperCase()} (${token?.id ?? "no token"}). Only a new token in this arc would steal it.`,
      },
      `${key.id} → ${owner}`,
      HASH_HOLD_MS
    ),
  ];
}

export function buildMembershipSteps(
  scene: HashScene,
  action: "add" | "remove"
): { steps: AnimationStep<HashSnapshot>[]; nextScene: HashScene } | null {
  const before = idleSnapshot(scene);
  let nextIds: string[];

  if (action === "add") {
    const extra = nextNodeId(scene.nodeIds);
    if (!extra) return null;
    nextIds = [...scene.nodeIds, extra];
  } else {
    if (scene.nodeIds.length <= 2) return null;
    nextIds = scene.nodeIds.slice(0, -1);
  }

  const nextScene: HashScene = { ...scene, nodeIds: nextIds };
  const after = idleSnapshot(nextScene);
  const report = remapReport(before.assignment, after.assignment);

  const moduloBefore: Record<string, string> = {};
  const moduloAfter: Record<string, string> = {};
  for (const key of scene.keys) {
    const prev = moduloOwner(key.id, scene.nodeIds);
    const next = moduloOwner(key.id, nextIds);
    if (prev) moduloBefore[key.id] = prev;
    if (next) moduloAfter[key.id] = next;
  }
  const moduloReport = remapReport(moduloBefore, moduloAfter);

  const addedId = action === "add" ? nextIds[nextIds.length - 1] : null;
  const removedId = action === "remove" ? scene.nodeIds[scene.nodeIds.length - 1] : null;
  const newTokens = after.tokens.filter((token) => token.nodeId === addedId);

  const verb = action === "add" ? "Add" : "Remove";
  const subject = (addedId ?? removedId ?? "node").toUpperCase();

  const firstMessage =
    action === "add"
      ? scene.mode === "ring"
        ? `Place ${subject} on the ring (${nextScene.vnodes} vnodes). Keys between a new token and the previous token will move.`
        : `N goes from ${scene.nodeIds.length} to ${nextIds.length}. Owner becomes hash % ${nextIds.length}.`
      : scene.mode === "ring"
        ? `Take ${subject} off the ring. Its arcs fall to the next clockwise vnode.`
        : `N goes from ${scene.nodeIds.length} to ${nextIds.length}. Owner becomes hash % ${nextIds.length}.`;

  const summary =
    scene.mode === "ring"
      ? `${report.movedCount} of ${report.total} keys moved${
          addedId ? ` onto ${subject}` : ""
        }. Modulo would have moved ${moduloReport.movedCount} of ${moduloReport.total}.`
      : `${report.movedCount} of ${report.total} keys changed owner. The ring with ${scene.vnodes} vnodes would have moved ${
          remapReport(
            assignKeys(
              scene.keys,
              scene.nodeIds,
              tokensFor(scene.nodeIds, scene.vnodes),
              "ring"
            ),
            assignKeys(
              scene.keys,
              nextIds,
              tokensFor(nextIds, scene.vnodes),
              "ring"
            )
          ).movedCount
        }.`;

  const steps: AnimationStep<HashSnapshot>[] = [
    step(
      {
        ...before,
        highlightNodeIds: addedId ? [addedId] : removedId ? [removedId] : [],
        highlightTokenIds: action === "remove"
          ? before.tokens.filter((t) => t.nodeId === removedId).map((t) => t.id)
          : [],
        message: firstMessage,
      },
      `${verb} ${subject}`,
      HASH_STEP_MS
    ),
    step(
      {
        ...(action === "add" ? after : before),
        nodeIds: action === "add" ? after.nodeIds : before.nodeIds,
        tokens: action === "add" ? after.tokens : before.tokens,
        assignment: before.assignment,
        highlightNodeIds: addedId ? [addedId] : removedId ? [removedId] : [],
        highlightTokenIds:
          action === "add"
            ? newTokens.map((t) => t.id)
            : before.tokens.filter((t) => t.nodeId === removedId).map((t) => t.id),
        highlightKeyIds: report.moved,
        movedKeyIds: report.moved,
        message:
          report.movedCount === 0
            ? "None of these twelve keys sit in the affected arcs — try another membership change or fewer vnodes."
            : `These ${report.movedCount} keys sit in the affected arcs: ${report.moved.join(", ")}.`,
      },
      "Mark keys that will move",
      HASH_STEP_MS
    ),
    step(
      {
        ...after,
        highlightNodeIds: addedId ? [addedId] : [],
        highlightKeyIds: report.moved,
        movedKeyIds: report.moved,
        movedCount: report.movedCount,
        moduloWouldMove: moduloReport.movedCount,
        message: summary,
      },
      summary,
      HASH_HOLD_MS
    ),
  ];

  return { steps, nextScene };
}
