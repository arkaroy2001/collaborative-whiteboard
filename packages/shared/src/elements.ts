// The drawable elements that live on the canvas. This is the shared vocabulary
// for "what is on the board" — both client and server speak it.
//
// Week 1 note: there is no CRDT yet. An element is just data; conflict handling
// is naive last-write-wins (whoever's `put` arrives last wins). In Week 3 these
// shapes become the values wrapped by the CRDT, but the geometry below should
// stay largely stable.

export type ElementId = string;
export type ClientId = string;

export type Point = { x: number; y: number };

/** Fields common to every element. */
export interface ElementBase {
  id: ElementId;
  /** The client that originally created this element. */
  createdBy: ClientId;
  /** Stroke color, any CSS color string. */
  stroke: string;
  strokeWidth: number;
}

/** Axis-aligned rectangle, defined by a top-left origin plus size. */
export interface RectElement extends ElementBase {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Circle, defined by center and radius. */
export interface CircleElement extends ElementBase {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
}

/** Straight line segment between two points. */
export interface LineElement extends ElementBase {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Free-draw stroke. Per our Week 1 decision, a pen stroke is ATOMIC: the whole
 * polyline is captured on mouse-up and committed as one element. We do not
 * stream points live (that would reintroduce an ordering problem inside each
 * stroke). `points` are in canvas coordinates.
 */
export interface PenElement extends ElementBase {
  type: "pen";
  points: Point[];
}

/** Discriminated union of everything that can be on the board. */
export type Element = RectElement | CircleElement | LineElement | PenElement;

export type ElementType = Element["type"];
