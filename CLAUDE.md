# Collaborative Whiteboard

## Project goal

A real-time collaborative whiteboard built from scratch as a portfolio/interview
project, with a **hand-written CRDT sync layer** (no Yjs/Automerge/any CRDT
library). Multiple users join a room by URL, draw rectangles/circles/lines and
free-draw, select/move/delete elements, and see each other's live cursors with
names. Edits must converge correctly under concurrent operations. State persists
in Postgres and survives reconnects and server restarts. Deployed to Fly.io. The
two success criteria, in order: (1) the CRDT layer is provably correct under
concurrency, and (2) the author understands every part of the codebase well
enough to defend it in technical interviews — the CRDT layer especially.

## Current week and focus

**Week 1: Naive last-write-wins prototype.** WebSocket server relays drawing
events; two browser tabs can draw on a shared canvas. No CRDT yet. Goal: prove
the plumbing works end-to-end.

(Timeline: W1 naive prototype · W2 persistence + multi-room · W3–4 CRDT · W5
cursor presence + perf/stress · W6 README + deploy + demo, hard ship cutoff.)

## Tech stack (decided — do not reopen)

- **Backend:** TypeScript + Node.js
- **WebSocket:** `ws` (not socket.io — want to understand the protocol)
- **Database:** Postgres (persistence)
- **Frontend:** React + TypeScript
- **Canvas:** HTML5 Canvas API directly (no third-party canvas library)
- **Deployment:** Fly.io
- **Local dev:** Docker for Postgres; pnpm for package management (workspaces)
- **CRDT:** hand-written, not a library

Conventions: TypeScript strict mode, no `any` without explicit approval. Prefer
boring, well-understood tech over novel choices.

## In scope

- Shapes: rectangles, circles, lines
- Free-draw (pen tool)
- Selection + move + delete of existing elements
- Live cursor presence with user names
- Multi-room support (one URL per room)
- Persistence across reconnects (canvas survives server restart)
- Authentication: simple name entry on join, no real auth
- Custom CRDT sync layer (hand-written, not a library)

## Out of scope (resist scope creep — push back if asked to add these)

- Text editing on canvas (a different CRDT problem entirely)
- Image upload
- Layers, z-ordering beyond insertion order
- Undo/redo
- Real authentication / accounts
- Mobile-specific UI
- LaTeX rendering, AI features, periodic tables, or any vertical-specific add-ons
- Using Yjs, Automerge, or any other CRDT library as a runtime dependency

## Dev environment

- Node v24 via **nvm** (pnpm 11 via corepack). Node is NOT on PATH in
  non-interactive shells — prefix commands with
  `source "$HOME/.nvm/nvm.sh" && nvm use 24`.
- Common: `pnpm install`, `pnpm typecheck`, `pnpm dev:server`, `pnpm dev:client`,
  `pnpm db:up` / `pnpm db:down` (Postgres via Docker, used from Week 2).

## Current architecture

pnpm monorepo, three packages:
- `packages/shared` — wire protocol + element types (the client/server contract).
  Exposes TS source directly (no build step) so both sides import the same types.
- `packages/server` — Node + `ws` WebSocket server (relay only so far; scaffold).
- `packages/client` — React + Vite + HTML5 Canvas (scaffold).

Wire protocol (`shared/src/messages.ts`): JSON messages discriminated by `t`.
Client→server: `join`, `put` (create-or-replace element), `delete`, `cursor`.
Server→client: `init`, `put`, `delete`, `cursor`, `peer_join`, `peer_leave`.
Naive last-write-wins for now; CRDT replaces conflict handling in Week 3.

## Active TODOs

- [ ] **Protocol sign-off** before building both sides on it: confirm circle as
      center+radius vs. bounding-box/ellipse; confirm one-socket-one-room.
- [ ] Decide whether to **commit** the scaffold (currently uncommitted).
- [ ] Decide the **permission allowlist / nvm-prefix** approach (see Known issues).
- [ ] Build the **Week 1 relay server** (`packages/server`): per-socket room,
      in-memory room state for late-joiner `init`, broadcast put/delete/cursor.
- [ ] Build the **Week 1 canvas client**; hit two-tabs-drawing milestone.
- [ ] Parked decisions: Q1 (CRDT model, W3), Q3 (concurrent move LWW, W3),
      Q6 (persistence: op log + snapshot vs snapshot only, W2).
- [ ] Confirm working assumptions: Q2 (atomic pen strokes), Q5 (50 in one room).

## Known issues

- **Slash commands `/start` and `/wrap` don't register** unless the Claude Code
  session is started from inside `whiteboard/` (commands are discovered from
  `<cwd>/.claude/commands/`, and this session was rooted at the parent folder).
  Workaround: launch the next session from `whiteboard/`, or ask to "run the
  wrap/start routine" manually.
- **`.claude/settings.json` permission allowlist not applied** — blocked by the
  auto-mode safety classifier (broad `Bash(node *)`/`Bash(npx *)`), and the
  proposed rules wouldn't match commands anyway because the nvm prefix makes
  every shell command compound. Needs a decision (apply manually / tighten /
  fix the nvm-prefix first).

---

For decision history see docs/decisions/. For session-by-session history see
docs/session-log.md. For interview-worthy insights see
docs/interview-talking-points.md.
