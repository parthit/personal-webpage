import type { Replica, SimKind } from "./model";

export const GRAPH = {
  PAD: 28,
  NODE_W: 140,
  NODE_H: 100,
  CLIENT_W: 86,
  CLIENT_H: 32,
  H_GAP: 48,
  V_GAP: 64,
  QUORUM_NODE_W: 118,
  QUORUM_NODE_H: 88,
  QUORUM_RADIUS: 168,
} as const;

export type GraphTopology = "leader-tree" | "multi-leader" | "quorum";

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  kind: "replica" | "client";
  replicaId?: string;
  label?: string;
  width: number;
  height: number;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: "client" | "replication" | "peer";
  broken?: boolean;
};

export type ReplicaGraphLayout = {
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type PacketHop = {
  fromId: string;
  toId: string;
  label?: string;
};

function nodeBox(
  id: string,
  x: number,
  y: number,
  replicaId: string,
  width: number = GRAPH.NODE_W,
  height: number = GRAPH.NODE_H
): GraphNode {
  return { id, x, y, kind: "replica", replicaId, width, height };
}

function clientBox(
  id: string,
  x: number,
  y: number,
  label: string
): GraphNode {
  return {
    id,
    x,
    y,
    kind: "client",
    label,
    width: GRAPH.CLIENT_W,
    height: GRAPH.CLIENT_H,
  };
}

function edge(
  from: string,
  to: string,
  kind: GraphEdge["kind"],
  broken = false
): GraphEdge {
  return { id: `${kind}:${from}->${to}`, from, to, kind, broken };
}

function rowXs(count: number, width: number, pad: number, nodeW: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [width / 2];
  const inner = width - pad * 2 - nodeW;
  const step = inner / (count - 1);
  return Array.from({ length: count }, (_, i) => pad + nodeW / 2 + i * step);
}

export function layoutLeaderTree(replicas: Replica[]): ReplicaGraphLayout {
  const livingLeader = replicas.find((r) => r.role === "leader" && r.alive);
  const anyLeader = livingLeader ?? replicas.find((r) => r.role === "leader");
  const leader = anyLeader ?? replicas[0];
  const followers = replicas.filter((r) => r.id !== leader.id);

  const colCount = Math.max(followers.length, 1);
  const rowWidth =
    colCount * GRAPH.NODE_W + Math.max(0, colCount - 1) * GRAPH.H_GAP;
  const width = Math.max(rowWidth, GRAPH.NODE_W, GRAPH.CLIENT_W) + GRAPH.PAD * 2;

  const clientY = GRAPH.PAD + GRAPH.CLIENT_H / 2;
  const leaderY = clientY + GRAPH.CLIENT_H / 2 + GRAPH.V_GAP + GRAPH.NODE_H / 2;
  const followerY =
    followers.length === 0
      ? leaderY
      : leaderY + GRAPH.NODE_H / 2 + GRAPH.V_GAP + GRAPH.NODE_H / 2;
  const height =
    (followers.length === 0 ? leaderY : followerY) +
    GRAPH.NODE_H / 2 +
    GRAPH.PAD;

  const nodes: GraphNode[] = [
    clientBox("client", width / 2, clientY, "client"),
    nodeBox(`replica:${leader.id}`, width / 2, leaderY, leader.id),
  ];

  const xs = rowXs(followers.length, width, GRAPH.PAD, GRAPH.NODE_W);
  followers.forEach((r, i) => {
    nodes.push(nodeBox(`replica:${r.id}`, xs[i], followerY, r.id));
  });

  const edges: GraphEdge[] = [
    edge("client", `replica:${leader.id}`, "client", !leader.alive),
    ...followers.map((r) =>
      edge(
        `replica:${leader.id}`,
        `replica:${r.id}`,
        "replication",
        !leader.alive || !r.alive
      )
    ),
  ];

  return { width, height, nodes, edges };
}

export function layoutMultiLeader(
  replicas: Replica[],
  linkBroken = false
): ReplicaGraphLayout {
  const ordered = [...replicas].sort((a, b) => a.id.localeCompare(b.id));
  const count = Math.max(ordered.length, 1);
  const rowWidth =
    count * GRAPH.NODE_W + Math.max(0, count - 1) * (GRAPH.H_GAP + 40);
  const width = rowWidth + GRAPH.PAD * 2;

  const clientY = GRAPH.PAD + GRAPH.CLIENT_H / 2;
  const replicaY = clientY + GRAPH.CLIENT_H / 2 + GRAPH.V_GAP + GRAPH.NODE_H / 2;
  const height = replicaY + GRAPH.NODE_H / 2 + 36 + GRAPH.PAD;
  const xs = rowXs(count, width, GRAPH.PAD, GRAPH.NODE_W);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  ordered.forEach((r, i) => {
    const replicaNodeId = `replica:${r.id}`;
    const clientId = `client:${r.id}`;
    nodes.push(clientBox(clientId, xs[i], clientY, `${r.name} client`));
    nodes.push(nodeBox(replicaNodeId, xs[i], replicaY, r.id));
    edges.push(edge(clientId, replicaNodeId, "client", !r.alive));
  });

  for (let i = 0; i < ordered.length - 1; i += 1) {
    edges.push(
      edge(
        `replica:${ordered[i].id}`,
        `replica:${ordered[i + 1].id}`,
        "peer",
        linkBroken || !ordered[i].alive || !ordered[i + 1].alive
      )
    );
  }

  return { width, height, nodes, edges };
}

export function layoutQuorum(replicas: Replica[]): ReplicaGraphLayout {
  const n = replicas.length;
  const radius = GRAPH.QUORUM_RADIUS;
  const nodeW = GRAPH.QUORUM_NODE_W;
  const nodeH = GRAPH.QUORUM_NODE_H;
  const extent = radius + Math.max(nodeW, nodeH) / 2;
  const width = extent * 2 + GRAPH.PAD * 2;
  const height = extent * 2 + GRAPH.PAD * 2;
  const cx = width / 2;
  const cy = height / 2;

  const nodes: GraphNode[] = [
    clientBox("client", cx, cy, "client"),
  ];
  const edges: GraphEdge[] = [];

  replicas.forEach((r, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const replicaNodeId = `replica:${r.id}`;
    nodes.push(nodeBox(replicaNodeId, x, y, r.id, nodeW, nodeH));
    edges.push(edge("client", replicaNodeId, "client", !r.alive));
  });

  for (let i = 0; i < n; i += 1) {
    const a = replicas[i];
    const b = replicas[(i + 1) % n];
    edges.push(
      edge(
        `replica:${a.id}`,
        `replica:${b.id}`,
        "peer",
        !a.alive || !b.alive
      )
    );
  }

  return { width, height, nodes, edges };
}

export function layoutReplicas(
  replicas: Replica[],
  topology: GraphTopology,
  options: { linkBroken?: boolean } = {}
): ReplicaGraphLayout {
  if (topology === "multi-leader") {
    return layoutMultiLeader(replicas, options.linkBroken ?? false);
  }
  if (topology === "quorum") {
    return layoutQuorum(replicas);
  }
  return layoutLeaderTree(replicas);
}

function replicaNodeId(replicaId: string): string {
  return `replica:${replicaId}`;
}

function nodeById(layout: ReplicaGraphLayout, id: string): GraphNode | undefined {
  return layout.nodes.find((n) => n.id === id);
}

function nearestClient(
  layout: ReplicaGraphLayout,
  replicaId?: string
): GraphNode | undefined {
  if (replicaId) {
    const dedicated = nodeById(layout, `client:${replicaId}`);
    if (dedicated) return dedicated;
  }
  return layout.nodes.find((n) => n.kind === "client");
}

/**
 * Map a simulation frame onto one or more graph hops so packets travel
 * along the drawn edges instead of appearing inside table cells.
 */
export function packetHops(
  layout: ReplicaGraphLayout,
  args: {
    kind: SimKind;
    fromId?: string;
    toId?: string;
    highlightIds: string[];
    label?: string;
  }
): PacketHop[] {
  const { kind, fromId, toId, highlightIds, label } = args;
  const hops: PacketHop[] = [];

  const push = (from: string | undefined, to: string | undefined) => {
    if (!from || !to || from === to) return;
    if (!nodeById(layout, from) || !nodeById(layout, to)) return;
    hops.push({ fromId: from, toId: to, label });
  };

  const clientFor = (replicaId?: string) => nearestClient(layout, replicaId)?.id;

  switch (kind) {
    case "client-send":
    case "quorum-write":
    case "leader-apply":
      if (toId) {
        push(clientFor(toId), replicaNodeId(toId));
      } else {
        for (const id of highlightIds) {
          push(clientFor(id), replicaNodeId(id));
        }
      }
      break;
    case "read":
      if (fromId) {
        push(replicaNodeId(fromId), clientFor(fromId));
      } else if (toId) {
        push(clientFor(toId), replicaNodeId(toId));
      }
      break;
    case "stale-read":
      if (fromId) {
        push(replicaNodeId(fromId), clientFor(fromId));
      } else if (toId) {
        push(clientFor(toId), replicaNodeId(toId));
      }
      break;
    case "quorum-read":
      if (fromId) {
        push(replicaNodeId(fromId), clientFor(fromId));
      } else if (toId) {
        push(clientFor(toId), replicaNodeId(toId));
      } else {
        for (const id of highlightIds) {
          push(clientFor(id), replicaNodeId(id));
        }
      }
      break;
    case "client-ack":
      if (fromId) {
        push(replicaNodeId(fromId), clientFor(fromId));
      } else {
        for (const id of highlightIds) {
          push(replicaNodeId(id), clientFor(id));
        }
      }
      break;
    case "replicate":
    case "follower-apply":
    case "follower-ack":
    case "conflict":
      if (fromId && toId) {
        push(replicaNodeId(fromId), replicaNodeId(toId));
      } else if (fromId && !toId) {
        push(replicaNodeId(fromId), clientFor(fromId));
      }
      break;
    default:
      break;
  }

  return hops;
}
