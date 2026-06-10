/**
 * CPW terminations.
 *   L1: small silhouette
 *   L2+: actual termination geometry
 *   L4: pin marker + label
 */
import { rectPath, type ComponentGeometry } from "./types";

export function openToGround(): ComponentGeometry {
  return {
    shapes: [
      { layer: "ground", d: rectPath(0.012, 0, 0.04, 0.04), maxDetail: 1, fill: "var(--cad-gap)" },
      { layer: "ground", d: rectPath(0.012, 0, 0.04, 0.04), fill: "var(--cad-gap)", minDetail: 2 },
    ],
    pins: [{ name: "tie", x: 0, y: 0, angle: Math.PI }],
    bbox: { x: -0.008, y: -0.02, w: 0.04, h: 0.04 },
    annotations: [{ x: 0.012, y: 0.03, text: "open", anchor: "middle" }],
  };
}

export function shortToGround(): ComponentGeometry {
  return {
    shapes: [
      { layer: "metal", d: rectPath(0.012, 0, 0.04, 0.04), maxDetail: 1, fill: "var(--cad-metal)" },
      { layer: "ground", d: rectPath(0.012, 0, 0.04, 0.04), fill: "var(--cad-gap)", minDetail: 2 },
      { layer: "metal", d: rectPath(0.012, 0, 0.024, 0.024), fill: "var(--cad-trace)", minDetail: 2 },
    ],
    pins: [{ name: "tie", x: 0, y: 0, angle: Math.PI }],
    bbox: { x: -0.008, y: -0.02, w: 0.04, h: 0.04 },
    annotations: [{ x: 0.012, y: 0.03, text: "short", anchor: "middle" }],
  };
}
