/** Level-of-detail helpers driven by canvas zoom (px per mm). */
import type { Detail, Shape, Annotation } from "./types";

export function lodForZoom(zoom: number): Detail {
  if (zoom <= 60) return 1;     // chip overview
  if (zoom <= 200) return 2;    // component / pads visible
  if (zoom <= 800) return 3;    // device-level: pockets, claws, fillets
  return 4;                     // fabrication: JJ, pins, dimensions
}

export function lodLabel(d: Detail): string {
  return ({ 1: "L1 Chip", 2: "L2 Component", 3: "L3 Device", 4: "L4 Fab" } as const)[d];
}

export function shapeVisible(s: Shape, lod: Detail): boolean {
  const lo = s.minDetail ?? 1;
  const hi = s.maxDetail ?? 4;
  return lod >= lo && lod <= hi;
}

export function annotationVisible(a: Annotation, lod: Detail): boolean {
  return lod >= (a.minDetail ?? 4);
}
