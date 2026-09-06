import { buildSequenceExchange } from "@/lib/animation/sequence";
import type {
  SequenceEvent,
  SequenceInterval,
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

export type TransactionDef = {
  id: string;
  clientId: string;
};

export type OperationTiming = {
  /** Time from the client sending a request until the database receives it. */
  request: number;
  /** Time spent executing or waiting inside the database. */
  processing: number;
  /** Time from the database replying until the client receives the result. */
  response: number;
};

type TimedOperation = {
  timing?: Partial<OperationTiming>;
};

export type ScriptOp =
  | { kind: "begin"; tx: string; t: number }
  | ({ kind: "read"; tx: string; record: string; t: number } & TimedOperation)
  | ({
      kind: "write";
      tx: string;
      record: string;
      t: number;
      /** Absolute value, or add to this transaction's last read of the row. */
      set?: number;
      add?: number;
    } & TimedOperation)
  | { kind: "commit"; tx: string; t: number }
  | { kind: "abort"; tx: string; t: number };

export type IsolationScript = {
  id: string;
  title: string;
  summary: string;
  records: RecordDef[];
  clients: ClientDef[];
  /** Defaults to one transaction per client with matching ids. */
  transactions?: TransactionDef[];
  ops: ScriptOp[];
  /** Scenario-wide latency defaults; individual reads/writes may override. */
  timing?: Partial<OperationTiming>;
};

function transactionDefs(script: IsolationScript): TransactionDef[] {
  return (
    script.transactions ??
    script.clients.map((client) => ({ id: client.id, clientId: client.id }))
  );
}

export const ISOLATION_LABELS: Record<IsolationLevel, string> = {
  "read-uncommitted": "Read uncommitted",
  "read-committed": "Read committed",
  snapshot: "Snapshot",
  serializable: "Serializable",
};

export const ISOLATION_HINTS: Record<IsolationLevel, string> = {
  "read-uncommitted": "Reads can see writes that later abort.",
  "read-committed": "Reads only see committed data. Concurrent writes can still surprise you.",
  snapshot: "Canonical snapshot isolation gives each transaction one consistent snapshot and rejects overlapping writes to the same row.",
  serializable: "Committed transactions must match some serial order. This demo uses simplified commit-time validation.",
};

export const DEFAULT_OPERATION_TIMING: OperationTiming = {
  request: 0.9,
  processing: 1.4,
  response: 0.9,
};

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
  intents: Map<string, { value: number; at: number }>;
};

export type RecordView = {
  id: string;
  label: string;
  committed: number;
  uncommitted: number | null;
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
    const uncommitted =
      [...record.intents.entries()]
        .filter(([txId]) => txs.get(txId)?.status === "active")
        .sort(([, a], [, b]) => b.at - a.at)[0]?.[1].value ?? null;
    return {
      id: record.id,
      label: record.label,
      committed: record.committed,
      uncommitted,
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
    const visibleIntent = [...record.intents.entries()]
      .filter(
        ([txId]) => txId !== tx.id && txs.get(txId)?.status === "active"
      )
      .sort(([, a], [, b]) => b.at - a.at)[0]?.[1];
    if (visibleIntent) return visibleIntent.value;
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

function operationTiming(
  script: IsolationScript,
  op: Extract<ScriptOp, { kind: "read" | "write" }>
): OperationTiming {
  return {
    ...DEFAULT_OPERATION_TIMING,
    ...script.timing,
    ...op.timing,
  };
}

export function validateIsolationScript(script: IsolationScript): void {
  const errors: string[] = [];
  const clientIds = new Set<string>();
  const recordIds = new Set<string>();

  for (const client of script.clients) {
    if (!client.id || clientIds.has(client.id)) {
      errors.push(`duplicate or empty client id "${client.id}"`);
    }
    clientIds.add(client.id);
  }
  for (const record of script.records) {
    if (!record.id || recordIds.has(record.id) || clientIds.has(record.id)) {
      errors.push(`duplicate, empty, or ambiguous record id "${record.id}"`);
    }
    recordIds.add(record.id);
  }
  const txIds = new Set<string>();
  for (const tx of transactionDefs(script)) {
    if (!tx.id || txIds.has(tx.id)) {
      errors.push(`duplicate or empty transaction id "${tx.id}"`);
    }
    if (!clientIds.has(tx.clientId)) {
      errors.push(
        `transaction "${tx.id}" refers to unknown client "${tx.clientId}"`
      );
    }
    txIds.add(tx.id);
  }

  const begins = new Map<string, number>();
  const ends = new Map<string, number>();
  for (const [index, op] of script.ops.entries()) {
    if (!Number.isFinite(op.t) || op.t < 0) {
      errors.push(`op ${index} has invalid time ${op.t}`);
    }
    if (!txIds.has(op.tx)) {
      errors.push(`op ${index} refers to unknown transaction "${op.tx}"`);
    }
    if (op.kind === "begin") {
      if (begins.has(op.tx)) errors.push(`transaction "${op.tx}" begins twice`);
      begins.set(op.tx, op.t);
    }
    if (op.kind === "commit" || op.kind === "abort") {
      if (ends.has(op.tx)) errors.push(`transaction "${op.tx}" ends twice`);
      ends.set(op.tx, op.t);
    }
  }

  for (const tx of transactionDefs(script)) {
    if (!begins.has(tx.id)) errors.push(`transaction "${tx.id}" never begins`);
    if (!ends.has(tx.id)) errors.push(`transaction "${tx.id}" never ends`);
  }

  for (const [index, op] of script.ops.entries()) {
    if (op.kind !== "read" && op.kind !== "write") continue;
    if (!recordIds.has(op.record)) {
      errors.push(`op ${index} refers to unknown record "${op.record}"`);
    }
    const begin = begins.get(op.tx);
    const end = ends.get(op.tx);
    if (begin !== undefined && op.t < begin) {
      errors.push(`op ${index} starts before transaction "${op.tx}" begins`);
    }
    const timing = operationTiming(script, op);
    if (
      Object.values(timing).some(
        (duration) => !Number.isFinite(duration) || duration < 0
      )
    ) {
      errors.push(`op ${index} has invalid request/processing/response timing`);
    }
    const responseAt =
      op.t + timing.request + timing.processing + timing.response;
    if (end !== undefined && responseAt > end + 1e-9) {
      errors.push(
        `op ${index} response arrives at ${responseAt} after transaction "${op.tx}" ends at ${end}`
      );
    }
    if (op.kind === "write") {
      const modes = Number(typeof op.set === "number") + Number(typeof op.add === "number");
      if (modes !== 1) {
        errors.push(`write op ${index} must specify exactly one of set or add`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid isolation script "${script.id}":\n- ${errors.join("\n- ")}`);
  }
}

export function simulate(
  script: IsolationScript,
  level: IsolationLevel
): IsolationRun {
  validateIsolationScript(script);
  const records = new Map<string, RecordState>(
    script.records.map((record) => [
      record.id,
      {
        id: record.id,
        label: record.label,
        unit: record.unit,
        committed: record.value,
        intents: new Map(),
      },
    ])
  );
  const txs = new Map<string, TxState>();
  const clientByTx = new Map(
    transactionDefs(script).map((tx) => [tx.id, tx.clientId])
  );
  const committedTxs: TxState[] = [];
  const aborted: string[] = [];

  const messages: SequenceMessage[] = [];
  const notes: SequenceNote[] = [];
  const events: SequenceEvent[] = [];
  const spans: SequenceSpan[] = [];
  const intervals: SequenceInterval[] = [];
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
      prev.caption = `${prev.caption} ${caption}`;
      prev.highlightActorIds = [
        ...new Set([...prev.highlightActorIds, ...highlightActorIds]),
      ];
      prev.highlightMessageIds = [
        ...new Set([...prev.highlightMessageIds, ...highlightMessageIds]),
      ];
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

  const clientActor = (txId: string) => clientByTx.get(txId) ?? txId;
  const clientLabel = (txId: string) => {
    const clientId = clientActor(txId);
    return (
      script.clients.find((client) => client.id === clientId)?.label ?? clientId
    );
  };

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
              actorId: clientActor(captured.tx),
              at: captured.t,
              label: "begin",
              kind: "begin",
            });
            pushBeat(
              captured.t,
              `${clientLabel(captured.tx)} begins a transaction.`,
              [clientActor(captured.tx)],
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
              actorId: clientActor(tx.id),
              at: arrive,
              label: "abort",
              kind: "abort",
            });
            spans.push({
              id: `span-${tx.id}`,
              actorId: clientActor(tx.id),
              t0: tx.beginAt,
              t1: arrive,
              status: "aborted",
              label: tx.id,
            });
            pushBeat(arrive, reason, [clientActor(tx.id)], []);
            return;
          }

          for (const [recordId, value] of tx.writes) {
            const record = records.get(recordId);
            if (!record) continue;
            record.committed = value;
            record.intents.delete(tx.id);
            noteRecord(record, arrive, value, " (committed)");
          }
          tx.status = "committed";
          tx.endAt = arrive;
          committedTxs.push(tx);
          events.push({
            id: `ev-${++eventN}`,
            actorId: clientActor(tx.id),
            at: arrive,
            label: "commit",
            kind: "commit",
          });
          spans.push({
            id: `span-${tx.id}`,
            actorId: clientActor(tx.id),
            t0: tx.beginAt,
            t1: arrive,
            status: "committed",
            label: tx.id,
          });
          pushBeat(
            arrive,
            `${clientLabel(tx.id)} commits.`,
            [clientActor(tx.id), ...tx.writeSet],
            []
          );
        },
      });
      continue;
    }

    const exchangeId = `exchange-${++msgN}`;
    const t0 = op.t;
    const captured = op;
    const timing = operationTiming(script, captured);
    const exchange = buildSequenceExchange({
      id: exchangeId,
      callerId: clientActor(captured.tx),
      handlerId: captured.record,
      startAt: t0,
      requestDuration: timing.request,
      processingDuration: timing.processing,
      responseDuration: timing.response,
      requestLabel:
        captured.kind === "read"
          ? `SELECT ${records.get(captured.record)?.label ?? captured.record}`
          : writeRequestLabel(
              captured,
              records.get(captured.record)?.label ?? captured.record
            ),
      responseLabel: "…",
    });
    const requestId = exchange.request.id;
    const responseId = exchange.response.id;
    let operationResult: number | undefined;
    let operationSucceeded = false;
    messages.push(exchange.request, exchange.response);
    intervals.push(...exchange.intervals);

    effects.push({
      t: t0,
      run: () => {
        if (txs.get(captured.tx)?.status !== "active") return;
        pushBeat(
          t0,
          captured.kind === "read"
            ? `${clientLabel(captured.tx)} reads ${records.get(captured.record)?.label}.`
            : `${clientLabel(captured.tx)} writes ${records.get(captured.record)?.label}.`,
          [clientActor(captured.tx), captured.record],
          [requestId]
        );
      },
    });

    effects.push({
      t: exchange.requestArrivesAt,
      run: () => {
        if (txs.get(captured.tx)?.status !== "active") return;
        pushBeat(
          exchange.requestArrivesAt,
          `${records.get(captured.record)?.label ?? captured.record} received the request and starts processing it.`,
          [captured.record],
          [requestId]
        );
      },
    });

    effects.push({
      t: exchange.responseStartsAt,
      run: () => {
        const tx = txs.get(captured.tx);
        const record = records.get(captured.record);
        const response = messages.find((m) => m.id === responseId);
        if (!tx || tx.status !== "active" || !record || !response) return;

        if (captured.kind === "read") {
          const value = visibleRead(level, tx, record, txs);
          tx.readSet.add(record.id);
          operationResult = value;
          operationSucceeded = true;
          response.label = formatValue(record, value);
          pushBeat(
            exchange.responseStartsAt,
            `${record.label} finishes the read and sends ${formatValue(record, value)} back to ${clientLabel(tx.id)}.`,
            [clientActor(tx.id), record.id],
            [requestId, responseId]
          );
          return;
        }

        const conflictingIntent = [...record.intents.keys()].find(
          (txId) => txId !== tx.id && txs.get(txId)?.status === "active"
        );
        if (conflictingIntent) {
          throw new Error(
            `Script "${script.id}" schedules ${tx.id} to overwrite ${conflictingIntent}'s uncommitted write to ${record.id}. Model an explicit lock wait instead.`
          );
        }
        const next = writeValue(captured, tx);
        operationResult = next;
        operationSucceeded = true;
        tx.writes.set(record.id, next);
        tx.writeSet.add(record.id);
        record.intents.set(tx.id, {
          value: next,
          at: exchange.responseStartsAt,
        });
        response.label = "ok";
        noteRecord(
          record,
          exchange.responseStartsAt,
          next,
          level === "read-uncommitted" ? " (dirty)" : " (uncommitted)"
        );
        pushBeat(
          exchange.responseStartsAt,
          `${record.label} finishes the write at ${formatValue(record, next)} and sends ok to ${clientLabel(tx.id)} (not committed yet).`,
          [clientActor(tx.id), record.id],
          [requestId, responseId]
        );
      },
    });

    effects.push({
      t: exchange.responseArrivesAt,
      run: () => {
        const tx = txs.get(captured.tx);
        const record = records.get(captured.record);
        if (
          !tx ||
          tx.status !== "active" ||
          !record ||
          !operationSucceeded ||
          operationResult === undefined
        ) {
          return;
        }
        tx.reads.set(record.id, operationResult);
        pushBeat(
          exchange.responseArrivesAt,
          captured.kind === "read"
            ? `${clientLabel(tx.id)} receives ${record.label} = ${formatValue(record, operationResult)}.`
            : `${clientLabel(tx.id)} gets ok for the write to ${record.label}.`,
          [clientActor(tx.id)],
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
        actorId: clientActor(tx.id),
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
    intervals,
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
    records.get(recordId)?.intents.delete(tx.id);
  }
}

function writeRequestLabel(
  op: Extract<ScriptOp, { kind: "write" }>,
  recordLabel: string
): string {
  if (typeof op.add === "number") {
    const sign = op.add >= 0 ? "+" : "−";
    return `SET ${recordLabel} = prior read ${sign} ${Math.abs(op.add)}`;
  }
  if (typeof op.set === "number") {
    return `SET ${recordLabel} = ${op.set}`;
  }
  return `UPDATE ${recordLabel}`;
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
