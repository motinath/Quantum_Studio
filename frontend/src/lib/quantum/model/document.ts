/** Document model — single source of truth for the editor. */
import type { Pt } from "../geometry/cpw";

export interface ComponentInstance {
  id: string;
  kind: string;            // matches a registry key
  name: string;
  /** Placement in mm. Routes ignore this and read waypoints from params. */
  placement: { x: number; y: number; rotation: number };
  params: Record<string, unknown>;
}

export interface NetEdge {
  from: { component: string; pin: string };
  to: { component: string; pin: string };
}

export interface LayerState {
  id: "metal" | "ground" | "junction" | "routes" | "pins" | "measurements" | "verification";
  label: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export const DEFAULT_LAYERS: LayerState[] = [
  { id: "ground", label: "Ground", visible: true, locked: false, opacity: 1 },
  { id: "routes", label: "Routes", visible: true, locked: false, opacity: 1 },
  { id: "metal", label: "Metal", visible: true, locked: false, opacity: 1 },
  { id: "junction", label: "Junctions", visible: true, locked: false, opacity: 1 },
  { id: "pins", label: "Pins", visible: true, locked: false, opacity: 1 },
  { id: "measurements", label: "Measurements", visible: true, locked: false, opacity: 1 },
  { id: "verification", label: "Verification", visible: true, locked: false, opacity: 1 },
];

export interface ChipDocument {
  id: string;
  name: string;
  units: "mm";
  chipSize: { w: number; h: number };
  components: ComponentInstance[];
  nets: NetEdge[];
  layers: LayerState[];
  dirty: boolean;
  savedAt: number | null;
  createdAt: number;
}

export function newDocument(name: string): ChipDocument {
  return {
    id: crypto.randomUUID(),
    name,
    units: "mm",
    chipSize: { w: 8, h: 6 },
    components: [],
    nets: [],
    layers: DEFAULT_LAYERS.map(l => ({ ...l })),
    dirty: false,
    savedAt: null,
    createdAt: Date.now(),
  };
}

export const nextName = (kind: string, existing: ComponentInstance[]) => {
  const prefix = kind.replace(/-/g, "_").toUpperCase();
  let n = 1;
  const taken = new Set(existing.map(c => c.name));
  while (taken.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
};

// Re-export Pt for convenience
export type { Pt };
