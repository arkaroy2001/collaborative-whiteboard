# 003. Two layers: canonical CRDT state + ephemeral cosmetic broadcast

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Two distinct kinds of shared state show up in a collaborative whiteboard, and
conflating them is a classic mistake:

1. **Canonical state** — which elements exist and what their properties are. This
   must converge correctly under concurrency, persist, and survive reconnects and
   server restarts. It is the source of truth for the canvas.
2. **Transient interaction state** — where someone's cursor is, the live preview
   of a stroke they're mid-way through drawing, the live preview of an element
   they're mid-drag. This exists only to make the UI feel alive. It is worthless a
   second after it's produced and meaningless after the producer disconnects.

Routing the second kind through the CRDT/persistence machinery would be wasteful
(op-log churn for data nobody keeps) and would muddy the correctness story for the
first kind. This ADR makes the separation explicit and binding. It also formally
resolves **Q1** (CRDT model) — previously parked for Week 3 — by committing to the
OR-Set + LWW-register + Lamport-clock model already sketched in
`interview-talking-points.md`.

## Decision

The system has **two completely separate layers**. They never share a code path.

### Layer 1 — CRDT layer (canonical, persisted)

The source of truth for the canvas. Hand-written, no CRDT library (per project
constraints).

- **OR-Set (Observed-Remove Set)** for element existence — makes concurrent
  add-vs-delete converge ("add wins; a remove only removes the adds it has
  observed"). Resolves the concurrent delete/re-add problem correctly.
- **One LWW-Register per mutable property** of an element (position, size, stroke,
  etc.), so two clients editing *different* properties of the same element don't
  clobber each other; only concurrent writes to the *same* property race.
- **Lamport clocks for ordering**, with a client-id tiebreak to make the order
  total and deterministic. This is the timestamp every LWW-Register compares on.
- **Persisted to a Postgres op log** (Q6 still decides op-log-vs-snapshot details
  in Week 2; whichever, the CRDT ops are what gets persisted).
- **Survives** reconnects, server restarts, and network drops. On rejoin a client
  reconciles against the canonical state.

### Layer 2 — Cosmetic broadcast (ephemeral, never persisted)

The "awareness"/presence channel. Pure relay — broadcast and forget.

- Live **cursor positions** (with user names).
- **In-progress stroke previews** while a pen stroke is being drawn.
- **In-progress drag previews** while an element is being moved.
- **Not persisted anywhere.** Never touches Postgres or the op log.
- **Disappears on disconnect** — no tombstones, no reconciliation, no replay for
  late joiners. A client that wasn't connected when a preview happened simply
  never sees it.
- Its only job is to make the UI feel live.

### The handoff between layers

A drawing interaction starts in Layer 2 and *commits* into Layer 1 exactly once,
at the end:

- **Pen:** live points stream over Layer 2 as a preview; on mouse-up the finished
  polyline is committed as a single atomic CRDT element (consistent with Q2 in
  ADR-002 — strokes are atomic in the canonical layer).
- **Drag/move:** the moving silhouette streams over Layer 2; on mouse-up the final
  position is written as an LWW-Register update in Layer 1.

So nothing mid-gesture is ever canonical, and every committed result goes through
the CRDT. Layer 2 is strictly a preview of a Layer-1 mutation that hasn't landed
yet (or, for cursors, of nothing at all).

## Consequences

- **Correctness stays contained.** The convergence proof only has to reason about
  Layer 1. Layer 2 has no convergence requirement — it's allowed to be lossy,
  out-of-order, and dropped on disconnect, because nothing depends on it later.
- **Cheap presence.** Cursor/preview traffic never hits Postgres, so high-
  frequency cosmetic updates don't bloat the op log or slow persistence. This is
  also what makes the Week 5 stress target (Q5, ~50 clients/room) tractable —
  the expensive channel is the cheap-to-drop one.
- **Two transports, one socket.** Both layers ride the same WebSocket but are
  distinguished by message type. The wire protocol will grow ephemeral message
  variants (cursor already exists; stroke/drag previews to be added) that are
  explicitly marked non-persisted and never enter room state used for `init`.
- **The Week 1 naive `put` relay (ADR-002) is the throwaway stand-in for Layer 1
  only.** Layer 2 (cursors, previews) is conceptually permanent; Layer 1's LWW
  relay gets replaced by the real CRDT in Week 3. ADR-002's `cursor` message is
  the first piece of Layer 2.
- **Q1 is now resolved**, not parked: OR-Set + per-property LWW-Registers +
  Lamport clock. Q3 (concurrent-move semantics) follows directly — a move is an
  LWW-Register write on the position property, so concurrent moves resolve by
  Lamport order + client-id tiebreak. Q6 (persistence shape) is still open for
  Week 2 but is now scoped to "how to persist Layer-1 ops," not whether Layer 2
  persists (it does not).
- **Risk to watch:** the handoff moment (preview → committed CRDT op) is where a
  visible "snap" can occur if the committed result differs from the last preview
  frame. Worth a deliberate test in Week 3–5.
