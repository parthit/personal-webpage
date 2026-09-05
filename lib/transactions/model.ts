import type {
  SequenceEvent,
  SequenceMessage,
  SequenceNote,
  SequenceScenario,
  SequenceSpan,
} from "@/lib/animation/sequence";

/**
 * A small isolation simulator for teaching interleavings.
 *
 * It is not a database. It models the anomalies DDIA chapter 7 cares about:
 * dirty reads, lost updates, read skew, and write skew — plus how
 * read-committed, snapshot isolation, and serializable treat the same script.
 */

export type IsolationLevel =
  | "read-uncommitted"
  | "read-committed"
  | "snapshot"
  | "serializable";

export type RecordDef = {
  id: string;
  label: string;
  value: number;
  unit?: string;
};

export type ClientDef = {
  id: string;
  label: string;
};

export type ScriptOp =
  | { kind: "begin"; tx: string; t: number }
  | { kind: "read"; tx: string; record: string; t: number }
  | {
      kind: "write";
      tx: string;
      record: string;
      t: number;
      /** Absolute value, or add to this transaction's last read of the row. */
      set?: number;
      add?: number;
    }
  | { kind: "commit"; tx: string; t: number }
  | { kind: "abort"; tx: string; t: number };

export type IsolationScript = {
  id: string;
  title: string;
  summary: string;
  records: RecordDef[];
  clients: ClientDef[];
  ops: ScriptOp[];
};

export const ISOLATION_LABELS: Record<IsolationLevel, string> = {
  "read-uncommitted": "Read uncommitted",
  "read-committed": "Read committed",
  snapshot: "Snapshot",
  serializable: "Serializable",
};

export const ISOLATION_HINTS: Record<IsolationLevel, string> = {
  "read-uncommitted": "Reads can see writes that later abort.",
  "read-committed": "Reads only see committed data. Concurrent writes can still surprise you.",
  snapshot: "Each transaction reads a consistent snapshot. Write-write conflicts abort.",
  serializable: "Aborts if a concurrent commit changed a row this transaction read.",
};

const HOP = 1.2;

type TxState = {
  id: string;
  startedAt: number;
  snapshot: Map<string, number>;
  reads: Map<string, number>;
  writes: Map<string, number>;
  readSet: Set<string>;
  writeSet: Set<string>;
  status: "active" | "committed" | "aborted";
  beginAt: number;
  endAt: number;
};

type RecordState = {
  id: string;
  label: string;
  unit?: string;
  committed: number;
  dirtyTx: string | null;
};

export type RecordView = {
  id: string;
  label: string;
  committed: number;
  dirty: number | null;
  unit?: string;
};

export type IsolationBeat = {
  now: number;
  caption: string;
  highlightActorIds: string[];
  highlightMessageIds: string[];
  records: RecordView[];
};

export type IsolationRun = {
  level: IsolationLevel;
  scenario: SequenceScenario;
  beats: IsolationBeat[];
  outcome: string;
  aborted: string[];
};

function recordViews(records: Map<string, RecordState>, txs: Map<string, TxState>): RecordView[] {
  return [...records.values()].map((record) => {
    const dirtyTx = record.dirtyTx ? txs.get(record.dirtyTx) : undefined;
    const dirty =
      dirtyTx && dirtyTx.status === "active" && dirtyTx.writes.has(record.id)
        ? dirtyTx.writes.get(record.id)!
        : null;
    return {
      id: record.id,
      label: record.label,
      committed: record.committed,
      dirty,
      unit: record.unit,
    };
  });
}

function visibleRead(
  level: IsolationLevel,
  tx: TxState,
  record: RecordState,
  txs: Map<string, TxState>
): number {
  if (tx.writes.has(record.id)) return tx.writes.get(record.id)!;
  if (level === "read-uncommitted") {
    if (record.dirtyTx && record.dirtyTx !== tx.id) {
      const writer = txs.get(record.dirtyTx);
      if (writer?.status === "active" && writer.writes.has(record.id)) {
        return writer.writes.get(record.id)!;
      }
    }
    return record.committed;
  }
  if (level === "read-committed") {
    return record.committed;
  }
  return tx.snapshot.get(record.id) ?? record.committed;
}

function writeValue(op: Extract<ScriptOp, { kind: "write" }>, tx: TxState): number {
  if (typeof op.set === "number") return op.set;
  const base = tx.reads.get(op.record);
  if (base === undefined) {
    throw new Error(`Transaction ${op.tx} wrote ${op.record} without reading it first.`);
  }
  return base + (op.add ?? 0);
}

function formatValue(record: RecordState | RecordView, value: number): string {
  if (record.unit === "bool") return value ? "on call" : "off";
  return String(value);
}

export function simulate(
  script: IsolationScript,
  level: IsolationLevel
): IsolationRun {
  const records = new Map<string, RecordState>(
    script.records.map((record) => [
      record.id,
      {
        id: record.id,
        label: record.label,
        unit: record.unit,
        committed: record.value,
        dirtyTx: null,
      },
    ])
  );
  const txs = new Map<string, TxState>();
  const committedTxs: TxState[] = [];
  const aborted: string[] = [];

  const messages: SequenceMessage[] = [];
  const notes: SequenceNote[] = [];
  const events: SequenceEvent[] = [];
  const spans: SequenceSpan[] = [];
  const beats: IsolationBeat[] = [];

  let msgN = 0;
  let noteN = 0;
  let eventN = 0;
  let lastBeatAt = -1;

  function pushBeat(
    now: number,
    caption: string,
    highlightActorIds: string[],
    highlightMessageIds: string[]
  ) {
    if (beats.length && lastBeatAt === now) {
      const prev = beats[beats.length - 1];
      prev.caption = caption;
      prev.highlightActorIds = highlightActorIds;
      prev.highlightMessageIds = highlightMessageIds;
      prev.records = recordViews(records, txs);
      return;
    }
    lastBeatAt = now;
    beats.push({
      now,
      caption,
      highlightActorIds,
      highlightMessageIds,
      records: recordViews(records, txs),
    });
  }

  function noteRecord(record: RecordState, at: number, value: number, extra: string) {
    notes.push({
      id: `note-${++noteN}`,
      actorId: record.id,
      at,
      text: `${record.label} = ${formatValue(record, value)}${extra}`,
    });
  }

  const clientLabel = (id: string) =>
    script.clients.find((c) => c.id === id)?.label ?? id;

  type Effect = { t: number; run: () => void };
  const effects: Effect[] = [];

  for (const op of script.ops) {
    if (op.kind === "begin" || op.kind === "commit" || op.kind === "abort") {
      const captured = op;
      effects.push({
        t: captured.t,
        run: () => {
          if (captured.kind === "begin") {
            const snap = new Map<string, number>();
            for (const record of records.values()) {
              snap.set(record.id, record.committed);
            }
            txs.set(captured.tx, {
              id: captured.tx,
              startedAt: captured.t,
              snapshot: snap,
              reads: new Map(),
              writes: new Map(),
              readSet: new Set(),
              writeSet: new Set(),
              status: "active",
              beginAt: captured.t,
              endAt: script.ops.reduce((max, next) => Math.max(max, next.t), captured.t) + 4,
            });
            events.push({
              id: `ev-${++eventN}`,
              actorId: captured.tx,
              at: captured.t,
              label: "begin",
              kind: "begin",
            });
            pushBeat(
              captured.t,
              `${clientLabel(captured.tx)} begins a transaction.`,
              [captured.tx],
              []
            );
            return;
          }

          const tx = txs.get(captured.tx);
          if (!tx || tx.status !== "active") return;
          const arrive = captured.t;

          if (captured.kind === "abort" || shouldAbort(tx, level, committedTxs)) {
            const reason =
              captured.kind === "abort"
                ? `${clientLabel(tx.id)} aborts and rolls back.`
                : `${clientLabel(tx.id)} aborts — ${abortReason(tx, level, committedTxs)}.`;
            rollback(tx, records);
            tx.status = "aborted";
            tx.endAt = arrive;
            aborted.push(tx.id);
            events.push({
              id: `ev-${++eventN}`,
              actorId: tx.id,
              at: arrive,
              label: "abort",
              kind: "abort",
            });
            spans.push({
              id: `span-${tx.id}`,
              actorId: tx.id,
              t0: tx.beginAt,
              t1: arrive,
              status: "aborted",
              label: tx.id,
            });
            pushBeat(arrive, reason, [tx.id], []);
            return;
          }

          for (const [recordId, value] of tx.writes) {
            const record = records.get(recordId);
            if (!record) continue;
            record.committed = value;
            if (record.dirtyTx === tx.id) record.dirtyTx = null;
            noteRecord(record, arrive, value, " (committed)");
          }
          tx.status = "committed";
          tx.endAt = arrive;
          committedTxs.push(tx);
          events.push({
            id: `ev-${++eventN}`,
            actorId: tx.id,
            at: arrive,
            label: "commit",
            kind: "commit",
          });
          spans.push({
            id: `span-${tx.id}`,
            actorId: tx.id,
            t0: tx.beginAt,
            t1: arrive,
            status: "committed",
            label: tx.id,
          });
          pushBeat(
            arrive,
            `${clientLabel(tx.id)} commits.`,
            [tx.id, ...tx.writeSet],
            []
          );
        },
      });
      continue;
    }

    const requestId = `m-${++msgN}`;
    const responseId = `m-${++msgN}`;
    const t0 = op.t;
    const tMid = op.t + HOP;
    const t1 = op.t + 2 * HOP;
    const captured = op;

    messages.push({
      id: requestId,
      from: captured.tx,
      to: captured.record,
      t0,
      t1: tMid,
      label:
        captured.kind === "read"
          ? `SELECT ${records.get(captured.record)?.label ?? captured.record}`
          : `UPDATE ${records.get(captured.record)?.label ?? captured.record}`,
      kind: "request",
    });
    messages.push({
      id: responseId,
      from: captured.record,
      to: captured.tx,
      t0: tMid,
      t1,
      label: "…",
      kind: "response",
    });

    effects.push({
      t: t0,
      run: () => {
        pushBeat(
          t0,
          captured.kind === "read"
            ? `${clientLabel(captured.tx)} reads ${records.get(captured.record)?.label}.`
            : `${clientLabel(captured.tx)} writes ${records.get(captured.record)?.label}.`,
          [captured.tx, captured.record],
          [requestId]
        );
      },
    });

    effects.push({
      t: tMid,
      run: () => {
        const tx = txs.get(captured.tx);
        const record = records.get(captured.record);
        const response = messages.find((m) => m.id === responseId);
        if (!tx || !record || !response) return;

        if (captured.kind === "read") {
          const value = visibleRead(level, tx, record, txs);
          tx.reads.set(record.id, value);
          tx.readSet.add(record.id);
          response.label = formatValue(record, value);
          pushBeat(
            tMid,
            `${clientLabel(tx.id)} sees ${record.label} = ${formatValue(record, value)}.`,
            [tx.id, record.id],
            [requestId, responseId]
          );
          return;
        }

        const next = writeValue(captured, tx);
        tx.writes.set(record.id, next);
        tx.writeSet.add(record.id);
        tx.reads.set(record.id, next);
        record.dirtyTx = tx.id;
        response.label = "ok";
        noteRecord(record, tMid, next, level === "read-uncommitted" ? " (dirty)" : " (uncommitted)");
        pushBeat(
          tMid,
          `${clientLabel(tx.id)} sets ${record.label} = ${formatValue(record, next)} (not committed yet).`,
          [tx.id, record.id],
          [requestId]
        );
      },
    });

    effects.push({
      t: t1,
      run: () => {
        const tx = txs.get(captured.tx);
        const record = records.get(captured.record);
        if (!tx || !record) return;
        pushBeat(
          t1,
          captured.kind === "read"
            ? `Result ${record.label} = ${formatValue(record, tx.reads.get(record.id) ?? record.committed)} reaches ${clientLabel(tx.id)}.`
            : `${clientLabel(tx.id)} gets ok for the write to ${record.label}.`,
          [tx.id],
          [responseId]
        );
      },
    });
  }

  effects.sort((a, b) => a.t - b.t);
  pushBeat(
    0,
    "Two transactions, one shared state. Run the interleaving and watch which writes each read is allowed to see.",
    [],
    []
  );
  for (const effect of effects) {
    effect.run();
  }

  for (const tx of txs.values()) {
    if (tx.status === "active") {
      spans.push({
        id: `span-${tx.id}`,
        actorId: tx.id,
        t0: tx.beginAt,
        t1: Math.max(tx.endAt, lastBeatAt),
        status: "active",
      });
    }
  }

  const duration = Math.max(
    2,
    lastBeatAt + 1.5,
    ...messages.map((m) => m.t1),
    ...events.map((e) => e.at),
    ...spans.map((s) => s.t1)
  );

  const actors = [
    ...script.clients.map((client) => ({
      id: client.id,
      label: client.label,
      kind: "person" as const,
      group: "Clients",
    })),
    ...script.records.map((record) => ({
      id: record.id,
      label: record.label,
      kind: "record" as const,
      group: "Records",
      subtitle: record.unit === "bool" ? undefined : `starts at ${record.value}`,
    })),
  ];

  const scenario: SequenceScenario = {
    id: `${script.id}:${level}`,
    title: script.title,
    duration,
    actors,
    messages,
    notes,
    events,
    spans,
  };

  const outcome = summarize(script, level, txs, aborted);

  return { level, scenario, beats, outcome, aborted };
}

function shouldAbort(
  tx: TxState,
  level: IsolationLevel,
  committedTxs: TxState[]
): boolean {
  return abortReason(tx, level, committedTxs) !== null;
}

function abortReason(
  tx: TxState,
  level: IsolationLevel,
  committedTxs: TxState[]
): string | null {
  if (level === "read-uncommitted" || level === "read-committed") return null;
  const concurrent = committedTxs.filter(
    (other) => other.id !== tx.id && other.endAt > tx.startedAt
  );
  const ww = concurrent.find((other) =>
    [...tx.writeSet].some((key) => other.writeSet.has(key))
  );
  if (ww) {
    return "write-write conflict — another transaction already committed a write to the same row";
  }
  if (level !== "serializable") return null;
  const rw = concurrent.find((other) =>
    [...tx.readSet].some((key) => other.writeSet.has(key))
  );
  if (rw) {
    return "a concurrent transaction committed a write to a row it had already read";
  }
  return null;
}

function rollback(tx: TxState, records: Map<string, RecordState>) {
  for (const recordId of tx.writeSet) {
    const record = records.get(recordId);
    if (record && record.dirtyTx === tx.id) {
      record.dirtyTx = null;
    }
  }
}

function summarize(
  script: IsolationScript,
  level: IsolationLevel,
  txs: Map<string, TxState>,
  aborted: string[]
): string {
  const bob = txs.get("bob");
  if (script.id === "dirty-read") {
    const seen = bob?.reads.get("acc1");
    if (level === "read-uncommitted") {
      return `Bob read ${seen} and Alice aborted. That value never committed. Account 1 is back to 500.`;
    }
    return "Bob only saw the committed 500. Alice's abort did not leak into his transaction.";
  }
  if (script.id === "lost-update") {
    if (aborted.includes("bob")) {
      return "Bob aborted. Account 1 stays at Alice's 600. A retry would read 600 and write 700.";
    }
    return "Both commits used the old read of 500. Account 1 is 600, and one +100 vanished.";
  }
  if (script.id === "read-skew") {
    const a = bob?.reads.get("acc1");
    const b = bob?.reads.get("acc2");
    if (a != null && b != null && a + b !== 1000) {
      return `Bob added ${a} + ${b} = ${a + b}. That total never existed as committed state.`;
    }
    return "Bob's two reads add up to 1000, a total that actually existed.";
  }
  if (script.id === "write-skew") {
    if (aborted.includes("bob")) {
      return "Bob aborted, so at least one doctor stays on call.";
    }
    return "Both went off call. Snapshot isolation allowed a state no serial execution produces.";
  }
  if (aborted.length > 0) {
    return `${ISOLATION_LABELS[level]} aborted ${aborted.join(" and ")}.`;
  }
  return `${ISOLATION_LABELS[level]} let both transactions commit.`;
}
