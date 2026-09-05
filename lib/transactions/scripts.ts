import type { IsolationLevel, IsolationScript } from "./model";

export const DIRTY_READ: IsolationScript = {
  id: "dirty-read",
  title: "Dirty read",
  summary: "Bob reads a write Alice later aborts.",
  records: [{ id: "acc1", label: "Account 1", value: 500 }],
  clients: [
    { id: "alice", label: "Alice" },
    { id: "bob", label: "Bob" },
  ],
  ops: [
    { kind: "begin", tx: "alice", t: 0.4 },
    { kind: "begin", tx: "bob", t: 1.0 },
    { kind: "write", tx: "alice", record: "acc1", t: 2.2, set: 600 },
    { kind: "read", tx: "bob", record: "acc1", t: 5.0 },
    { kind: "abort", tx: "alice", t: 8.4 },
    { kind: "commit", tx: "bob", t: 9.6 },
  ],
};

export const LOST_UPDATE: IsolationScript = {
  id: "lost-update",
  title: "Lost update",
  summary: "Alice and Bob both add 100 to a balance they already read.",
  records: [{ id: "acc1", label: "Account 1", value: 500 }],
  clients: [
    { id: "alice", label: "Alice" },
    { id: "bob", label: "Bob" },
  ],
  ops: [
    { kind: "begin", tx: "alice", t: 0.4 },
    { kind: "begin", tx: "bob", t: 1.0 },
    { kind: "read", tx: "alice", record: "acc1", t: 2.0 },
    { kind: "read", tx: "bob", record: "acc1", t: 3.4 },
    { kind: "write", tx: "alice", record: "acc1", t: 7.0, add: 100 },
    { kind: "write", tx: "bob", record: "acc1", t: 9.2, add: 100 },
    { kind: "commit", tx: "alice", t: 12.6 },
    { kind: "commit", tx: "bob", t: 14.0 },
  ],
};

export const READ_SKEW: IsolationScript = {
  id: "read-skew",
  title: "Read skew",
  summary: "Alice transfers 100 while Bob reads the two accounts.",
  records: [
    { id: "acc1", label: "Account 1", value: 500 },
    { id: "acc2", label: "Account 2", value: 500 },
  ],
  clients: [
    { id: "alice", label: "Alice" },
    { id: "bob", label: "Bob" },
  ],
  ops: [
    { kind: "begin", tx: "bob", t: 0.3 },
    { kind: "begin", tx: "alice", t: 0.9 },
    { kind: "read", tx: "bob", record: "acc1", t: 1.8 },
    { kind: "write", tx: "alice", record: "acc1", t: 4.6, set: 400 },
    { kind: "write", tx: "alice", record: "acc2", t: 7.4, set: 600 },
    { kind: "commit", tx: "alice", t: 10.4 },
    { kind: "read", tx: "bob", record: "acc2", t: 11.2 },
    { kind: "commit", tx: "bob", t: 14.4 },
  ],
};

export const WRITE_SKEW: IsolationScript = {
  id: "write-skew",
  title: "Write skew",
  summary: "Each doctor sees the other is on call, then both go off.",
  records: [
    { id: "alice-shift", label: "Alice shift", value: 1, unit: "bool" },
    { id: "bob-shift", label: "Bob shift", value: 1, unit: "bool" },
  ],
  clients: [
    { id: "alice", label: "Alice" },
    { id: "bob", label: "Bob" },
  ],
  ops: [
    { kind: "begin", tx: "alice", t: 0.4 },
    { kind: "begin", tx: "bob", t: 1.0 },
    { kind: "read", tx: "alice", record: "alice-shift", t: 1.8 },
    { kind: "read", tx: "alice", record: "bob-shift", t: 4.4 },
    { kind: "read", tx: "bob", record: "alice-shift", t: 2.6 },
    { kind: "read", tx: "bob", record: "bob-shift", t: 5.2 },
    { kind: "write", tx: "alice", record: "alice-shift", t: 8.6, set: 0 },
    { kind: "write", tx: "bob", record: "bob-shift", t: 10.0, set: 0 },
    { kind: "commit", tx: "alice", t: 13.2 },
    { kind: "commit", tx: "bob", t: 14.6 },
  ],
};

export const ISOLATION_SCRIPTS = {
  "dirty-read": DIRTY_READ,
  "lost-update": LOST_UPDATE,
  "read-skew": READ_SKEW,
  "write-skew": WRITE_SKEW,
} as const;

export type IsolationScenarioId = keyof typeof ISOLATION_SCRIPTS;

export const SCENARIO_LEVELS: Record<IsolationScenarioId, IsolationLevel[]> = {
  "dirty-read": ["read-uncommitted", "read-committed"],
  "lost-update": ["read-committed", "serializable"],
  "read-skew": ["read-committed", "snapshot"],
  "write-skew": ["snapshot", "serializable"],
};
