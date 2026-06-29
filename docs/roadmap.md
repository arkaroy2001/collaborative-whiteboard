# Roadmap — week-by-week build plan

A six-week plan to ship the collaborative whiteboard. Each week lists what to
build, how to know it's done, what to capture for interviews (success criterion
#2), and what to watch out for. The plan is built on the locked-in decisions:
two-layer architecture (ADR-003), client-minted IDs (ADR-004), op-log + periodic
snapshot persistence (ADR-005), and the wire protocol (ADR-002).

Timeline assumes ~12–15 focused hours/week. The W3–4 CRDT block is the make-or-
break — protect it. W6 is a hard ship cutoff.

---

## Week 1 — Naive last-write-wins prototype

**Goal:** prove the plumbing end-to-end. Two tabs draw on a shared canvas. No CRDT.

**Build — server (`packages/server`):**
- `ws` server; parse `roomId` from the connection URL (one-socket-one-room).
- In-memory room state: `Map<roomId, Map<elementId, Element>>` + connected-peer
  list per room.
- Handle `join` → reply `init` (current elements + peers), broadcast `peer_join`.
- Handle `put`/`delete` → mutate room state, broadcast to other peers.
- Relay `cursor` (pass-through only; rendering is W5).
- On disconnect → drop peer, broadcast `peer_leave`.

**Build — client (`packages/client`):**
- Name-entry screen → persist `name` + minted `clientId` in `localStorage`.
- Connect with `roomId` from URL; canvas render loop draws all local elements.
- Tools: rect, circle (center+radius), line, pen. Mouse down/move/up → mint a
  UUID, build the element, send `put`.
- Pen: collect points during drag, send one atomic `pen` element on mouse-up.
- Apply incoming `init`/`put`/`delete` to local state and redraw.

**Done when:** two tabs on the same room URL see each other's shapes appear live;
refresh re-syncs via `init`. (Last `put` wins — expected.)

**Capture:** `put` = create-or-replace collapses add/move/restyle; atomic strokes.

**Watch out:** canvas hit-testing for select/move is the fiddly part — if W1 runs
long, ship draw+sync first and push select/move/delete into early W2. Don't let
it block the two-tabs milestone.

---

## Week 2 — Persistence + multi-room

**Goal:** canvas survives server restart and reconnects; rooms are independent.

**Build:**
- Postgres via Docker (`db:up`). Two tables: `ops` (`room_id`, ordering key,
  `client_id`, `op_type`, `payload jsonb`, `created_at`) and `snapshots`
  (`room_id`, `state jsonb`, `up_to` offset, `created_at`).
- On `put`/`delete`: append to the op log (still naive ops — this builds the
  machinery W3 reuses).
- Room load (first join / after restart): load latest snapshot + replay newer ops
  → rebuild state → send as `init`.
- Periodic snapshot writer (every N ops or T seconds), recording the offset it
  covers.
- Multi-room isolation in DB + memory; lazy-load a room from DB on first join.
- Finish select / move / delete if it slipped from W1.

**Done when:** draw in room A → restart server → reconnect → canvas intact. Room B
is fully independent. Two rooms open at once don't bleed.

**Capture:** op-log + snapshot vs. snapshot-only; the snapshot-offset consistency
rule.

**Watch out:** snapshot/replay must never double-apply or skip ops — the `up_to`
offset is the contract. Get this right now; the CRDT depends on it.

---

## Week 3 — CRDT core (the headline, part 1: make it converge)

**Goal:** replace naive LWW with the hand-written CRDT; converge in memory.

**Build (in `packages/shared`, used by both sides):**
- **Lamport clock:** per-client counter; `+1` on local op, `max+1` on receive;
  tiebreak `(lamport, clientId)`.
- **OR-Set** for element existence: add carries a unique tag `(clientId, lamport)`;
  remove records observed tags (tombstones); add-wins.
- **LWW-Register** per mutable property (position, size, stroke…):
  `value + (lamport, clientId)`; higher wins. Pen `points` set once, immutable.
- **Op types:** `add-element`, `remove-element`, `set-property`. Define their wire
  format (evolves the protocol away from blunt `put`/`delete`).
- **Merge function:** apply a remote op into local state, order-independent.
- Server now relays *and* materializes (runs the same merge from `shared`) so it
  can build `init` and snapshots; clients materialize for rendering.

**Done when:** two tabs issuing concurrent ops reach byte-identical state (manual
test). Naive `put` is gone.

**Capture:** OR-Set semantics, LWW tiebreak, Lamport causality, why a sequence
CRDT is overkill here.

**Watch out:** this is the protocol-change week and the biggest single risk. Keep
the merge logic in `shared` so client and server can't diverge.

---

## Week 4 — CRDT correctness (part 2: *prove* it)

**Goal:** the #1 success criterion — provable convergence.

**Build:**
- **Simulation/property test harness:** generate random concurrent op histories,
  apply them in different orders across N replicas, assert all converge. Tests
  merge **commutativity, associativity, idempotency**.
- **Targeted scenarios:** concurrent add/delete (add-wins), concurrent move (LWW),
  delete-then-readd, out-of-order delivery, duplicate delivery (idempotency).
- **Persistence integration:** op log stores CRDT ops; snapshots store materialized
  CRDT state *including tombstones*; replay rebuilds correctly.
- **Reconnect catch-up:** a client that missed ops is made whole via `init`/replay.
- Document the **tombstone growth / GC** tradeoff (GC itself can be out of scope —
  but name it).

**Done when:** the suite proves convergence across randomized histories;
persistence round-trips CRDT state; you can explain every line unprompted.

**Capture:** the convergence proof, idempotency/commutativity in your own words,
the tombstone-GC tradeoff. This is your interview centerpiece.

**Watch out:** subtle bugs surface here and can spill. If W3–4 overruns, protect
this week — correctness is the project. Cut elsewhere (see below).

---

## Week 5 — Cursor presence + perf/stress (Layer 2)

**Goal:** the ephemeral cosmetic layer + performance under load.

**Build:**
- **Live cursors:** throttled broadcast of position; render peers' cursors with
  name + color; clear on `peer_leave`. Never persisted.
- **In-progress stroke previews:** stream points over the cosmetic channel while
  drawing; on mouse-up discard the preview and apply the canonical CRDT element.
- **In-progress drag previews:** stream the moving silhouette; on mouse-up write
  the canonical LWW position.
- Throttle/coalesce cosmetic messages (~30–60 Hz).
- **Stress test:** script ~50 ws clients drawing/moving in one room; measure
  latency, server CPU/memory, message rate. Fix the top bottleneck (likely
  full-canvas redraw → dirty-region rendering, and/or broadcast batching).

**Done when:** cursors + previews feel smooth across several tabs; the 50-client
test stays within acceptable latency; you've fixed (not just found) the #1 hotspot.

**Capture:** how the two-layer split makes presence cheap; the preview→canonical
"snap" and how you handled it; concrete perf numbers before/after.

**Watch out:** the handoff snap (last preview frame ≠ committed result) — the test
target flagged in ADR-003.

---

## Week 6 — README + deploy + demo (hard cutoff)

**Goal:** ship.

**Build:**
- **Fly.io deploy:** Dockerfile, `fly.toml`, attached Postgres, WebSocket config,
  secrets, run migrations.
- **Prod hardening:** client reconnect/backoff, health checks, connection limits.
- **README:** architecture overview, the CRDT explanation as the centerpiece,
  local-run instructions, design decisions (summarize/link the ADRs), demo
  gif/video.
- **Demo:** a live public room + a recorded multi-user session.

**Done when:** a live URL anyone can join, a README that explains the CRDT and lets
a reader run it locally, and a recorded demo. Portfolio-ready.

**Watch out:** deploy always surprises (WebSockets behind Fly's proxy, Postgres
networking, cold starts). Budget a buffer; this is why it's the cutoff week.

---

## If you fall behind — cut in this order

1. Stress-test polish / advanced perf (keep the *test*, drop deep optimization).
2. Drag/stroke preview animations (keep cursors).
3. Restyle/extra properties (keep position/size/existence).
4. **Never cut:** CRDT correctness (W4) or the deploy + README (W6). Those *are*
   the two success criteria.
