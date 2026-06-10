import { circlePath, rectPath, type ComponentGeometry, type Annotation } from "./types";

function annularSectorPath(cx: number, cy: number, r1: number, r2: number, startAngle: number, endAngle: number): string {
  const x1_inner = cx + r1 * Math.cos(startAngle);
  const y1_inner = cy + r1 * Math.sin(startAngle);
  const x2_inner = cx + r1 * Math.cos(endAngle);
  const y2_inner = cy + r1 * Math.sin(endAngle);
  const x1_outer = cx + r2 * Math.cos(startAngle);
  const y1_outer = cy + r2 * Math.sin(startAngle);
  const x2_outer = cx + r2 * Math.cos(endAngle);
  const y2_outer = cy + r2 * Math.sin(endAngle);
  
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const sweepInner = endAngle > startAngle ? 1 : 0;
  const sweepOuter = endAngle > startAngle ? 0 : 1;
  
  return `M ${x1_inner} ${y1_inner} ` +
         `A ${r1} ${r1} 0 ${largeArc} ${sweepInner} ${x2_inner} ${y2_inner} ` +
         `L ${x2_outer} ${y2_outer} ` +
         `A ${r2} ${r2} 0 ${largeArc} ${sweepOuter} ${x1_outer} ${y1_outer} Z`;
}

export interface TransmonConcentricParams {
  innerR?: number;
  ringR?: number;
  ringW?: number;
  pocket?: number;
  fingerLen?: number;
  fingerW?: number;
}

export function transmonConcentric(p: TransmonConcentricParams = {}): ComponentGeometry {
  const innerR = p.innerR ?? 0.06;
  const ringR = p.ringR ?? 0.18;
  const ringW = p.ringW ?? 0.04;
  const pocket = p.pocket ?? 0.5;
  const fingerW = p.fingerW ?? 0.018;
  const fmt = (v: number) => `${(v * 1000).toFixed(0)}µm`;

  const clawR1 = ringR + 0.015;
  const clawR2 = clawR1 + fingerW;
  const span = 0.26; // ~15 degrees half-span

  const jjCtrY = innerR + (ringR - ringW - innerR) / 2;
  const jjGapLen = ringR - ringW - innerR;

  return {
    shapes: [
      // L1 silhouette
      { layer: "metal", d: circlePath(0, 0, ringR), maxDetail: 1, fill: "var(--cad-qubit-pad)" },

      // L3+ pocket
      { layer: "ground", d: rectPath(0, 0, pocket, pocket, 0.04), minDetail: 3, fill: "var(--cad-pocket)" },
      // L2+ etched halo around ring
      { layer: "ground", d: circlePath(0, 0, ringR + 0.02), fill: "var(--cad-gap)", minDetail: 2 },
      // L2+ outer ring
      { layer: "metal", d: circlePath(0, 0, ringR), minDetail: 2, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: circlePath(0, 0, ringR - ringW), fill: "var(--cad-gap)", minDetail: 2 },
      // L2+ inner disk
      { layer: "metal", d: circlePath(0, 0, innerR), minDetail: 2, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

      // L3+ radial coupling fingers (conformal sectors + radial leads)
      // East claw
      { layer: "metal", d: annularSectorPath(0, 0, clawR1, clawR2, -span, span), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath((clawR2 + pocket / 2) / 2, 0, pocket / 2 - clawR2, fingerW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      // West claw
      { layer: "metal", d: annularSectorPath(0, 0, clawR1, clawR2, Math.PI - span, Math.PI + span), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(-(clawR2 + pocket / 2) / 2, 0, pocket / 2 - clawR2, fingerW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      // North claw
      { layer: "metal", d: annularSectorPath(0, 0, clawR1, clawR2, Math.PI / 2 - span, Math.PI / 2 + span), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(0, (clawR2 + pocket / 2) / 2, fingerW, pocket / 2 - clawR2), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      // South claw
      { layer: "metal", d: annularSectorPath(0, 0, clawR1, clawR2, -Math.PI / 2 - span, -Math.PI / 2 + span), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(0, -(clawR2 + pocket / 2) / 2, fingerW, pocket / 2 - clawR2), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

      // L4 JJ bridge + junction
      { layer: "junction", d: rectPath(0, jjCtrY, 0.003, jjGapLen), minDetail: 4, fill: "var(--cad-qubit-junction)" },
      { layer: "junction", d: rectPath(0, jjCtrY, 0.008, 0.004), minDetail: 4, fill: "var(--cad-junction)" },
    ],
    pins: [
      { name: "east", x: pocket / 2, y: 0, angle: 0 },
      { name: "west", x: -pocket / 2, y: 0, angle: Math.PI },
      { name: "north", x: 0, y: pocket / 2, angle: Math.PI / 2 },
      { name: "south", x: 0, y: -pocket / 2, angle: -Math.PI / 2 },
    ],
    bbox: { x: -pocket / 2, y: -pocket / 2, w: pocket, h: pocket },
    annotations: [
      { x: 0, y: -pocket / 2 - 0.02, text: `R=${fmt(ringR)}`, anchor: "middle" },
      { x: ringR + 0.01, y: 0, text: `w=${fmt(ringW)}`, anchor: "start" },
    ],
  };
}
