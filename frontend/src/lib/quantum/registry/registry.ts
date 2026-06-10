/** Component Registry — single place every kind is defined. */
import type { ComponentGeometry } from "../geometry/types";
import type { ComponentInstance } from "../model/document";

export interface ComponentDef {
  kind: string;
  category: "Qubits" | "Resonators" | "Routing" | "Couplers" | "IO" | "Terminations";
  label: string;
  description: string;
  /** Default params for a fresh instance */
  defaults: Record<string, unknown>;
  /** Param schema for the inspector — light, hand-rolled. */
  fields: ParamField[];
  /** Build geometry from params (in local coordinates, origin at component center). */
  geometry: (params: Record<string, unknown>) => ComponentGeometry;
  /** Python codegen — return one or more lines. */
  codegen: (inst: ComponentInstance) => string[];
}

export type ParamField =
  | { key: string; label: string; type: "number"; unit?: string; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "boolean" };

const registry = new Map<string, ComponentDef>();

export function registerComponent(def: ComponentDef) {
  registry.set(def.kind, def);
}

export function getComponent(kind: string): ComponentDef | undefined {
  return registry.get(kind);
}

export function listComponents(): ComponentDef[] {
  return Array.from(registry.values());
}

export function listByCategory(): Record<string, ComponentDef[]> {
  const out: Record<string, ComponentDef[]> = {};
  for (const def of registry.values()) {
    (out[def.category] ??= []).push(def);
  }
  return out;
}
