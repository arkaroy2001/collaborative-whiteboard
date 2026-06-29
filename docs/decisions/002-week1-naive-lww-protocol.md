# 002. Week 1 wire protocol (naive last-write-wins)

- **Status:** Accepted (expected to be superseded for conflict handling in Week 3)
- **Date:** 2026-06-28

## Context

Week 1's goal is to prove the plumbing: a WebSocket server relays drawing events
so two browser tabs draw on a shared canvas. No CRDT yet — conflict handling is
naive last-write-wins by message arrival order. We need a wire protocol that is
minimal for Week 1 but won't force a total rewrite of the *geometry* later.

Considerations:
- How to represent add vs. move vs. restyle of an element.
- Message discriminant naming, given elements already use a `type` field.
- How rooms bind to connections.
- Free-draw representation (tied to the Q2 decision).

## Decision

Protocol lives in `packages/shared/src/{elements,messages}.ts`. JSON messages.

- **Elements** are a discriminated union on `type`: `rect` (origin+size),
  `circle` (center+radius), `line` (two points), `pen` (atomic `points[]`).
  Shared base: `id`, `createdBy`, `stroke`, `strokeWidth`.
- **Pen strokes are atomic in the canonical layer** (Q2): a stroke is captured
  locally as the user draws, then committed to the CRDT as a **single element**
  with an immutable `points: Array<{x, y}>` property on mouse-up. One element id,
  one immutable points array, one CRDT operation. There are **no per-point CRDT
  operations** — nothing inside a stroke needs sequence-CRDT machinery.
  - *Live preview is a separate channel.* While drawing, in-progress points are
    streamed over the non-CRDT cosmetic layer (ADR-003, Layer 2) so other users
    see the stroke appear live. Those broadcasts are ephemeral, unordered, carry
    no Lamport timestamps, and are never persisted. On mouse-up the cosmetic
    preview is discarded and replaced by the canonical CRDT element. Streaming is
    a UI affordance; it does not change what the system stores or how it
    converges. (See ADR-003 for the general two-layer split.)
- **Messages** are discriminated by `t` (not `type`, to avoid colliding with an
  element's shape `type`).
  - Client→server: `join`, `put`, `delete`, `cursor`.
  - Server→client: `init`, `put`, `delete`, `cursor`, `peer_join`, `peer_leave`.
- **`put` = create-or-replace.** Under naive LWW, "add a shape" and
  "move/restyle a shape" are the same operation: send the latest full element,
  receiver overwrites. One message covers all three.
- **One socket = one room.** The server infers the room from the connection, so
  per-op messages (`put`/`delete`/`cursor`) carry no `roomId`.

## Consequences

- Smallest possible Week 1 surface: essentially `put`/`delete`/`cursor` + a
  `join`/`init` handshake.
- The conflict-handling half of this (LWW via `put` replace) is explicitly
  temporary — Week 3's CRDT replaces it. The element *geometry* should remain
  largely stable across that change.
- One-socket-one-room keeps routing trivial but means a client viewing two rooms
  needs two sockets. Acceptable for this app.
- Open for sign-off: circle as center+radius vs. bounding-box/ellipse (drag-draw
  naturally yields a box). Changing it is a protocol change, cheap to do now.
- Sending the full element on every move is chatty; fine for Week 1 (throttle /
  send-on-drag-end). Revisit if it matters under the Week 5 stress test.
- **Atomic-stroke consequences:** no sequence-CRDT inside a stroke (points are
  immutable once committed); two clients can never concurrently mutate the *same*
  stroke (only the drawing user produces it, and once committed it's edited at the
  element level — move/delete the whole stroke, not individual points). The
  tradeoff is slight: an in-progress stroke looks a little behind the drawer's own
  view due to network latency on the cosmetic channel — acceptable, and matches
  Figma's behavior.
