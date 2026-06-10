/**
 * TransmonPocket / TransmonPocketCL — pocket with two capacitor islands + JJ.
 *
 * LOD reveal:
 *   L1: simplified pocket silhouette
 *   L2: + two capacitor pads
 *   L3: + ground pocket + etched halo + (optional) charge line
 *   L4: + explicit JJ rect + pin markers + dimension annotations
 */
import { circlePath, rectPath, type ComponentGeometry, type Annotation } from "./types";

export interface TransmonPocketParams {
  pocketW?: number;
  pocketH?: number;
  padW?: number;
  padH?: number;
  padGap?: number;
  jjGap?: number;
  hasChargeLine?: boolean;
  clTraceWidth?: number;
  clGap?: number;
}

export function transmonPocket(p: TransmonPocketParams = {}): ComponentGeometry {
  const pW = p.pocketW ?? 0.65;
  const pH = p.pocketH ?? 0.45;
  const padW = p.padW ?? 0.45;
  const padH = p.padH ?? 0.085;
  const padGap = p.padGap ?? 0.030;
  const jjGap = p.jjGap ?? 0.008;
  const cl = p.hasChargeLine ?? false;
  const clTW = p.clTraceWidth ?? 0.012;
  const clG = p.clGap ?? 0.006;

  const yTop = padGap / 2 + padH / 2;
  const yBot = -yTop;
  const fmt = (v: number) => `${(v * 1000).toFixed(0)}µm`;

  const gap_finger = 0.015;
  const fingerW_claw = 0.012;
  const leadW = 0.012;
  const fingerH_claw = padH * 0.95;

  // Horizontal claw coordinates (top & bottom)
  const yClawTop = yTop + padH / 2 + gap_finger + fingerW_claw / 2;
  const yClawBot = yBot - padH / 2 - gap_finger - fingerW_claw / 2;

  // Vertical claw coordinates (left & right)
  const xClawLeft = -padW / 2 - gap_finger - fingerW_claw / 2;
  const xClawRight = padW / 2 + gap_finger + fingerW_claw / 2;

  const shapes: ComponentGeometry["shapes"] = [
    // L1 silhouette — gray pocket rectangle behind the pads (like Qiskit Metal overview)
    { layer: "ground", d: rectPath(0, 0, pW, pH, 0.02), maxDetail: 1, fill: "var(--cad-pocket)", stroke: "var(--cad-ground-stroke)", strokeWidth: 0.005 },
    // L1 silhouette — two pad outlines on top
    { layer: "metal", d: rectPath(0, padH * 1.0, padW, padH, 0.005), maxDetail: 1, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
    { layer: "metal", d: rectPath(0, -padH * 1.0, padW, padH, 0.005), maxDetail: 1, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

    // L3+ ground pocket
    { layer: "ground", d: rectPath(0, 0, pW, pH, 0.02), minDetail: 2, fill: "var(--cad-pocket)" },
    // L2+ etched halo around pads
    { layer: "ground", d: rectPath(0, 0, padW + 0.05, padH * 2 + padGap + 0.05, 0.01), fill: "var(--cad-gap)", minDetail: 2 },
    // L2+ two capacitor pads — light blue islands
    { layer: "metal", d: rectPath(0, yTop, padW, padH, 0.005), minDetail: 2, maxDetail: 4, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
    { layer: "metal", d: rectPath(0, yBot, padW, padH, 0.005), minDetail: 2, maxDetail: 4, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

    // L3+ 4-port symmetric coupling claws inside pocket
    // Bottom coupler (readout - horizontal finger + vertical lead)
    { layer: "metal", d: rectPath(0, yClawBot, padW * 0.7, fingerW_claw, 0.002), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", minDetail: 3 },
    { layer: "metal", d: rectPath(0, (yClawBot - fingerW_claw / 2 - pH / 2) / 2, leadW, Math.abs(-pH / 2 - (yClawBot - fingerW_claw / 2)), 0.001), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", minDetail: 3 },

    // Top coupler (bus_top - horizontal finger + vertical lead)
    { layer: "metal", d: rectPath(0, yClawTop, padW * 0.7, fingerW_claw, 0.002), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", minDetail: 3 },
    { layer: "metal", d: rectPath(0, (yClawTop + fingerW_claw / 2 + pH / 2) / 2, leadW, Math.abs(pH / 2 - (yClawTop + fingerW_claw / 2)), 0.001), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", minDetail: 3 },

    // Left coupler (bus_left - vertical finger + horizontal lead)
    { layer: "metal", d: rectPath(xClawLeft, yTop, fingerW_claw, fingerH_claw, 0.002), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", minDetail: 3 },
    { layer: "metal", d: rectPath((xClawLeft - fingerW_claw / 2 - pW / 2) / 2, yTop, Math.abs(-pW / 2 - (xClawLeft - fingerW_claw / 2)), leadW, 0.001), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", minDetail: 3 },

    // Right coupler (bus_right - vertical finger + horizontal lead)
    { layer: "metal", d: rectPath(xClawRight, yTop, fingerW_claw, fingerH_claw, 0.002), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", minDetail: 3 },
    { layer: "metal", d: rectPath((xClawRight + fingerW_claw / 2 + pW / 2) / 2, yTop, Math.abs(pW / 2 - (xClawRight + fingerW_claw / 2)), leadW, 0.001), fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)", minDetail: 3 },

    // L4 JJ bridge + junction
    { layer: "junction", d: rectPath(0, 0, 0.003, padGap), minDetail: 4, fill: "var(--cad-qubit-junction)" },
    { layer: "junction", d: rectPath(0, 0, 0.008, 0.004), minDetail: 4, fill: "var(--cad-junction)" },
  ];

  const pins: ComponentGeometry["pins"] = [
    { name: "readout", x: 0, y: -pH / 2, angle: -Math.PI / 2 },
    { name: "bus_top", x: 0, y: pH / 2, angle: Math.PI / 2 },
    { name: "bus_left", x: -pW / 2, y: yTop, angle: Math.PI },
    { name: "bus_right", x: pW / 2, y: yTop, angle: 0 },
  ];

  if (cl) {
    // Charge line — CPW trace ending near the lower pad
    const xEnd = -padW / 2 - 0.02;
    const xStart = -pW / 2 + 0.02;
    const yCL = (yBot + yTop) / 2 - padH;
    // L3+ ground cutout
    shapes.push({
      layer: "ground",
      d: rectPath((xStart + xEnd) / 2, yCL, Math.abs(xEnd - xStart), clTW + 2 * clG),
      fill: "var(--cad-gap)",
      minDetail: 3,
    });
    // L2+ metal trace
    shapes.push({
      layer: "metal",
      d: rectPath((xStart + xEnd) / 2, yCL, Math.abs(xEnd - xStart), clTW),
      fill: "var(--cad-trace)",
      minDetail: 2,
    });
    // Update charge line pin to pocket edge for routing connection
    pins.push({ name: "charge_line", x: -pW / 2, y: yCL, angle: Math.PI });
  }

  const annotations: Annotation[] = [
    { x: 0, y: -pH / 2 - 0.02, text: `${fmt(pW)} × ${fmt(pH)}`, anchor: "middle" },
    { x: 0, y: yTop + padH / 2 + 0.012, text: `pad ${fmt(padW)}×${fmt(padH)}`, anchor: "middle" },
    { x: padW / 2 + 0.02, y: 0, text: `JJ ${fmt(jjGap)}`, anchor: "start" },
  ];

  return {
    shapes,
    pins,
    bbox: { x: -pW / 2, y: -pH / 2, w: pW, h: pH },
    annotations,
  };
}
