import type { GenerateResponse, PlacementEdge, PlacementQubit } from "@/lib/api/backend";

// ---------- Types ----------

export type ComponentKind =
  | "TransmonPocket"
  | "TransmonCross"
  | "ResonatorCoilRect"
  | "OpenToGround"
  | "CPWWaveguide"
  | "CPWStraightHybrid"
  | "LaunchpadWirebond"
  | "ShortToGround"
  | "LumpedCapacitor"
  | "LumpedInductor"
  | "RectanglePlaceholder";

export type ComponentCategory =
  | "qubits"
  | "resonators"
  | "couplers"
  | "tlines"
  | "terminations"
  | "lumped"
  | "sample shapes";

export interface ComponentDef {
  type: ComponentKind;
  category: ComponentCategory;
  label: string;
  defaultParams: Record<string, string | number>;
  pins: string[];
  /** Default per-side size in mm */
  size: number;
}

export interface EditorComponent {
  id: string;
  type: ComponentKind;
  name: string;
  /** Position in mm (canvas world units) */
  x: number;
  y: number;
  orientation: 0 | 90 | 180 | 270;
  params: Record<string, string | number>;
}

export interface EditorConnection {
  id: string;
  fromComp: string;
  fromPin: string;
  toComp: string;
  toPin: string;
}

export interface EditorVariables {
  frequency_range: string;
  qubit_gap: number;
  coupling_strength: number;
  chip_size: number;
}

export interface EditorState {
  components: EditorComponent[];
  connections: EditorConnection[];
  variables: EditorVariables;
  selectedId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  /** Pending pin click for connection (component+pin) */
  pendingPin: { compId: string; pin: string } | null;
  past: Snapshot[];
  future: Snapshot[];
  /** Monotonic counter we increment on every mutating action so external syncers can debounce */
  rev: number;
}

interface Snapshot {
  components: EditorComponent[];
  connections: EditorConnection[];
  variables: EditorVariables;
}

// ---------- Library ----------

export const LIBRARY: Record<ComponentCategory, ComponentDef[]> = {
  qubits: [
    {
      type: "TransmonPocket",
      category: "qubits",
      label: "TransmonPocket",
      defaultParams: { pad_gap: "30um", pad_width: "455um", pad_height: "90um" },
      pins: ["a", "b"],
      size: 0.45,
    },
    {
      type: "TransmonCross",
      category: "qubits",
      label: "TransmonCross",
      defaultParams: { cross_width: "30um", cross_length: "240um", cross_gap: "20um" },
      pins: ["north", "south", "east", "west"],
      size: 0.5,
    },
  ],
  resonators: [
    {
      type: "ResonatorCoilRect",
      category: "resonators",
      label: "ResonatorCoilRect",
      defaultParams: { length: "7mm", width: "10um", gap: "6um" },
      pins: ["in", "out"],
      size: 0.6,
    },
    {
      type: "OpenToGround",
      category: "resonators",
      label: "OpenToGround",
      defaultParams: { width: "10um", gap: "6um" },
      pins: ["open"],
      size: 0.2,
    },
  ],
  couplers: [
    {
      type: "CPWWaveguide",
      category: "couplers",
      label: "CPWWaveguide",
      defaultParams: { width: "10um", gap: "6um" },
      pins: ["in", "out"],
      size: 0.4,
    },
  ],
  tlines: [
    {
      type: "CPWWaveguide",
      category: "tlines",
      label: "CPWWaveguide",
      defaultParams: { width: "10um", gap: "6um" },
      pins: ["in", "out"],
      size: 0.4,
    },
    {
      type: "CPWStraightHybrid",
      category: "tlines",
      label: "CPWStraightHybrid",
      defaultParams: { width: "10um", gap: "6um" },
      pins: ["in", "out"],
      size: 0.4,
    },
  ],
  terminations: [
    {
      type: "LaunchpadWirebond",
      category: "terminations",
      label: "LaunchpadWirebond",
      defaultParams: { pad_width: "200um", pad_height: "100um" },
      pins: ["tie"],
      size: 0.35,
    },
    {
      type: "ShortToGround",
      category: "terminations",
      label: "ShortToGround",
      defaultParams: { width: "10um" },
      pins: ["tie"],
      size: 0.2,
    },
  ],
  lumped: [
    {
      type: "LumpedCapacitor",
      category: "lumped",
      label: "LumpedCapacitor",
      defaultParams: { capacitance: "10fF" },
      pins: ["a", "b"],
      size: 0.25,
    },
    {
      type: "LumpedInductor",
      category: "lumped",
      label: "LumpedInductor",
      defaultParams: { inductance: "10nH" },
      pins: ["a", "b"],
      size: 0.25,
    },
  ],
  "sample shapes": [
    {
      type: "RectanglePlaceholder",
      category: "sample shapes",
      label: "RectanglePlaceholder",
      defaultParams: { width: "300um", height: "300um" },
      pins: [],
      size: 0.3,
    },
  ],
};

export function getDefForType(type: ComponentKind): ComponentDef {
  for (const cat of Object.values(LIBRARY)) {
    const found = cat.find((d) => d.type === type);
    if (found) return found;
  }
  // fallback
  return LIBRARY.qubits[0];
}

// ---------- Initial state ----------

export function emptyEditorState(): EditorState {
  return {
    components: [],
    connections: [],
    variables: {
      frequency_range: "4.5 - 5.5 GHz",
      qubit_gap: 2.0,
      coupling_strength: 0.05,
      chip_size: 10,
    },
    selectedId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    pendingPin: null,
    past: [],
    future: [],
    rev: 0,
  };
}

// ---------- Conversions ----------

export function fromGenerateResponse(result: GenerateResponse | null): EditorState {
  const state = emptyEditorState();
  if (!result) return state;

  const qubits = result.placement?.qubits ?? [];
  const components: EditorComponent[] = qubits.map((q) => ({
    id: `comp_${q.name}`,
    type: "TransmonPocket",
    name: q.name,
    x: q.x,
    y: q.y,
    orientation: 0,
    params: { ...getDefForType("TransmonPocket").defaultParams },
  }));

  const connections: EditorConnection[] = [];

  // Prefer backend topology edges; fall back to proximity only for legacy/client results.
  const placementEdges = result.placement?.edges ?? [];
  if (placementEdges.length > 0) {
    placementEdges.forEach((edge, idx) => {
      connections.push({
        id: `conn_${edge.qubit_a}_${edge.qubit_b}_${idx}`,
        fromComp: `comp_${edge.qubit_a}`,
        fromPin: edge.pin_a ?? "a",
        toComp: `comp_${edge.qubit_b}`,
        toPin: edge.pin_b ?? "b",
      });
    });
  } else {
    for (let i = 0; i < qubits.length; i++) {
      for (let j = i + 1; j < qubits.length; j++) {
        const q1 = qubits[i];
        const q2 = qubits[j];
        const dist = Math.hypot(q1.x - q2.x, q1.y - q2.y);
        if (dist < 2.5) {
          connections.push({
            id: `conn_${q1.name}_${q2.name}`,
            fromComp: `comp_${q1.name}`,
            fromPin: "a",
            toComp: `comp_${q2.name}`,
            toPin: "b",
          });
        }
      }
    }
  }

  // Add resonator components from frequency_plan
  const resonatorEntries = Object.entries(result.frequency_plan?.resonator_frequencies_GHz ?? {});
  resonatorEntries.forEach(([name], idx) => {
    const targetName = name.replace(/^RO_/, "");
    const target = qubits.find((q) => q.name === targetName);
    const angle = (idx / Math.max(1, resonatorEntries.length)) * Math.PI * 2;
    const x = target ? target.x + Math.cos(angle) * 0.65 : idx * 0.8;
    const y = target ? target.y + Math.sin(angle) * 0.65 : 1.0;
    components.push({
      id: `comp_${name}`,
      type: "ResonatorCoilRect",
      name,
      x,
      y,
      orientation: 0,
      params: { ...getDefForType("ResonatorCoilRect").defaultParams },
    });
    if (target) {
      connections.push({
        id: `conn_${target.name}_${name}`,
        fromComp: `comp_${target.name}`,
        fromPin: "readout",
        toComp: `comp_${name}`,
        toPin: "in",
      });
    }
  });

  return { ...state, components, connections };
}

export function toGenerateResponse(
  state: EditorState,
  prev: GenerateResponse | null,
): GenerateResponse {
  const qubitComps = state.components.filter(
    (c) => c.type === "TransmonPocket" || c.type === "TransmonCross",
  );
  const placementQubits: PlacementQubit[] = qubitComps.map((c) => ({
    name: c.name,
    x: parseFloat(c.x.toFixed(3)),
    y: parseFloat(c.y.toFixed(3)),
  }));

  const resonatorComps = state.components.filter((c) => c.type === "ResonatorCoilRect");
  const resonator_frequencies_GHz: Record<string, number> = {};
  const resonator_lengths_mm: Record<string, number> = {};
  resonatorComps.forEach((c, i) => {
    resonator_frequencies_GHz[c.name] =
      prev?.frequency_plan?.resonator_frequencies_GHz?.[c.name] ?? 6 + i * 0.05;
    resonator_lengths_mm[c.name] = prev?.frequency_plan?.resonator_lengths_mm?.[c.name] ?? 7.5;
  });

  const qubitIds = new Set(qubitComps.map((c) => c.id));
  const qubitNameById = new Map(qubitComps.map((c) => [c.id, c.name]));
  const edgesByKey = new Map<string, PlacementEdge>();
  state.connections.forEach((conn, i) => {
    if (!qubitIds.has(conn.fromComp) || !qubitIds.has(conn.toComp)) return;
    const qubitA = qubitNameById.get(conn.fromComp);
    const qubitB = qubitNameById.get(conn.toComp);
    if (!qubitA || !qubitB || qubitA === qubitB) return;
    const key = [qubitA, qubitB].sort().join("__");
    if (edgesByKey.has(key)) return;
    edgesByKey.set(key, {
      qubit_a: qubitA,
      pin_a: conn.fromPin,
      qubit_b: qubitB,
      pin_b: conn.toPin,
      label: `editor_bus_${i + 1}`,
    });
  });
  const placementEdges = Array.from(edgesByKey.values());

  const base: GenerateResponse = {
    label: prev?.label ?? `${placementQubits.length}-Qubit Custom`,
    num_qubits: placementQubits.length,
    topology: prev?.topology ?? "custom",
    engine: prev?.engine ?? "editor",
    interpretation:
      prev?.interpretation ??
      `Edited in Quantum Editor — ${placementQubits.length} qubits, ${state.connections.length} connections.`,
    chip_image: prev?.chip_image,
    fabricated_image: prev?.fabricated_image,
    drc: runDRC(state),
    frequency_plan: prev?.frequency_plan
      ? {
          ...prev.frequency_plan,
          resonator_frequencies_GHz,
          resonator_lengths_mm,
        }
      : {
          epsilon_eff: 6.45,
          qubit_frequencies_GHz: Object.fromEntries(
            placementQubits.map((q, i) => [q.name, 5.0 + i * 0.05]),
          ),
          qubit_groups: {},
          EJ_GHz: {},
          EC_GHz: {},
          resonator_frequencies_GHz,
          resonator_lengths_mm,
          detunings_GHz: {},
          warnings: [],
        },
    placement: {
      ...(prev?.placement ?? {}),
      solver: prev?.placement?.solver ?? "editor",
      qubits: placementQubits,
      edges: placementEdges,
    },
    code: exportToPython(state),
    material: prev?.material,
    ml_prediction: prev?.ml_prediction,
    error_hint: prev?.error_hint,
  };
  return base;
}

// ---------- DRC ----------

export function runDRC(state: EditorState): {
  passed: boolean;
  violations: Array<{ severity: "error" | "warning"; rule: string; message: string }>;
} {
  const violations: Array<{ severity: "error" | "warning"; rule: string; message: string }> = [];
  const minSpacing = 0.4; // mm
  const comps = state.components;

  // Spacing
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      const d = Math.hypot(comps[i].x - comps[j].x, comps[i].y - comps[j].y);
      if (d < minSpacing) {
        violations.push({
          severity: "error",
          rule: "MIN_SPACING",
          message: `${comps[i].name} and ${comps[j].name} are ${d.toFixed(3)}mm apart (min ${minSpacing}mm).`,
        });
      }
    }
  }

  // Duplicate names
  const names = new Map<string, number>();
  comps.forEach((c) => names.set(c.name, (names.get(c.name) ?? 0) + 1));
  for (const [n, count] of names) {
    if (count > 1) {
      violations.push({
        severity: "error",
        rule: "DUPLICATE_NAME",
        message: `Duplicate component name: ${n}`,
      });
    }
  }

  // Off-chip
  const half = state.variables.chip_size / 2;
  comps.forEach((c) => {
    if (Math.abs(c.x) > half || Math.abs(c.y) > half) {
      violations.push({
        severity: "warning",
        rule: "OFF_CHIP",
        message: `${c.name} is outside the ${state.variables.chip_size}mm chip extent.`,
      });
    }
  });

  // Dangling connections
  state.connections.forEach((conn) => {
    const a = comps.find((c) => c.id === conn.fromComp);
    const b = comps.find((c) => c.id === conn.toComp);
    if (!a || !b) {
      violations.push({
        severity: "error",
        rule: "DANGLING_NET",
        message: `Connection ${conn.id} references missing component.`,
      });
    }
  });

  return { passed: violations.filter((v) => v.severity === "error").length === 0, violations };
}

// ---------- Export ----------

export function exportToPython(state: EditorState): string {
  const lines: string[] = [];
  lines.push("# Silicofeller Quantum Editor — generated Qiskit Metal script");
  lines.push("from qiskit_metal import designs, MetalGUI");
  lines.push("from qiskit_metal.qlibrary.qubits.transmon_pocket import TransmonPocket");
  lines.push("from qiskit_metal.qlibrary.qubits.transmon_cross import TransmonCross");
  lines.push("from qiskit_metal.qlibrary.tlines.meandered import RouteMeander");
  lines.push("");
  lines.push("design = designs.DesignPlanar()");
  lines.push("design.overwrite_enabled = True");
  lines.push("");
  lines.push(`# Variables: ${JSON.stringify(state.variables)}`);
  lines.push("");

  state.components.forEach((c) => {
    const opts = Object.entries(c.params)
      .map(([k, v]) => `    ${k}=${typeof v === "number" ? v : `'${v}'`},`)
      .join("\n");
    const pyName = `q_${c.name.toLowerCase()}`;
    lines.push(`${pyName} = ${c.type}(design, '${c.name}', options=dict(`);
    lines.push(`    pos_x='${c.x.toFixed(3)}mm',`);
    lines.push(`    pos_y='${c.y.toFixed(3)}mm',`);
    lines.push(`    orientation='${c.orientation}',`);
    if (opts) lines.push(opts);
    lines.push("))");
    lines.push("");
  });

  state.connections.forEach((conn, i) => {
    lines.push(
      `# Connection ${i}: ${conn.fromComp}.${conn.fromPin} -> ${conn.toComp}.${conn.toPin}`,
    );
    lines.push(`# RouteMeander between ${conn.fromComp} and ${conn.toComp}`);
  });

  lines.push("");
  lines.push("gui = MetalGUI(design)");
  lines.push("gui.rebuild()");
  lines.push("gui.autoscale()");
  return lines.join("\n");
}

export function exportToJSON(state: EditorState): string {
  return JSON.stringify(
    {
      components: state.components,
      connections: state.connections,
      variables: state.variables,
    },
    null,
    2,
  );
}

export function exportToGDS(state: EditorState): string {
  // Stub GDS (text). Real GDSII is binary; this is a placeholder ASCII layout.
  const lines: string[] = [];
  lines.push("HEADER 600");
  lines.push("BGNLIB");
  lines.push("LIBNAME SILICOFELLER_EDITOR.DB");
  lines.push("UNITS 0.001 1e-09");
  lines.push("BGNSTR");
  lines.push("STRNAME TOP");
  state.components.forEach((c) => {
    lines.push(`# ${c.type} ${c.name} @ (${c.x}, ${c.y}) orient=${c.orientation}`);
    lines.push("BOUNDARY");
    lines.push("LAYER 1");
    lines.push("DATATYPE 0");
    const um = 1000;
    const half = 200; // 0.2mm half-size default
    const x = c.x * um;
    const y = c.y * um;
    lines.push(
      `XY ${x - half} ${y - half} ${x + half} ${y - half} ${x + half} ${y + half} ${x - half} ${y + half} ${x - half} ${y - half}`,
    );
    lines.push("ENDEL");
  });
  lines.push("ENDSTR");
  lines.push("ENDLIB");
  return lines.join("\n");
}

// ---------- Reducer ----------

export type EditorAction =
  | {
      type: "LOAD";
      state: {
        components: EditorComponent[];
        connections: EditorConnection[];
        variables?: EditorVariables;
      };
    }
  | { type: "ADD"; component: EditorComponent }
  | { type: "MOVE"; id: string; x: number; y: number }
  | { type: "UPDATE_PROPS"; id: string; patch: Partial<EditorComponent> }
  | { type: "DELETE"; id: string }
  | { type: "SELECT"; id: string | null }
  | { type: "PIN_CLICK"; compId: string; pin: string }
  | { type: "DELETE_CONNECTION"; id: string }
  | { type: "UPDATE_VARIABLES"; patch: Partial<EditorVariables> }
  | { type: "ZOOM"; zoom: number }
  | { type: "PAN"; x: number; y: number }
  | { type: "UNDO" }
  | { type: "REDO" };

function snapshot(s: EditorState): Snapshot {
  return {
    components: s.components.map((c) => ({ ...c, params: { ...c.params } })),
    connections: s.connections.map((c) => ({ ...c })),
    variables: { ...s.variables },
  };
}

function bumpHistory(s: EditorState): Pick<EditorState, "past" | "future" | "rev"> {
  const past = [...s.past, snapshot(s)].slice(-50);
  return { past, future: [], rev: s.rev + 1 };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        components: action.state.components,
        connections: action.state.connections,
        variables: action.state.variables ?? state.variables,
        past: [],
        future: [],
        rev: state.rev + 1,
        selectedId: null,
        pendingPin: null,
      };
    case "ADD":
      return {
        ...state,
        ...bumpHistory(state),
        components: [...state.components, action.component],
        selectedId: action.component.id,
      };
    case "MOVE":
      return {
        ...state,
        ...bumpHistory(state),
        components: state.components.map((c) =>
          c.id === action.id ? { ...c, x: action.x, y: action.y } : c,
        ),
      };
    case "UPDATE_PROPS":
      return {
        ...state,
        ...bumpHistory(state),
        components: state.components.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      };
    case "DELETE":
      return {
        ...state,
        ...bumpHistory(state),
        components: state.components.filter((c) => c.id !== action.id),
        connections: state.connections.filter(
          (c) => c.fromComp !== action.id && c.toComp !== action.id,
        ),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    case "DELETE_CONNECTION":
      return {
        ...state,
        ...bumpHistory(state),
        connections: state.connections.filter((c) => c.id !== action.id),
      };
    case "SELECT":
      return { ...state, selectedId: action.id, pendingPin: null };
    case "PIN_CLICK": {
      if (!state.pendingPin) {
        return { ...state, pendingPin: { compId: action.compId, pin: action.pin } };
      }
      if (state.pendingPin.compId === action.compId && state.pendingPin.pin === action.pin) {
        return { ...state, pendingPin: null };
      }
      const id = `conn_${state.pendingPin.compId}_${state.pendingPin.pin}__${action.compId}_${action.pin}_${Date.now()}`;
      return {
        ...state,
        ...bumpHistory(state),
        pendingPin: null,
        connections: [
          ...state.connections,
          {
            id,
            fromComp: state.pendingPin.compId,
            fromPin: state.pendingPin.pin,
            toComp: action.compId,
            toPin: action.pin,
          },
        ],
      };
    }
    case "UPDATE_VARIABLES":
      return {
        ...state,
        ...bumpHistory(state),
        variables: { ...state.variables, ...action.patch },
      };
    case "ZOOM":
      return { ...state, zoom: Math.max(0.25, Math.min(4, action.zoom)) };
    case "PAN":
      return { ...state, pan: { x: action.x, y: action.y } };
    case "UNDO": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        components: prev.components,
        connections: prev.connections,
        variables: prev.variables,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, 50),
        rev: state.rev + 1,
        selectedId: null,
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        components: next.components,
        connections: next.connections,
        variables: next.variables,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(1),
        rev: state.rev + 1,
        selectedId: null,
      };
    }
    default:
      return state;
  }
}

// ---------- Helpers ----------

export function genName(existing: EditorComponent[], prefix: string): string {
  let n = 0;
  while (existing.some((c) => c.name === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function prefixFor(type: ComponentKind): string {
  switch (type) {
    case "TransmonPocket":
    case "TransmonCross":
      return "Q";
    case "ResonatorCoilRect":
    case "OpenToGround":
      return "R";
    case "CPWWaveguide":
    case "CPWStraightHybrid":
      return "C";
    case "LaunchpadWirebond":
      return "L";
    case "ShortToGround":
      return "S";
    case "LumpedCapacitor":
      return "Cap";
    case "LumpedInductor":
      return "Ind";
    case "RectanglePlaceholder":
      return "Rect";
    default:
      return "X";
  }
}
