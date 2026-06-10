/**
 * Wirebond launch pad → taper → CPW transition.
 *
 * LOD reveal:
 *   L1: pad silhouette
 *   L2: + taper trapezoid
 *   L3: + CPW stub + ground pocket
 *   L4: + bond pad dimensions + pin marker
 */
import type { ComponentGeometry, Annotation } from "./types";
import { rectPath, circlePath } from "./types";

export interface LaunchpadParams {
  padW?: number;
  padH?: number;
  taperLen?: number;
  traceWidth?: number;
  gap?: number;
  stubLen?: number;
}

export function launchpad(p: LaunchpadParams = {}): ComponentGeometry {
  const padW = p.padW ?? 0.32;
  const padH = p.padH ?? 0.32;
  const taper = p.taperLen ?? 0.18;
  const tw = p.traceWidth ?? 0.020;
  const g = p.gap ?? 0.010;
  const stub = p.stubLen ?? 0.08;

  const halfTrace = tw / 2;
  const halfGap = tw / 2 + g;
  const padHalfH = padH / 2;
  const padGapH = padHalfH + g + 0.008;

  const gapPath =
    `M ${-padW - g} ${-padGapH} L 0 ${-padGapH} ` +
    `L ${taper} ${-halfGap} L ${taper + stub} ${-halfGap} ` +
    `L ${taper + stub} ${halfGap} L ${taper} ${halfGap} ` +
    `L 0 ${padGapH} L ${-padW - g} ${padGapH} Z`;

  // Outer pad: gray rectangle (just the bond pad, no taper)
  const outerPadPath = `M ${-padW} ${-padHalfH} L 0 ${-padHalfH} L 0 ${padHalfH} L ${-padW} ${padHalfH} Z`;
  // Inner center conductor: taper + stub
  const centerPath =
    `M 0 ${-padHalfH} ` +
    `L ${taper} ${-halfTrace} L ${taper + stub} ${-halfTrace} ` +
    `L ${taper + stub} ${halfTrace} L ${taper} ${halfTrace} ` +
    `L 0 ${padHalfH} Z`;

  const fmt = (v: number) => `${(v * 1000).toFixed(0)}µm`;
  const annotations: Annotation[] = [
    { x: -padW / 2, y: padGapH + 0.018, text: `${fmt(padW)} × ${fmt(padH)}`, anchor: "middle" },
    { x: taper + stub, y: -halfGap - 0.008, text: `W=${fmt(tw)} g=${fmt(g)}`, anchor: "end" },
  ];

  return {
    shapes: [
      // L1 — gray pad silhouette
      { layer: "metal", d: rectPath(-padW / 2, 0, padW, padH, 0.01), maxDetail: 1, fill: "var(--cad-launch-pad)" },

      // L3+ ground pocket / etched outline
      { layer: "ground", d: gapPath, fill: "var(--cad-gap)", minDetail: 3 },
      // L2+ outer wirebond pad (gray)
      { layer: "metal", d: outerPadPath, fill: "var(--cad-launch-pad)", stroke: "var(--cad-launch-pad-stroke)", minDetail: 2 },
      // L2+ center conductor (blue)
      { layer: "metal", d: centerPath, fill: "var(--cad-launch-center)", minDetail: 2 },
      // L4 — wirebond contact point in the center of the pad
      { layer: "metal", d: circlePath(-padW / 2, 0, Math.min(padW, padH) * 0.15), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", strokeWidth: 0.005, minDetail: 4 },
    ],
    pins: [{ name: "tie", x: taper + stub, y: 0, angle: 0 }],
    bbox: { x: -padW - g, y: -padGapH, w: padW + g + taper + stub, h: padGapH * 2 },
    annotations,
  };
}
