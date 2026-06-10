/** Shared geometry-layer types used by every component generator. */

export type LayerKind = "ground" | "metal" | "junction" | "pin" | "label";

/** LOD tier — higher number = more detail visible. */
export type Detail = 1 | 2 | 3 | 4;

export interface Pin {
  name: string;
  x: number;        // mm, world coords (after placement)
  y: number;
  /** Direction the pin "faces", radians (0 = +x). Used for CPW routing. */
  angle: number;
}

export interface Shape {
  layer: LayerKind;
  /** SVG path "d" string. mm units. */
  d: string;
  /** Optional fill override (uses CSS vars by default). */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Lowest LOD at which this shape is drawn (default 1 — always). */
  minDetail?: Detail;
  /** Highest LOD at which this shape is drawn (default 4 — always). */
  maxDetail?: Detail;
}

export interface Annotation {
  /** mm coords (component-local). */
  x: number;
  y: number;
  text: string;
  /** Optional rotation in degrees. */
  rotation?: number;
  /** Anchor: "start" | "middle" | "end" (SVG text-anchor). */
  anchor?: "start" | "middle" | "end";
  /** Default 4 — dimension labels only at full zoom. */
  minDetail?: Detail;
}

export interface ComponentGeometry {
  shapes: Shape[];
  pins: Pin[];
  bbox: { x: number; y: number; w: number; h: number };
  /** Optional dimension/text annotations rendered at high LOD. */
  annotations?: Annotation[];
}

export interface Placement {
  x: number;          // mm
  y: number;          // mm
  rotation?: number;  // degrees, around (x,y)
}

/** Helper: rotate (px, py) around origin by `deg` */
export function rot(deg: number, px: number, py: number) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: px * c - py * s, y: px * s + py * c };
}

/** Build a rectangle path centered at (cx,cy), width w, height h. */
export function rectPath(cx: number, cy: number, w: number, h: number, r = 0): string {
  const x = cx - w / 2, y = cy - h / 2;
  if (r <= 0) {
    return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
  }
  const rr = Math.min(r, w / 2, h / 2);
  return `M ${x + rr} ${y} h ${w - 2 * rr} a ${rr} ${rr} 0 0 1 ${rr} ${rr} v ${h - 2 * rr} a ${rr} ${rr} 0 0 1 ${-rr} ${rr} h ${-(w - 2 * rr)} a ${rr} ${rr} 0 0 1 ${-rr} ${-rr} v ${-(h - 2 * rr)} a ${rr} ${rr} 0 0 1 ${rr} ${-rr} Z`;
}

/** Build a circle as an SVG path so we can keep everything in one shape type. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

/** Apply placement to a Pin (local → world). */
export function placePin(p: Pin, placement: Placement): Pin {
  const rotation = placement.rotation ?? 0;
  const r = rot(rotation, p.x, p.y);
  return {
    name: p.name,
    x: r.x + placement.x,
    y: r.y + placement.y,
    angle: p.angle + (rotation * Math.PI) / 180,
  };
}
