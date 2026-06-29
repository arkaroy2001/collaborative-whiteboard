# Interview Talking Points

Insights from this project worth referencing in technical interviews. Capture the
things that demonstrate depth: algorithmic choices with clear tradeoffs,
debugging stories with a real root cause, scaling/performance lessons, and
moments where we rejected an option for a concrete reason.

For each, aim to be able to tell the story: the problem, the options, why we
chose what we chose, and what we'd do differently. The CRDT layer is the
headline — anything that sharpens your ability to whiteboard it from memory goes
here.

Suggested format:

```markdown
## Short title

- **The setup:** The problem or question.
- **The insight / decision:** What we figured out or chose, and the tradeoff.
- **Why it's interview-worthy:** What it demonstrates.
```

---

## Do whiteboard shapes actually need a sequence CRDT?

- **The setup:** The instinct for "collaborative + CRDT" is to reach for a
  sequence CRDT (YATA/RGA/Logoot). Those exist to solve concurrent *insertion
  ordering* in an ordered list — the hard problem in collaborative *text*.
- **The insight / decision:** For a shape whiteboard where z-ordering beyond
  insertion order is out of scope, there is no meaningful sequence to maintain.
  The problem decomposes more cleanly into two well-understood pieces: an
  **OR-Set (Observed-Remove Set)** for *which elements exist* (this is what makes
  concurrent add-vs-delete converge — "add wins, remove only what you've
  observed"), plus a **per-element map of LWW-registers** for mutable properties
  (position, size), ordered by a **Lamport / hybrid logical clock with a
  client-id tiebreak**. Simpler to implement and to reason about than a sequence
  CRDT, and an honest fit for the data model.
- **Why it's interview-worthy:** Shows you can match the CRDT to the problem
  instead of cargo-culting the fanciest one — and that you understand what a
  sequence CRDT is actually *for* (and when it's overkill). Also sets up a clean
  explanation of OR-Set semantics and logical clocks. (**Resolved** — this is the
  committed model; see ADR-003.)

## Two layers: canonical CRDT vs. ephemeral cosmetic broadcast

- **The setup:** A naive build routes everything one client does to everyone —
  cursors, the half-finished stroke, the dragging silhouette — through the same
  channel as real edits. That conflates two kinds of state with opposite
  requirements.
- **The insight / decision:** Split into two layers that share no code path.
  **Layer 1 (CRDT)** is canonical: OR-Set + per-property LWW-Registers + Lamport
  clocks, persisted to a Postgres op log, survives reconnect/restart. **Layer 2
  (cosmetic broadcast)** is ephemeral: cursors and in-progress stroke/drag
  previews, pure relay, never persisted, gone on disconnect, no replay for late
  joiners. A gesture previews over Layer 2 and *commits* into Layer 1 exactly
  once (on mouse-up). Nothing mid-gesture is ever canonical.
- **Why it's interview-worthy:** It's the same separation Yjs calls "awareness,"
  arrived at from first principles. It keeps the convergence proof contained to
  Layer 1 (Layer 2 is allowed to be lossy/out-of-order because nothing depends on
  it later), and it's what makes high-frequency presence cheap enough to hit the
  ~50-clients-per-room target without bloating the op log. Shows you can identify
  which state actually needs consistency guarantees and which is fine to drop.

## "put = create-or-replace" collapses three operations under LWW

- **The setup:** Naive last-write-wins needs to handle add, move, and restyle.
- **The insight / decision:** Under LWW these are the *same* operation — replace
  the element with the latest full version. So the Week 1 protocol has a single
  `put` message instead of separate add/update/move/style messages.
- **Why it's interview-worthy:** A small example of letting the consistency model
  shape the API surface, and of deliberately building the throwaway-simple
  version first (it's explicitly replaced by the CRDT in Week 3) rather than
  prematurely generalizing.
