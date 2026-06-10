/**
 * Meander resonator (λ/4) — CPW with bold coupling pad and open-end termination.
 *
 * LOD reveal:
 *   L1: centerline polyline + faint coupling tab silhouette
 *   L2: + CPW metal trace polygon, coupling pad metal
 *   L3: + CPW ground cutout (gap), coupling-gap halo, open-end T-bar
 *   L4: + dimension annotations (length, W, gap)
 */
import { buildCPW, meanderCenterline, type Pt } from "./cpw";
import { rectPath, type ComponentGeometry, type Annotation, type Shape } from "./types";

export interface MeanderResonatorParams {
  length?: number;
  turns?: number;
  amplitude?: number;
  leadIn?: number;
  traceWidth?: number;
  gap?: number;
  fillet?: number;
  axis?: "horizontal" | "vertical";
  /** When true, turns auto-derive from length/pitch */
  autoTurns?: boolean;
  pitch?: number;
  /** Render a visible coupling pad at the `coupler` end. Default true. */
  couplingPad?: boolean;
  /** Color/role variant: readout (blue) vs bus (teal). Default "readout". */
  variant?: "readout" | "bus";
}

export function meanderResonator(p: MeanderResonatorParams = {}): ComponentGeometry {
  const length = p.length ?? 3.2;
  const amplitude = p.amplitude ?? 0.30;
  const leadIn = p.leadIn ?? 0.18;
  const axis = p.axis ?? "horizontal";
  const pitch = p.pitch ?? 0.32;
  const autoTurns = p.autoTurns ?? true;
  // autoTurns: derive turn count from length/pitch per spec formula
  const turns = autoTurns
    ? Math.max(1, Math.round((length - 2 * leadIn) / pitch))
    : Math.max(1, p.turns ?? 8);
  const traceWidth = p.traceWidth ?? 0.028;
  const gap = p.gap ?? 0.014;
  const fillet = p.fillet ?? 0.090;
  const showCoupling = p.couplingPad ?? true;
  const variant = p.variant ?? "readout";
  // At L1 (chip overview), use dark gray outline like Qiskit Metal matplotlib view.
  // At L2+, switch to variant-specific colors (blue for readout, teal for bus).
  const traceColorL1 = "var(--cad-metal)";
  const traceColor = variant === "bus" ? "var(--cad-bus)" : "var(--cad-readout)";
  const coupleColor = variant === "bus" ? "var(--cad-bus-couple)" : "var(--cad-readout-couple)";
  const tag = variant === "bus" ? "BUS" : "λ/4";

  const start: Pt = { x: 0, y: 0 };
  const end: Pt = axis === "horizontal" ? { x: length, y: 0 } : { x: 0, y: length };

  const center = meanderCenterline(start, end, { turns, amplitude, leadIn });
  const cpw = buildCPW(center, { traceWidth, gap, fillet });

  // Coupling pad at start (a thicker stub perpendicular to the lead-in)
  const padLen = Math.max(0.12, leadIn * 0.9);
  // Guard: padW must be at least traceWidth × 2.5 (Req 3.3)
  const padW = Math.max(traceWidth * 2.5, 0.040);
  const padGap = gap * 1.6;
  const couplingShapes: Shape[] = showCoupling
    ? (axis === "horizontal"
      ? [
        { layer: "ground", d: rectPath(padLen / 2 - 0.01, -padW / 2 - padGap - 0.005, padLen + padGap * 2, padW + padGap * 2 + 0.01, 0.005), fill: "var(--cad-gap)", minDetail: 3 },
        { layer: "metal", d: rectPath(padLen / 2, -padW / 2, padLen, padW, 0.004), fill: coupleColor, minDetail: 2 },
      ]
      : [
        { layer: "ground", d: rectPath(-padW / 2 - padGap - 0.005, padLen / 2 - 0.01, padW + padGap * 2 + 0.01, padLen + padGap * 2, 0.005), fill: "var(--cad-gap)", minDetail: 3 },
        { layer: "metal", d: rectPath(-padW / 2, padLen / 2, padW, padLen, 0.004), fill: coupleColor, minDetail: 2 },
      ])
    : [];

  // Open-end T termination cap at L3+
  const tBarLen = traceWidth * 4;
  const tBarW = traceWidth * 1.4;
  const tBarPath = axis === "horizontal"
    ? rectPath(end.x, end.y, tBarW, tBarLen, 0.002)
    : rectPath(end.x, end.y, tBarLen, tBarW, 0.002);
  const tBarGapPath = axis === "horizontal"
    ? rectPath(end.x, end.y, tBarW + gap * 2, tBarLen + gap * 2, 0.003)
    : rectPath(end.x, end.y, tBarLen + gap * 2, tBarW + gap * 2, 0.003);

  const halfAmp = amplitude + 0.05;
  const bbox = axis === "horizontal"
    ? { x: -padGap, y: -Math.max(halfAmp, padW / 2 + padGap), w: length + padGap, h: Math.max(halfAmp, padW / 2 + padGap) * 2 }
    : { x: -Math.max(halfAmp, padW / 2 + padGap), y: -padGap, w: Math.max(halfAmp, padW / 2 + padGap) * 2, h: length + padGap };

  const fmt = (v: number) => `${(v * 1000).toFixed(0)}µm`;
  const annotations: Annotation[] = axis === "horizontal" ? [
    { x: length / 2, y: -halfAmp - 0.02, text: `${tag} L=${length.toFixed(2)}mm · ${turns}T`, anchor: "middle" },
    { x: length, y: 0, text: `W=${fmt(traceWidth)} g=${fmt(gap)}`, anchor: "start" },
  ] : [
    { x: -halfAmp - 0.02, y: length / 2, text: `${tag} L=${length.toFixed(2)}mm`, anchor: "end", rotation: -90 },
  ];

  return {
    shapes: [
      // L1 — simplified centerline stroke (dark gray at overview, matches Qiskit Metal CPW outline style)
      {
        layer: "metal",
        d: cpw.centerline,
        fill: "none",
        stroke: traceColorL1,
        strokeWidth: 0.034,
        maxDetail: 1,
      },
      // L3+ ground cutout for the CPW
      { layer: "ground", d: cpw.gap, fill: "var(--cad-gap)", minDetail: 3 },
      // open-end termination ground halo (L3+)
      { layer: "ground", d: tBarGapPath, fill: "var(--cad-gap)", minDetail: 3 },
      // L2+ metal trace polygon (variant color)
      { layer: "metal", d: cpw.trace, fill: traceColor, minDetail: 2 },
      // open-end T-bar metal (L3+)
      { layer: "metal", d: tBarPath, fill: traceColor, minDetail: 3 },
      // coupling pad + halo
      ...couplingShapes,
    ],
    pins: [
      { name: "coupler", x: start.x, y: start.y, angle: axis === "horizontal" ? Math.PI : -Math.PI / 2 },
      { name: "open", x: end.x, y: end.y, angle: axis === "horizontal" ? 0 : Math.PI / 2 },
    ],
    bbox,
    annotations,
  };
}
