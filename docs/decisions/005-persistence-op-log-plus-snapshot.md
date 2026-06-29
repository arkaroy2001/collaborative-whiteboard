# 005. Persistence: op log + periodic snapshot

- **Status:** Accepted (Q6 resolved; implemented Week 2)
- **Date:** 2026-06-29

## Context

Layer 1 (the CRDT, ADR-003) must survive reconnects, server restarts, and network
drops. Postgres is the store. Question Q6: what do we actually persist?

- **Snapshot only** — store the current materialized room state; overwrite it
  periodically. Simple, small, but loses CRDT history: late-arriving concurrent
  ops have nothing to merge against, and you can't reconstruct *how* state was
  reached (no audit/debug of convergence).
- **Op log only** — append every CRDT op forever; rebuild state by replaying.
  Fully correct and replayable, but room load = replay the entire history, which
  grows without bound.
- **Op log + periodic snapshot** — append ops, and periodically write a snapshot
  of materialized state so load = latest snapshot + replay only the ops since.

Layer 2 (cosmetic broadcast) persists **nothing** (ADR-003) — this decision is
entirely about Layer-1 ops.

## Decision

**Op log + periodic snapshot.**

- Every Layer-1 CRDT operation is appended to a durable op log (table keyed by
  room, ordered for replay; ops carry their Lamport timestamp + clientId).
- Periodically (cadence TBD in implementation — e.g. every N ops or T seconds, or
  on a quiet-room timer) the server writes a **snapshot** of the materialized
  room state.
- **Recovery / room load** = load the latest snapshot, then replay only the ops
  logged after it. Restart and reconnect both go through this path.

## Consequences

- **Bounded load cost** without losing history — snapshots cap replay length; the
  op log keeps the full CRDT history for correct late-merge and for debugging
  convergence (a real asset when proving the CRDT correct, the project's #1
  success criterion).
- **The op log is the source of truth; the snapshot is a cache.** A snapshot can
  always be rebuilt by replaying from the previous one (or from zero), so a
  corrupt/missing snapshot is recoverable, not fatal.
- **Two write paths to keep consistent:** append-op and write-snapshot. Snapshot
  writes must record which op offset they cover, so replay-after-snapshot starts
  at the right point and never double-applies or skips.
- **Open sub-decisions for implementation (Week 2):** snapshot cadence/trigger;
  op-log table schema and ordering key; whether to prune log entries already
  subsumed by a snapshot (likely keep them initially — history is cheap and useful
  for the correctness story; revisit only if size becomes a problem).
- Consistent with the dumb-relay/minimal-server stance: persistence is an
  append + occasional checkpoint, not a complex transactional model.
