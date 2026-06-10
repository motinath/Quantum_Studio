/** Derive a netlist of pin-to-pin edges from a document. */
import type { ChipDocument } from "./document";

export interface NetlistRow {
  netId: string;
  from: string;  // "Q1.east"
  to: string;    // "Resonator_01.coupler"
}

export function buildNetlist(doc: ChipDocument): NetlistRow[] {
  const byId = new Map(doc.components.map(c => [c.id, c]));
  return doc.nets.map((n, i) => ({
    netId: `net_${i + 1}`,
    from: `${byId.get(n.from.component)?.name ?? "?"}.${n.from.pin}`,
    to: `${byId.get(n.to.component)?.name ?? "?"}.${n.to.pin}`,
  }));
}
