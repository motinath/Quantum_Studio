/**
 * Straight + meander CPW routing between two pin world-positions.
 *
 * LOD reveal:
 *   L1: simplified centerline polyline
 *   L2: + trace polygon
 *   L3: + ground cutout (gap)
 *   L4: + width/gap label at midpoint
 */
import { buildCPW, meanderCenterline, type Pt } from "./cpw";
import type { ComponentGeometry, Annotation } from "./types";

export interface RouteParams {
  waypoints: Pt[];
  meander?: boolean;
  meanderTurns?: number;
  meanderAmp?: number;
  traceWidth?: number;
  gap?: number;
  fillet?: number;
  /** Visual variant — feedline (dark gray, thick) vs default trace. */
  variant?: "feedline" | "control" | "default";
}

export function routeCPW(p: RouteParams): ComponentGeometry {
  const wp = p.waypoints;
  if (wp.length < 2) {
    return { shapes: [], pins: [], bbox: { x: 0, y: 0, w: 0, h: 0 } };
  }
  let centerline: Pt[];
  if (p.meander && wp.length === 2) {
    centerline = meanderCenterline(wp[0], wp[1], {
      turns: p.meanderTurns ?? 4,
      amplitude: p.meanderAmp ?? 0.15,
      leadIn: 0.10,
    });
  } else {
    centerline = wp;
  }
  const variant = p.variant ?? "default";
  const isFeed = variant === "feedline";
  const tw = p.traceWidth ?? (isFeed ? 0.028 : 0.014);
  const gap = p.gap ?? (isFeed ? 0.014 : 0.008);
  const cpw = buildCPW(centerline, { traceWidth: tw, gap, fillet: p.fillet });
  const traceColor = isFeed ? "var(--cad-feedline)" : "var(--cad-trace)";

  const xs = centerline.map(p => p.x);
  const ys = centerline.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const fmt = (v: number) => `${(v * 1000).toFixed(0)}µm`;
  const midIdx = Math.floor(centerline.length / 2);
  const mid = centerline[midIdx];
  const annotations: Annotation[] = [
    { x: mid.x, y: mid.y - 0.02, text: `${isFeed ? "feedline " : ""}W=${fmt(tw)} g=${fmt(gap)}`, anchor: "middle" },
  ];

  return {
    shapes: [
      // L1 — bare centerline — always dark gray at overview (like Qiskit Metal CPW outlines)
      { layer: "metal", d: cpw.centerline, fill: "none", stroke: "var(--cad-metal)", strokeWidth: isFeed ? 0.030 : 0.020, maxDetail: 1 },
      // L3+ ground cutout
      { layer: "ground", d: cpw.gap, fill: "var(--cad-gap)", minDetail: 3 },
      // L2+ trace polygon
      { layer: "metal", d: cpw.trace, fill: traceColor, minDetail: 2 },
    ],
    pins: [],
    bbox: { x: minX - 0.05, y: minY - 0.05, w: maxX - minX + 0.1, h: maxY - minY + 0.1 },
    annotations,
  };
}
