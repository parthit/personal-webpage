import {
  cloneReplicas,
  formatCart,
  leaderOf,
  lwwWinner,
  maxVersion,
  parseCart,
  pickHighestVersion,
  quorumIntersects,
  quorumSafe,
  readQuorumIds,
  replicaById,
  unionCarts,
  writeQuorumIds,
  type ConflictStrategy,
  type Replica,
  type SimFrame,
  type WriteMode,
} from "./model";

function frame(
  replicas: Replica[],
  partial: Omit<SimFrame, "replicas">
): SimFrame {
  return { replicas: cloneReplicas(replicas), ...partial };
}

export function buildLeaderWriteFrames(
  start: Replica[],
  value: string,
  mode: WriteMode
): SimFrame[] {
  const replicas = cloneReplicas(start);
  const leader = leaderOf(replicas);
  if (!leader) {
    return [
      frame(replicas, {
        message: "No living leader — the write cannot be accepted.",
        kind: "lost-write",
        highlightIds: [],
        clientWaiting: false,
        clientAcked: false,
      }),
    ];
  }

  const followers = replicas.filter(
    (r) => r.role === "follower" && r.alive && r.id !== leader.id
  );
  const frames: SimFrame[] = [];

  frames.push(
    frame(replicas, {
      message: `Client sends SET likes=${value} to the ${leader.name} leader.`,
      kind: "client-send",
      toId: leader.id,
      highlightIds: [leader.id],
      clientWaiting: true,
      clientAcked: false,
    })
  );

  leader.value = value;
  leader.version += 1;
  frames.push(
    frame(replicas, {
      message: `${leader.name} appends the write locally (version ${leader.version}) and will ship it to followers.`,
      kind: "leader-apply",
      toId: leader.id,
      highlightIds: [leader.id],
      clientWaiting: true,
      clientAcked: false,
    })
  );

  // Async: ack as soon as the leader has the write. Followers stay behind
  // until catch-up so lag is visible (and a crash can lose the write).
  if (mode === "asynchronous") {
    frames.push(
      frame(replicas, {
        message: `Async: the client is acknowledged now. Followers still have the old value until they catch up.`,
        kind: "client-ack",
        fromId: leader.id,
        highlightIds: [leader.id],
        clientWaiting: false,
        clientAcked: true,
      })
    );
    return frames;
  }

  for (const follower of followers) {
    frames.push(
      frame(replicas, {
        message: `${leader.name} ships version ${leader.version} toward ${follower.name}.`,
        kind: "replicate",
        fromId: leader.id,
        toId: follower.id,
        highlightIds: [leader.id, follower.id],
        clientWaiting: true,
        clientAcked: false,
      })
    );
    follower.value = leader.value;
    follower.version = leader.version;
    frames.push(
      frame(replicas, {
        message: `${follower.name} applies version ${follower.version} (likes=${follower.value}) and acks.`,
        kind: "follower-apply",
        fromId: follower.id,
        toId: leader.id,
        highlightIds: [follower.id],
        clientWaiting: true,
        clientAcked: false,
      })
    );
  }

  frames.push(
    frame(replicas, {
      message:
        followers.length === 0
          ? `No living followers — only the leader has the new value, then the client is acknowledged.`
          : `Sync: every living follower caught up, so the client is acknowledged.`,
      kind: "client-ack",
      fromId: leader.id,
      highlightIds: replicas.filter((r) => r.alive).map((r) => r.id),
      clientWaiting: false,
      clientAcked: true,
    })
  );

  return frames;
}

export function buildReadFrames(start: Replica[], nodeId: string): SimFrame[] {
  const replicas = cloneReplicas(start);
  const node = replicaById(replicas, nodeId);
  if (!node.alive) {
    return [
      frame(replicas, {
        message: `${node.name} is down — the read fails over or errors.`,
        kind: "read",
        toId: node.id,
        highlightIds: [node.id],
        clientWaiting: false,
        clientAcked: false,
      }),
    ];
  }

  const newest = maxVersion(replicas.filter((r) => r.alive));
  const stale = node.version < newest;
  return [
    frame(replicas, {
      message: `Client reads likes from ${node.name}.`,
      kind: "read",
      toId: node.id,
      highlightIds: [node.id],
      clientWaiting: true,
      clientAcked: false,
    }),
    frame(replicas, {
      message: stale
        ? `${node.name} returns likes=${node.value} (version ${node.version}). That is stale — a newer version ${newest} exists elsewhere.`
        : `${node.name} returns likes=${node.value} (version ${node.version}). This matches the newest copy.`,
      kind: stale ? "stale-read" : "read",
      fromId: node.id,
      highlightIds: [node.id],
      clientWaiting: false,
      clientAcked: false,
      readValue: node.value,
      stale,
    }),
  ];
}

/**
 * Crash the current leader and promote the living follower with the highest
 * version. Unreplicated leader-only versions disappear (async durability gap).
 */
export function buildFailoverFrames(start: Replica[]): SimFrame[] {
  const replicas = cloneReplicas(start);
  const leader = replicas.find((r) => r.role === "leader");
  if (!leader || !leader.alive) {
    return [
      frame(replicas, {
        message: "The leader is already down.",
        kind: "failover",
        highlightIds: [],
        clientWaiting: false,
        clientAcked: false,
      }),
    ];
  }

  const frames: SimFrame[] = [];
  const leaderVersion = leader.version;
  leader.alive = false;
  frames.push(
    frame(replicas, {
      message: `${leader.name} crashes. Clients must wait for a new leader.`,
      kind: "failover",
      toId: leader.id,
      highlightIds: [leader.id],
      clientWaiting: true,
      clientAcked: false,
    })
  );

  const candidates = replicas.filter(
    (r) => r.alive && r.id !== leader.id && r.role === "follower"
  );
  if (candidates.length === 0) {
    leader.role = "follower";
    frames.push(
      frame(replicas, {
        message: "No living follower to promote — the cluster cannot accept writes.",
        kind: "lost-write",
        highlightIds: [],
        clientWaiting: false,
        clientAcked: false,
      })
    );
    return frames;
  }

  const winner = candidates.reduce((best, r) =>
    r.version > best.version ? r : best
  );
  const lost = leaderVersion > winner.version;
  winner.role = "leader";
  leader.role = "follower";

  frames.push(
    frame(replicas, {
      message: lost
        ? `${winner.name} is elected (version ${winner.version}). The crashed leader's unreplicated version ${leaderVersion} is gone.`
        : `${winner.name} is elected leader at version ${winner.version}. Followers catch up from here.`,
      kind: lost ? "lost-write" : "failover",
      toId: winner.id,
      highlightIds: [winner.id],
      clientWaiting: false,
      clientAcked: false,
    })
  );

  return frames;
}

export function buildCatchupFrames(start: Replica[]): SimFrame[] {
  const replicas = cloneReplicas(start);
  const leader = leaderOf(replicas);
  if (!leader) {
    return [
      frame(replicas, {
        message: "No living leader to catch up from.",
        kind: "idle",
        highlightIds: [],
        clientWaiting: false,
        clientAcked: false,
      }),
    ];
  }

  const frames: SimFrame[] = [];
  const lagging = replicas.filter(
    (r) => r.alive && r.id !== leader.id && r.version < leader.version
  );
  if (lagging.length === 0) {
    return [
      frame(replicas, {
        message: "Every living replica already matches the leader.",
        kind: "idle",
        highlightIds: replicas.filter((r) => r.alive).map((r) => r.id),
        clientWaiting: false,
        clientAcked: false,
      }),
    ];
  }

  for (const follower of lagging) {
    frames.push(
      frame(replicas, {
        message: `${follower.name} pulls version ${leader.version} from ${leader.name}.`,
        kind: "replicate",
        fromId: leader.id,
        toId: follower.id,
        highlightIds: [leader.id, follower.id],
        clientWaiting: false,
        clientAcked: false,
      })
    );
    follower.value = leader.value;
    follower.version = leader.version;
    frames.push(
      frame(replicas, {
        message: `${follower.name} is caught up (likes=${follower.value}, v${follower.version}).`,
        kind: "follower-apply",
        toId: follower.id,
        highlightIds: [follower.id],
        clientWaiting: false,
        clientAcked: false,
      })
    );
  }
  return frames;
}

export function buildPartitionWrites(
  start: Replica[],
  nycItem: string,
  lonItem: string
): SimFrame[] {
  const replicas = cloneReplicas(start);
  const nyc = replicaById(replicas, "nyc");
  const lon = replicaById(replicas, "lon");
  const frames: SimFrame[] = [];

  frames.push(
    frame(replicas, {
      message: "The Atlantic link drops. NYC and London each accept local writes.",
      kind: "partition",
      highlightIds: [nyc.id, lon.id],
      clientWaiting: false,
      clientAcked: false,
    })
  );

  nyc.value = formatCart([...parseCart(nyc.value), nycItem]);
  nyc.version += 1;
  frames.push(
    frame(replicas, {
      message: `NYC client adds “${nycItem}”. Cart is now ${nyc.value} (v${nyc.version}).`,
      kind: "leader-apply",
      toId: nyc.id,
      highlightIds: [nyc.id],
      clientWaiting: false,
      clientAcked: true,
    })
  );

  lon.value = formatCart([...parseCart(lon.value), lonItem]);
  lon.version += 1;
  frames.push(
    frame(replicas, {
      message: `London client adds “${lonItem}”. Cart is now ${lon.value} (v${lon.version}).`,
      kind: "leader-apply",
      toId: lon.id,
      highlightIds: [lon.id],
      clientWaiting: false,
      clientAcked: true,
    })
  );

  return frames;
}

export function buildReconcileFrames(
  start: Replica[],
  strategy: ConflictStrategy,
  lwwPreferId: "nyc" | "lon" = "nyc"
): SimFrame[] {
  const replicas = cloneReplicas(start);
  const nyc = replicaById(replicas, "nyc");
  const lon = replicaById(replicas, "lon");
  const frames: SimFrame[] = [];

  frames.push(
    frame(replicas, {
      message: "The partition heals. Both leaders exchange logs and must reconcile.",
      kind: "conflict",
      highlightIds: [nyc.id, lon.id],
      clientWaiting: true,
      clientAcked: false,
    })
  );

  if (nyc.value === lon.value && nyc.version === lon.version) {
    frames.push(
      frame(replicas, {
        message: "No conflict — both sides already match.",
        kind: "idle",
        highlightIds: [nyc.id, lon.id],
        clientWaiting: false,
        clientAcked: true,
      })
    );
    return frames;
  }

  if (strategy === "last-write-wins") {
    const winner = lwwWinner(nyc, lon, lwwPreferId);
    const loser = winner.id === nyc.id ? lon : nyc;
    const lost = parseCart(loser.value).filter(
      (item) => !parseCart(winner.value).includes(item)
    );
    nyc.value = winner.value;
    lon.value = winner.value;
    const v = Math.max(nyc.version, lon.version);
    nyc.version = v;
    lon.version = v;
    frames.push(
      frame(replicas, {
        message: lost.length
          ? `Last-write-wins keeps ${winner.name}'s cart (${winner.value}). Dropped: ${lost.join(", ")}.`
          : `Last-write-wins keeps ${winner.name}'s cart (${winner.value}).`,
        kind: "conflict",
        fromId: winner.id,
        highlightIds: [nyc.id, lon.id],
        clientWaiting: false,
        clientAcked: true,
      })
    );
  } else {
    const merged = unionCarts(nyc, lon);
    const v = Math.max(nyc.version, lon.version);
    nyc.value = merged;
    lon.value = merged;
    nyc.version = v;
    lon.version = v;
    frames.push(
      frame(replicas, {
        message: `Union-merge keeps every item both sides added: ${merged}.`,
        kind: "conflict",
        highlightIds: [nyc.id, lon.id],
        clientWaiting: false,
        clientAcked: true,
      })
    );
  }

  return frames;
}

export function buildQuorumWriteFrames(
  start: Replica[],
  value: string,
  w: number
): SimFrame[] {
  const replicas = cloneReplicas(start);
  const n = replicas.length;
  const ids = writeQuorumIds(n, w);
  const nextVersion = maxVersion(replicas) + 1;
  const frames: SimFrame[] = [];

  frames.push(
    frame(replicas, {
      message: `Client write likes=${value} with W=${w}. Need ${w} replica ack(s) among ${n}.`,
      kind: "quorum-write",
      highlightIds: ids,
      clientWaiting: true,
      clientAcked: false,
    })
  );

  for (const id of ids) {
    const node = replicaById(replicas, id);
    node.value = value;
    node.version = nextVersion;
    frames.push(
      frame(replicas, {
        message: `${node.name} stores likes=${value} at version ${nextVersion} and acks.`,
        kind: "quorum-write",
        toId: id,
        highlightIds: [id],
        clientWaiting: true,
        clientAcked: false,
      })
    );
  }

  frames.push(
    frame(replicas, {
      message: `Write succeeds after ${w} ack(s). Nodes ${ids.join(", ")} have version ${nextVersion}.`,
      kind: "client-ack",
      highlightIds: ids,
      clientWaiting: false,
      clientAcked: true,
    })
  );
  return frames;
}

export function buildQuorumReadFrames(
  start: Replica[],
  r: number,
  w: number
): SimFrame[] {
  const replicas = cloneReplicas(start);
  const n = replicas.length;
  const ids = readQuorumIds(n, r);
  const frames: SimFrame[] = [];
  const intersects = quorumIntersects(n, w, r);
  const safe = quorumSafe(n, w, r);

  frames.push(
    frame(replicas, {
      message: `Client read with R=${r} from ${ids.join(", ")} (write set was the first ${w}).`,
      kind: "quorum-read",
      highlightIds: ids,
      clientWaiting: true,
      clientAcked: false,
    })
  );

  const winner = pickHighestVersion(replicas, ids);
  const newest = maxVersion(replicas);
  const stale = winner.version < newest;

  frames.push(
    frame(replicas, {
      message: stale
        ? `Highest version in the read set is ${winner.version} on ${winner.name} (${winner.value}). Missed version ${newest} — W+R ${safe ? ">" : "≤"} N, sets ${intersects ? "overlap" : "are disjoint"}.`
        : `Read returns ${winner.value} from ${winner.name} (version ${winner.version}), matching the newest copy.`,
      kind: stale ? "stale-read" : "quorum-read",
      fromId: winner.id,
      highlightIds: ids,
      clientWaiting: false,
      clientAcked: false,
      readValue: winner.value,
      stale,
    })
  );
  return frames;
}
