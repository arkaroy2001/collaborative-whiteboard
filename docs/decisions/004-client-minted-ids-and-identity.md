# 004. Client-minted element IDs and client identity

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Every element needs a unique `id`, and every client needs a stable identity
(`clientId`) — used now as `createdBy`, and later as the **tiebreak in Lamport
clock ordering** for the CRDT (ADR-003). Two ways to assign these:

- **Server-assigned:** the server allocates IDs on `put` and tells the client.
  Simplest possible Week 1 path.
- **Client-minted:** the client generates element IDs and its own `clientId`
  locally, with no server round-trip.

A CRDT requires that operations can be created **offline / optimistically** and
merge later. That is impossible if IDs come from a central authority — a
disconnected client could not create an element at all, and concurrent creates
would serialize through the server (defeating the point). The Lamport tiebreak
also needs a client identity that exists before the first message is sent.

## Decision

**IDs and identity are minted on the client, from Week 1.**

- **Element `id`:** generated client-side (UUID / collision-resistant random) at
  creation time. The server never allocates IDs; it relays whatever the client
  sent.
- **`clientId`:** generated once on the client and **persisted in
  `localStorage`**, so a reconnecting browser is treated as the *same* actor
  (same identity for `createdBy` and for the future Lamport tiebreak). A new
  browser / cleared storage = a new actor, which is correct.
- **User name:** entered on join, also persisted in `localStorage` alongside
  `clientId` (the name is a display label; `clientId` is the stable identity).

This is adopted in Week 1 even though the naive relay doesn't strictly need it,
specifically so the Week 1 code carries into the Week 3 CRDT unchanged.

## Consequences

- **No rewrite at the CRDT boundary.** Optimistic local creation, offline edits,
  and concurrent creates-without-collision all work by construction — the hard
  requirements ADR-003's Layer 1 depends on.
- **The server stays a dumb relay** for IDs (consistent with ADR-002's
  one-socket-one-room, minimal-server stance). It never needs an ID allocator or
  sequence.
- **Trust boundary noted:** clients assert their own IDs and `clientId`. For this
  no-real-auth portfolio app that's acceptable; a hostile client could spoof a
  `clientId`, but there are no security guarantees in scope (see CLAUDE.md auth
  scope). Worth saying out loud in an interview rather than pretending it's
  authenticated.
- **`localStorage` identity** means identity is per-browser-profile, not per-user
  — fine given "simple name entry, no real auth."
- Element `id` and `clientId` belong in the `shared` types as plain string
  fields; no protocol change beyond confirming they're always client-supplied.
