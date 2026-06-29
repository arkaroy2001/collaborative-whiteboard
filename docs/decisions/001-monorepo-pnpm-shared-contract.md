# 001. pnpm monorepo with a shared protocol package

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

The project has three deployable/runnable parts — a Node WebSocket server, a
React client, and the data types they exchange over the wire. We need a repo
layout and a package manager.

Forces:
- Client and server must agree exactly on the wire protocol and element shapes.
  If those types are defined twice, they drift, and protocol drift produces
  silent, hard-to-debug bugs.
- Stack principle: prefer boring, well-understood tooling.
- Package-manager options considered: **pnpm** vs **bun**. Bun is faster with
  nicer DX but is the novel choice and can surface edge cases with native-ish
  deps (`ws`, the Postgres driver) and on the Fly deploy. pnpm has mature,
  predictable workspaces.

## Decision

A single repo using **pnpm workspaces** with three packages:
- `packages/shared` — the wire protocol (messages) and element types. The single
  source of truth for the client/server contract.
- `packages/server` — Node + `ws`.
- `packages/client` — React + Vite + Canvas.

Chose **pnpm** over bun for maturity/predictability, consistent with the
boring-tech principle.

`shared` exposes its TypeScript **source** directly (`main`/`exports` →
`src/index.ts`) rather than a compiled artifact. Both consumers already compile
TS (server via `tsx`, client via Vite), so this removes a build step and makes
protocol edits instantly visible on both sides.

Base TS config is strict, plus `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, and `verbatimModuleSyntax` — the stricter flags
catch the array/optional/import bugs common in protocol code.

## Consequences

- Client and server cannot disagree about the protocol — it exists in exactly
  one place they both import. This is the main win.
- No build/watch step for `shared` during dev; edits propagate immediately.
- Tradeoff: `shared` shipping raw TS means anything consuming it must compile TS.
  Fine here (both do). If we ever needed to publish `shared` or consume it from
  plain JS, we'd add a real build.
- Production server build with ESM + bundler-style resolution is unresolved
  (deferred to Week 6 deploy); dev runs via `tsx`, so it doesn't bite yet.
- pnpm 10+ blocks dependency build scripts by default; we explicitly allow
  `esbuild` (needed by Vite/tsx) via `allowBuilds` in pnpm-workspace.yaml.
