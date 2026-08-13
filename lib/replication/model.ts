export type ReplicaRole = "leader" | "follower" | "peer";

export type Replica = {
  id: string;
  name: string;
  region: string;
  role: ReplicaRole;
  alive: boolean;
  value: string;
  version: number;
};

export type WriteMode = "synchronous" | "asynchronous";

export type ConflictStrategy = "last-write-wins" | "union-merge";

export type SimKind =
  | "client-send"
  | "leader-apply"
  | "replicate"
  | "follower-apply"
  | "follower-ack"
  | "client-ack"
  | "read"
  | "stale-read"
  | "failover"
  | "lost-write"
  | "partition"
  | "conflict"
  | "quorum-write"
  | "quorum-read"
  | "idle";

export type SimFrame = {
  replicas: Replica[];
  message: string;
  kind: SimKind;
  fromId?: string;
  toId?: string;
  highlightIds: string[];
  clientWaiting: boolean;
  clientAcked: boolean;
  readValue?: string;
  stale?: boolean;
};

export function cloneReplicas(replicas: Replica[]): Replica[] {
  return replicas.map((r) => ({ ...r }));
}

export function replicaById(replicas: Replica[], id: string): Replica {
  const found = replicas.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown replica ${id}`);
  return found;
}

export function leaderOf(replicas: Replica[]): Replica | undefined {
  return replicas.find((r) => r.role === "leader" && r.alive);
}

export function maxVersion(replicas: Replica[]): number {
  return replicas.reduce((m, r) => Math.max(m, r.version), 0);
}

export function createLeaderCluster(): Replica[] {
  return [
    {
      id: "nyc",
      name: "NYC",
      region: "us-east",
      role: "leader",
      alive: true,
      value: "0",
      version: 0,
    },
    {
      id: "lon",
      name: "London",
      region: "eu-west",
      role: "follower",
      alive: true,
      value: "0",
      version: 0,
    },
    {
      id: "tyo",
      name: "Tokyo",
      region: "ap-northeast",
      role: "follower",
      alive: true,
      value: "0",
      version: 0,
    },
  ];
}

export function createPeerCluster(n = 5): Replica[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `n${i + 1}`,
    name: `n${i + 1}`,
    region: `rack-${i + 1}`,
    role: "peer" as const,
    alive: true,
    value: "—",
    version: 0,
  }));
}

export function createMultiLeaderCluster(): Replica[] {
  return [
    {
      id: "nyc",
      name: "NYC",
      region: "us-east",
      role: "leader",
      alive: true,
      value: "bread",
      version: 1,
    },
    {
      id: "lon",
      name: "London",
      region: "eu-west",
      role: "leader",
      alive: true,
      value: "bread",
      version: 1,
    },
  ];
}

export function parseCart(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

export function formatCart(items: string[]): string {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))]
    .sort()
    .join(", ");
}

export function addToCart(value: string, item: string): string {
  const items = new Set(parseCart(value));
  items.add(item.trim().toLowerCase());
  return formatCart([...items]);
}

export function lwwWinner(
  a: Replica,
  b: Replica,
  preferId: string
): Replica {
  if (a.version !== b.version) return a.version > b.version ? a : b;
  return a.id === preferId ? a : b;
}

export function unionCarts(a: Replica, b: Replica): string {
  return formatCart([...new Set([...parseCart(a.value), ...parseCart(b.value)])]);
}

/**
 * Any write quorum of size W and read quorum of size R must intersect
 * when W + R > N. The demo writes the first W nodes and reads the last R
 * so the sets are disjoint exactly when W + R ≤ N.
 */
export function writeQuorumIds(n: number, w: number): string[] {
  return Array.from({ length: w }, (_, i) => `n${i + 1}`);
}

export function readQuorumIds(n: number, r: number): string[] {
  const start = n - r;
  return Array.from({ length: r }, (_, i) => `n${start + i + 1}`);
}

export function quorumIntersects(n: number, w: number, r: number): boolean {
  const writes = new Set(writeQuorumIds(n, w));
  return readQuorumIds(n, r).some((id) => writes.has(id));
}

export function quorumSafe(n: number, w: number, r: number): boolean {
  return w + r > n;
}

export function pickHighestVersion(replicas: Replica[], ids: string[]): Replica {
  const subset = ids.map((id) => replicaById(replicas, id));
  return subset.reduce((best, r) => (r.version > best.version ? r : best));
}
