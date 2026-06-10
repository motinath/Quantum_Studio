/**
 * Capacitive coupler — two facing finger pads separated by an explicit gap.
 *
 * LOD reveal:
 *   L1: pair silhouette
 *   L2: + individual finger pads (visible gap)
 *   L3: + ground cutout halo
 *   L4: + coupling gap dimension label
 */
import { rectPath, type ComponentGeometry, type Annotation } from "./types";

export interface CapCouplerParams {
  fingerLen?: number;
  fingerW?: number;
  gap?: number;
}

export function capCoupler(p: CapCouplerParams = {}): ComponentGeometry {
  const l = p.fingerLen ?? 0.12;
  const w = p.fingerW ?? 0.030;
  const g = p.gap ?? 0.008;
  const fmt = (v: number) => `${(v * 1000).toFixed(0)}µm`;

  const totalW = l * 2 + g;
  const numFingers = 4;
  const baseW = 0.015; // backing bar thickness
  const fW = Math.max(0.006, w / 4); // individual finger width
  const fGap = Math.max(0.004, (w - numFingers * fW) / (numFingers - 1)); // gap between fingers
  const barH = numFingers * fW + (numFingers - 1) * fGap;

  const leftBarX = -totalW / 2 + baseW / 2;
  const rightBarX = totalW / 2 - baseW / 2;

  const shapes: ComponentGeometry["shapes"] = [
    // L1 silhouette — purple
    { layer: "metal", d: rectPath(0, 0, totalW, barH), maxDetail: 1, fill: "var(--cad-coupler)" },
    // L3+ ground cutout halo
    { layer: "ground", d: rectPath(0, 0, totalW + 0.03, barH + 0.02, 0.003), fill: "var(--cad-gap)", minDetail: 3 },
    // L2+ backing bars (metal)
    { layer: "metal", d: rectPath(leftBarX, 0, baseW, barH, 0.001), fill: "var(--cad-coupler)", stroke: "var(--cad-coupler-stroke)", minDetail: 2 },
    { layer: "metal", d: rectPath(rightBarX, 0, baseW, barH, 0.001), fill: "var(--cad-coupler)", stroke: "var(--cad-coupler-stroke)", minDetail: 2 },
  ];

  // Draw 4 alternating fingers
  for (let i = 0; i < numFingers; i++) {
    const y_i = -barH / 2 + fW / 2 + i * (fW + fGap);
    if (i % 2 === 0) {
      // Left finger: extends from left bar to near right bar
      const xStart = -totalW / 2 + baseW;
      const xEnd = totalW / 2 - baseW - g;
      shapes.push({
        layer: "metal",
        d: rectPath((xStart + xEnd) / 2, y_i, xEnd - xStart, fW, 0.001),
        fill: "var(--cad-coupler)",
        stroke: "var(--cad-coupler-stroke)",
        minDetail: 2,
      });
    } else {
      // Right finger: extends from right bar to near left bar
      const xStart = -totalW / 2 + baseW + g;
      const xEnd = totalW / 2 - baseW;
      shapes.push({
        layer: "metal",
        d: rectPath((xStart + xEnd) / 2, y_i, xEnd - xStart, fW, 0.001),
        fill: "var(--cad-coupler)",
        stroke: "var(--cad-coupler-stroke)",
        minDetail: 2,
      });
    }
  }

  return {
    shapes,
    pins: [
      { name: "a", x: -totalW / 2, y: 0, angle: Math.PI },
      { name: "b", x: totalW / 2, y: 0, angle: 0 },
    ],
    bbox: { x: -(totalW / 2 + 0.01), y: -barH / 2 - 0.01, w: totalW + 0.02, h: barH + 0.02 },
    annotations: [
      { x: 0, y: barH / 2 + 0.015, text: `coupler gap ${fmt(g)}`, anchor: "middle" },
    ],
  };
}
