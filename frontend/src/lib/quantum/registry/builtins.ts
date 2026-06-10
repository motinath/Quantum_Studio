/** Built-in component registrations. Imported once on app boot. */
import { registerComponent, type ComponentDef } from "./registry";
import { transmonCross, type TransmonCrossParams } from "../geometry/transmon-cross";
import { transmonPocket, type TransmonPocketParams } from "../geometry/transmon-pocket";
import { transmonConcentric, type TransmonConcentricParams } from "../geometry/transmon-concentric";
import { meanderResonator, type MeanderResonatorParams } from "../geometry/resonator-meander";
import { routeCPW, type RouteParams } from "../geometry/route";
import { launchpad, type LaunchpadParams } from "../geometry/launchpad";
import { capCoupler, type CapCouplerParams } from "../geometry/coupler";
import { openToGround, shortToGround } from "../geometry/terminations";
import type { Pt } from "../geometry/cpw";

const fmt = (n: number) => n.toFixed(4).replace(/\.?0+$/, "");

const defs: ComponentDef[] = [
  {
    kind: "transmon-cross",
    category: "Qubits",
    label: "Transmon Cross",
    description: "Cross-shaped capacitor transmon with 4 coupler arms",
    defaults: { armLength: 0.24, armWidth: 0.04, pocket: 0.55, gap: 0.020, clawSize: 0.06, clawWidth: 0.018, jjGap: 0.012 } as Record<string, unknown>,
    fields: [
      { key: "armLength", label: "Arm length", type: "number", unit: "mm", min: 0.05, max: 0.6, step: 0.005 },
      { key: "armWidth", label: "Arm width", type: "number", unit: "mm", min: 0.01, max: 0.1, step: 0.005 },
      { key: "pocket", label: "Pocket size", type: "number", unit: "mm", min: 0.2, max: 1.5, step: 0.02 },
      { key: "gap", label: "Etch gap", type: "number", unit: "mm", min: 0.005, max: 0.05, step: 0.001 },
      { key: "clawSize", label: "Claw length", type: "number", unit: "mm", min: 0.02, max: 0.2, step: 0.005 },
      { key: "clawWidth", label: "Claw width", type: "number", unit: "mm", min: 0.005, max: 0.05, step: 0.001 },
      { key: "jjGap", label: "JJ gap", type: "number", unit: "mm", min: 0.004, max: 0.03, step: 0.001 },
    ],
    geometry: (p) => transmonCross(p as TransmonCrossParams),
    codegen: (i) => [
      `TransmonCross(design, "${i.name}", options=dict(`,
      `    pos_x="${fmt(i.placement.x)}mm", pos_y="${fmt(i.placement.y)}mm",`,
      `    orientation="${i.placement.rotation}",`,
      `    cross_length="${fmt((i.params.armLength as number) ?? 0.24)}mm",`,
      `    cross_width="${fmt((i.params.armWidth as number) ?? 0.04)}mm",`,
      `))`,
    ],
  },
  {
    kind: "transmon-pocket",
    category: "Qubits",
    label: "Transmon Pocket",
    description: "Rectangular pocket transmon with two capacitor islands",
    defaults: { pocketW: 0.65, pocketH: 0.45, padW: 0.45, padH: 0.085 } as Record<string, unknown>,
    fields: [
      { key: "pocketW", label: "Pocket W", type: "number", unit: "mm", min: 0.3, max: 1.5, step: 0.05 },
      { key: "pocketH", label: "Pocket H", type: "number", unit: "mm", min: 0.2, max: 1.0, step: 0.05 },
      { key: "padW", label: "Pad width", type: "number", unit: "mm", min: 0.1, max: 1.0, step: 0.01 },
      { key: "padH", label: "Pad height", type: "number", unit: "mm", min: 0.03, max: 0.3, step: 0.005 },
    ],
    geometry: (p) => transmonPocket(p as TransmonPocketParams),
    codegen: (i) => [
      `TransmonPocket(design, "${i.name}", options=dict(`,
      `    pos_x="${fmt(i.placement.x)}mm", pos_y="${fmt(i.placement.y)}mm",`,
      `    orientation="${i.placement.rotation}",`,
      `))`,
    ],
  },
  {
    kind: "transmon-pocket-cl",
    category: "Qubits",
    label: "Transmon Pocket CL",
    description: "Transmon pocket with charge line",
    defaults: { pocketW: 0.7, pocketH: 0.5, padW: 0.5, padH: 0.09, hasChargeLine: true } as Record<string, unknown>,
    fields: [
      { key: "pocketW", label: "Pocket W", type: "number", unit: "mm", min: 0.3, max: 1.5, step: 0.05 },
      { key: "pocketH", label: "Pocket H", type: "number", unit: "mm", min: 0.2, max: 1.0, step: 0.05 },
    ],
    geometry: (p) => transmonPocket({ ...(p as TransmonPocketParams), hasChargeLine: true }),
    codegen: (i) => [
      `TransmonPocketCL(design, "${i.name}", options=dict(`,
      `    pos_x="${fmt(i.placement.x)}mm", pos_y="${fmt(i.placement.y)}mm",`,
      `))`,
    ],
  },
  {
    kind: "transmon-concentric",
    category: "Qubits",
    label: "Transmon Concentric",
    description: "Concentric ring-and-disk transmon",
    defaults: { innerR: 0.06, ringR: 0.18, ringW: 0.04 } as Record<string, unknown>,
    fields: [
      { key: "innerR", label: "Inner radius", type: "number", unit: "mm", min: 0.01, max: 0.3, step: 0.005 },
      { key: "ringR", label: "Ring radius", type: "number", unit: "mm", min: 0.05, max: 0.5, step: 0.005 },
      { key: "ringW", label: "Ring width", type: "number", unit: "mm", min: 0.01, max: 0.1, step: 0.005 },
    ],
    geometry: (p) => transmonConcentric(p as TransmonConcentricParams),
    codegen: (i) => [
      `TransmonConcentric(design, "${i.name}", options=dict(`,
      `    pos_x="${fmt(i.placement.x)}mm", pos_y="${fmt(i.placement.y)}mm",`,
      `))`,
    ],
  },
  {
    kind: "meander-resonator",
    category: "Resonators",
    label: "Readout Resonator (λ/4)",
    description: "Blue λ/4 CPW readout meander with coupling pad",
    defaults: { length: 3.2, turns: 8, amplitude: 0.30, traceWidth: 0.028, gap: 0.014, fillet: 0.09, axis: "horizontal", autoTurns: true, pitch: 0.32, couplingPad: true, variant: "readout" } as Record<string, unknown>,
    fields: [
      { key: "length", label: "Span length", type: "number", unit: "mm", min: 0.5, max: 6, step: 0.05 },
      { key: "turns", label: "Turns", type: "number", min: 1, max: 20, step: 1 },
      { key: "amplitude", label: "Amplitude", type: "number", unit: "mm", min: 0.05, max: 0.5, step: 0.005 },
      { key: "traceWidth", label: "Trace W", type: "number", unit: "mm", min: 0.004, max: 0.04, step: 0.001 },
      { key: "gap", label: "Gap", type: "number", unit: "mm", min: 0.002, max: 0.03, step: 0.001 },
      { key: "fillet", label: "Fillet", type: "number", unit: "mm", min: 0.01, max: 0.2, step: 0.005 },
      { key: "autoTurns", label: "Auto turns from length", type: "boolean" },
      { key: "pitch", label: "Pitch (auto)", type: "number", unit: "mm", min: 0.1, max: 0.8, step: 0.01 },
      { key: "axis", label: "Axis", type: "select", options: [
        { value: "horizontal", label: "Horizontal" }, { value: "vertical", label: "Vertical" } ] },
    ],
    geometry: (p) => meanderResonator({ ...(p as MeanderResonatorParams), variant: "readout" }),
    codegen: (i) => [
      `RouteMeander(design, "${i.name}", options=dict(`,
      `    total_length="${fmt((i.params.length as number) ?? 2.4 * 1.5)}mm",`,
      `    pin_inputs=dict(start_pin=dict(component="", pin=""), end_pin=dict(component="", pin="")),`,
      `))`,
    ],
  },
  {
    kind: "bus-resonator",
    category: "Resonators",
    label: "Bus Resonator (λ/2)",
    description: "Teal CPW bus resonator coupling two qubits",
    defaults: { length: 2.4, turns: 6, amplitude: 0.22, traceWidth: 0.028, gap: 0.014, fillet: 0.09, axis: "horizontal", autoTurns: true, pitch: 0.32, couplingPad: true, variant: "bus" } as Record<string, unknown>,
    fields: [
      { key: "length", label: "Span length", type: "number", unit: "mm", min: 0.5, max: 6, step: 0.05 },
      { key: "amplitude", label: "Amplitude", type: "number", unit: "mm", min: 0.05, max: 0.5, step: 0.005 },
      { key: "traceWidth", label: "Trace W", type: "number", unit: "mm", min: 0.004, max: 0.04, step: 0.001 },
      { key: "gap", label: "Gap", type: "number", unit: "mm", min: 0.002, max: 0.03, step: 0.001 },
      { key: "axis", label: "Axis", type: "select", options: [
        { value: "horizontal", label: "Horizontal" }, { value: "vertical", label: "Vertical" } ] },
    ],
    geometry: (p) => meanderResonator({ ...(p as MeanderResonatorParams), variant: "bus" }),
    codegen: (i) => [
      `RouteMeander(design, "${i.name}_bus", options=dict(total_length="${fmt((i.params.length as number) ?? 2.4)}mm"))`,
    ],
  },
  {
    kind: "route-straight",
    category: "Routing",
    label: "Route Straight",
    description: "Straight CPW route between two waypoints",
    defaults: { waypoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }] satisfies Pt[] },
    fields: [],
    geometry: (p) => routeCPW(p as unknown as RouteParams),
    codegen: (i) => [`RouteStraight(design, "${i.name}", options=dict())`],
  },
  {
    kind: "feedline",
    category: "Routing",
    label: "Readout Feedline",
    description: "Shared dark-gray CPW feedline between launchpads",
    defaults: { waypoints: [{ x: -3, y: 0 }, { x: 3, y: 0 }] satisfies Pt[], variant: "feedline", traceWidth: 0.028, gap: 0.014 } as Record<string, unknown>,
    fields: [
      { key: "traceWidth", label: "Trace W", type: "number", unit: "mm", min: 0.01, max: 0.06, step: 0.001 },
      { key: "gap", label: "Gap", type: "number", unit: "mm", min: 0.004, max: 0.03, step: 0.001 },
    ],
    geometry: (p) => routeCPW({ ...(p as unknown as RouteParams), variant: "feedline" }),
    codegen: (i) => [`RouteStraight(design, "${i.name}_feedline", options=dict())`],
  },
  {
    kind: "route-meander",
    category: "Routing",
    label: "Route Meander",
    description: "Length-matched meandering CPW route",
    defaults: { waypoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }] satisfies Pt[], meander: true, meanderTurns: 4, meanderAmp: 0.15 },
    fields: [
      { key: "meanderTurns", label: "Turns", type: "number", min: 1, max: 12, step: 1 },
      { key: "meanderAmp", label: "Amplitude", type: "number", unit: "mm", min: 0.05, max: 0.4, step: 0.01 },
    ],
    geometry: (p) => routeCPW({ ...(p as unknown as RouteParams), meander: true }),
    codegen: (i) => [`RouteMeander(design, "${i.name}", options=dict())`],
  },
  {
    kind: "launchpad-wirebond",
    category: "IO",
    label: "Launch Pad",
    description: "Wirebond launch pad with CPW transition",
    defaults: { padW: 0.32, padH: 0.32, taperLen: 0.18, traceWidth: 0.020, gap: 0.010, stubLen: 0.08 } as Record<string, unknown>,
    fields: [
      { key: "padW", label: "Pad W", type: "number", unit: "mm", min: 0.1, max: 0.5, step: 0.01 },
      { key: "padH", label: "Pad H", type: "number", unit: "mm", min: 0.1, max: 0.5, step: 0.01 },
      { key: "taperLen", label: "Taper", type: "number", unit: "mm", min: 0.05, max: 0.4, step: 0.01 },
      { key: "traceWidth", label: "Trace W", type: "number", unit: "mm", min: 0.004, max: 0.04, step: 0.001 },
      { key: "gap", label: "Gap", type: "number", unit: "mm", min: 0.002, max: 0.03, step: 0.001 },
    ],
    geometry: (p) => launchpad(p as LaunchpadParams),
    codegen: (i) => [
      `LaunchpadWirebond(design, "${i.name}", options=dict(`,
      `    pos_x="${fmt(i.placement.x)}mm", pos_y="${fmt(i.placement.y)}mm",`,
      `    orientation="${i.placement.rotation}",`,
      `))`,
    ],
  },
  {
    kind: "coupler-capacitive",
    category: "Couplers",
    label: "Capacitive Coupler",
    description: "Two facing finger pads with a coupling gap",
    defaults: { fingerLen: 0.12, fingerW: 0.030, gap: 0.008 } as Record<string, unknown>,
    fields: [
      { key: "fingerLen", label: "Finger length", type: "number", unit: "mm", min: 0.02, max: 0.3, step: 0.005 },
      { key: "fingerW", label: "Finger width", type: "number", unit: "mm", min: 0.005, max: 0.1, step: 0.001 },
      { key: "gap", label: "Coupling gap", type: "number", unit: "mm", min: 0.001, max: 0.05, step: 0.001 },
    ],
    geometry: (p) => capCoupler(p as CapCouplerParams),
    codegen: (i) => [`CapacitiveCoupler(design, "${i.name}", options=dict())`],
  },
  {
    kind: "open-to-ground",
    category: "Terminations",
    label: "Open to Ground",
    description: "CPW open termination",
    defaults: {},
    fields: [],
    geometry: () => openToGround(),
    codegen: (i) => [`OpenToGround(design, "${i.name}", options=dict())`],
  },
  {
    kind: "short-to-ground",
    category: "Terminations",
    label: "Short to Ground",
    description: "CPW short termination",
    defaults: {},
    fields: [],
    geometry: () => shortToGround(),
    codegen: (i) => [`ShortToGround(design, "${i.name}", options=dict())`],
  },
];

let bootstrapped = false;
export function bootstrapRegistry() {
  if (bootstrapped) return;
  for (const def of defs) registerComponent(def);
  bootstrapped = true;
}
