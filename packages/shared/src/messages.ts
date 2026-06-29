// The wire protocol: every message that crosses the WebSocket, in both
// directions. This file is the single source of truth for the contract between
// client and server — keeping it in `shared` means the two sides cannot drift.
//
// Discriminant is `t` (not `type`) so it never collides with an Element's
// `type` field. Every message is JSON; we send/receive `JSON.stringify`'d
// values of these unions.

import type { Element, ElementId, ClientId } from "./elements.js";

/** A connected participant, as seen by everyone in the room. */
export interface Peer {
  clientId: ClientId;
  userName: string;
}

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

/** Sent once, immediately after connecting, to enter a room. */
export interface JoinMessage {
  t: "join";
  roomId: string;
  userName: string;
}

/**
 * Create-or-replace an element. Under naive LWW this single message covers
 * adding a new shape, moving it, and restyling it — the sender just sends the
 * latest full version of the element and the receiver overwrites whatever it
 * had. (This collapses in Week 3 when the CRDT takes over conflict handling.)
 */
export interface PutMessage {
  t: "put";
  element: Element;
}

/** Remove an element from the board. */
export interface DeleteMessage {
  t: "delete";
  id: ElementId;
}

/** Local cursor moved. High-frequency; throttled on the client. */
export interface CursorMessage {
  t: "cursor";
  x: number;
  y: number;
}

export type ClientMessage =
  | JoinMessage
  | PutMessage
  | DeleteMessage
  | CursorMessage;

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

/**
 * First message a client receives after joining: the current board state plus
 * who else is here, and the client's own server-assigned id.
 */
export interface InitMessage {
  t: "init";
  selfId: ClientId;
  elements: Element[];
  peers: Peer[];
}

/** A peer (or the server echo) created-or-replaced an element. */
export interface ElementPutMessage {
  t: "put";
  element: Element;
}

/** A peer deleted an element. */
export interface ElementDeleteMessage {
  t: "delete";
  id: ElementId;
}

/** A peer's cursor moved. */
export interface PeerCursorMessage {
  t: "cursor";
  clientId: ClientId;
  x: number;
  y: number;
}

/** Someone joined the room. */
export interface PeerJoinMessage {
  t: "peer_join";
  peer: Peer;
}

/** Someone left the room. */
export interface PeerLeaveMessage {
  t: "peer_leave";
  clientId: ClientId;
}

export type ServerMessage =
  | InitMessage
  | ElementPutMessage
  | ElementDeleteMessage
  | PeerCursorMessage
  | PeerJoinMessage
  | PeerLeaveMessage;
