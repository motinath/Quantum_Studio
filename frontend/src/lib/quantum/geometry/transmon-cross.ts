/**
 * TransmonCross — cross-shaped capacitor with 4 coupler arms.
 *
 * LOD reveal:
 *   L1: simplified cross silhouette
 *   L2: actual cross metal pads + outer etch gap
 *   L3: ground pocket + claw couplers at each arm tip + JJ slit
 *   L4: explicit JJ rect + pin markers + dimension annotations
 */
import { circlePath, rectPath, type ComponentGeometry, type Annotation } from "./types";

export interface TransmonCrossParams {
  armLength?: number;   // mm, center→tip
  armWidth?: number;    // mm
  pocket?: number;      // mm, ground pocket size
  jjGap?: number;       // mm
  gap?: number;         // mm, etch gap around metal
  clawSize?: number;    // mm, coupler claw length at each tip
  clawWidth?: number;   // mm, coupler claw thickness
}

export function transmonCross(p: TransmonCrossParams = {}): ComponentGeometry {
  const armLen = p.armLength ?? 0.24;
  const armW = p.armWidth ?? 0.04;
  const pocket = p.pocket ?? 0.55;
  const jjGap = p.jjGap ?? 0.012;
  const gap = p.gap ?? 0.020;
  const clawSize = p.clawSize ?? 0.06;
  const clawW = p.clawWidth ?? 0.018;

  const totalLen = armLen * 2;
  const outer = totalLen + gap * 2;
  const outerW = armW + gap * 2;

  // Claw sits just outside each arm tip, separated by `gap`
  const clawY = armW / 2 + gap + clawW / 2;
  const clawOffset = armLen + gap;

  const fmt = (v: number) => `${(v * 1000).toFixed(0)}µm`;

  const annotations: Annotation[] = [
    { x: 0, y: -pocket / 2 - 0.02, text: `pocket ${fmt(pocket)}`, anchor: "middle" },
    { x: armLen * 0.5, y: armW / 2 + 0.012, text: `L=${fmt(armLen)}`, anchor: "middle" },
    { x: armW / 2 + gap + 0.005, y: -armLen + 0.02, text: `g=${fmt(gap)}`, anchor: "start" },
  ];

  // South junction details connecting South arm tip (-armLen) to pocket boundary (-pocket/2)
  const jjGapLength = pocket / 2 - armLen;
  const jjY = -(armLen + pocket / 2) / 2;

  return {
    shapes: [
      // L1 silhouette — gray pocket square (visible at all LODs as context)
      { layer: "ground", d: rectPath(0, 0, pocket, pocket, 0.03), maxDetail: 1, fill: "var(--cad-pocket)", stroke: "var(--cad-ground-stroke)", strokeWidth: 0.005 },

      // L1 silhouette — light blue cross with dark outline (matches Qiskit Metal overview)
      { layer: "metal", d: rectPath(0, 0, totalLen, armW), maxDetail: 1, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(0, 0, armW, totalLen), maxDetail: 1, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

      // L3+ ground pocket (gray) — replaces the L1 version at higher zoom
      { layer: "ground", d: rectPath(0, 0, pocket, pocket, 0.03), minDetail: 2, fill: "var(--cad-pocket)" },

      // L2+ etched cross gap (the halo around the metal)
      { layer: "ground", d: rectPath(0, 0, outer, outerW), fill: "var(--cad-gap)", minDetail: 2 },
      { layer: "ground", d: rectPath(0, 0, outerW, outer), fill: "var(--cad-gap)", minDetail: 2 },

      // L2+ cross metal — light blue pads
      { layer: "metal", d: rectPath(0, 0, totalLen, armW), minDetail: 2, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(0, 0, armW, totalLen), minDetail: 2, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

      // L3+ conformal U-shaped claws at each tip
      // East (facing +x)
      { layer: "metal", d: rectPath(clawOffset + clawW / 2, 0, clawW, clawY * 2 + clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(clawOffset - (clawSize - clawW) / 2 + clawW, clawY, clawSize - clawW, clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(clawOffset - (clawSize - clawW) / 2 + clawW, -clawY, clawSize - clawW, clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

      // West (facing -x)
      { layer: "metal", d: rectPath(-(clawOffset + clawW / 2), 0, clawW, clawY * 2 + clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(-(clawOffset - (clawSize - clawW) / 2 + clawW), clawY, clawSize - clawW, clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(-(clawOffset - (clawSize - clawW) / 2 + clawW), -clawY, clawSize - clawW, clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

      // North (facing +y)
      { layer: "metal", d: rectPath(0, clawOffset + clawW / 2, clawY * 2 + clawW, clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(clawY, clawOffset - (clawSize - clawW) / 2 + clawW, clawW, clawSize - clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(-clawY, clawOffset - (clawSize - clawW) / 2 + clawW, clawW, clawSize - clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

      // South (facing -y)
      { layer: "metal", d: rectPath(0, -(clawOffset + clawW / 2), clawY * 2 + clawW, clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(clawY, -(clawOffset - (clawSize - clawW) / 2 + clawW), clawW, clawSize - clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },
      { layer: "metal", d: rectPath(-clawY, -(clawOffset - (clawSize - clawW) / 2 + clawW), clawW, clawSize - clawW), minDetail: 3, fill: "var(--cad-qubit-pad)", stroke: "var(--cad-qubit-pad-stroke)" },

      // L4 JJ — realistic bridge + junction dot at South tip gap
      { layer: "junction", d: rectPath(0, jjY, 0.003, jjGapLength), minDetail: 4, fill: "var(--cad-qubit-junction)" },
      { layer: "junction", d: rectPath(0, jjY, 0.008, 0.004), minDetail: 4, fill: "var(--cad-junction)" },
    ],
    pins: [
      { name: "north", x: 0, y: clawOffset + clawW, angle: Math.PI / 2 },
      { name: "south", x: 0, y: -(clawOffset + clawW), angle: -Math.PI / 2 },
      { name: "east", x: clawOffset + clawW, y: 0, angle: 0 },
      { name: "west", x: -(clawOffset + clawW), y: 0, angle: Math.PI },
    ],
    bbox: { x: -pocket / 2, y: -pocket / 2, w: pocket, h: pocket },
    annotations,
  };
}
