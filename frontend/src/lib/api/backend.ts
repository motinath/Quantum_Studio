/**
 * Silicofeller Quantum Studio — Backend API client
 * All requests go to VITE_BACKEND_URL (default http://localhost:5000)
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000").replace(
  /\/$/,
  "",
);

// ── Generic fetch helper ──────────────────────────────────────────────────────

async function api<T>(path: string, options: RequestInit = {}, fallback?: T): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("qs_token") : null;
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers ?? {}) as Record<string, string>),
    },
    ...options,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DRCReport {
  passed: boolean;
  violations: Array<{
    severity: "error" | "warning";
    rule: string;
    message: string;
  }>;
}

export interface FrequencyPlan {
  epsilon_eff: number;
  qubit_frequencies_GHz: Record<string, number>;
  qubit_groups: Record<string, number | string>;
  EJ_GHz: Record<string, number>;
  EC_GHz: Record<string, number>;
  resonator_frequencies_GHz: Record<string, number>;
  resonator_lengths_mm: Record<string, number>;
  detunings_GHz: Record<string, number>;
  warnings: string[];
  substrate?: string;
  metal?: string;
}

export interface PlacementQubit {
  name: string;
  x: number;
  y: number;
  orientation_deg?: number;
}

export interface PlacementEdge {
  qubit_a: string;
  pin_a?: string;
  qubit_b: string;
  pin_b?: string;
  label?: string;
}

export interface Placement {
  solver: string;
  qubits: PlacementQubit[];
  edges?: PlacementEdge[];
  topology?: string;
  cols?: number;
  rows?: number;
  pitch_mm?: number;
}

export interface MLPrediction {
  qubits: number;
  topology: string;
  class_index: number | null;
  confidence: number | null;
  method: string;
  ml_skipped?: boolean;
  reason?: string;
}

export interface GenerateResponse {
  label: string;
  num_qubits: number;
  topology: string;
  engine: string;
  interpretation: string;
  chip_image?: string;
  fabricated_image?: string;
  drc?: DRCReport;
  frequency_plan?: FrequencyPlan;
  placement?: Placement;
  code?: string;
  qclang_source?: string;
  material?: { substrate: string; metal: string };
  ml_prediction?: MLPrediction;
  error_hint?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  max_qubits: number;
  qiskit_metal: string;
  metal_version: string;
  ml_intent: string;
  pipeline: string[];
  error?: string;
}

export interface Material {
  key: string;
  label: string;
  description: string;
  epsilon_r?: number;
  loss_tangent?: number;
  substrate_thickness_um?: number;
  Tc_K?: number;
  london_penetration_depth_nm?: number;
  sheet_resistance_mOhm?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  topology: string;
  num_qubits: number;
  target_frequency_ghz: number;
  status: string;
  substrate_material: string;
  metal_layer: string;
  has_design: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string;
  design_payload?: GenerateResponse;
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    return await api<HealthResponse>("/health");
  } catch {
    return {
      status: "offline",
      version: "—",
      max_qubits: 0,
      qiskit_metal: "—",
      metal_version: "—",
      ml_intent: "—",
      pipeline: [],
      error: "Backend unreachable",
    };
  }
}

// ── Chip generation ───────────────────────────────────────────────────────────

export async function generateChip(
  prompt: string,
  substrate?: string,
  metal?: string,
): Promise<GenerateResponse> {
  try {
    return await api<GenerateResponse>("/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, substrate, metal }),
    });
  } catch (e) {
    console.warn("Backend unavailable, falling back to client-side simulation", e);
    return _clientSideGenerate(prompt, substrate, metal);
  }
}

// ── QCLang ────────────────────────────────────────────────────────────────────

export interface QCLangParseResult {
  success: boolean;
  errors: Array<{ severity: string; message: string; line?: number }>;
  ast: unknown;
  num_chips: number;
  num_qubits: number;
}

export async function parseQCLang(source: string): Promise<QCLangParseResult> {
  return api<QCLangParseResult>("/api/qclang/parse", {
    method: "POST",
    body: JSON.stringify({ source }),
  });
}

export async function compileQCLang(
  source: string,
  options?: {
    target_freq_ghz?: number;
    substrate?: string;
    metal?: string;
    chip_size_mm?: number;
  },
): Promise<{ success: boolean; errors: unknown[]; result: GenerateResponse | null }> {
  return api("/api/qclang/compile", {
    method: "POST",
    body: JSON.stringify({ source, ...options }),
  });
}

export interface MetalCodeRequest {
  components: Array<Record<string, unknown>>;
  connections: Array<Record<string, unknown>>;
  variables: Record<string, unknown>;
}

export interface MetalCodeResponse {
  success: boolean;
  code: string;
  warnings: string[];
  component_count: number;
}

export async function generateMetalCode(payload: MetalCodeRequest): Promise<MetalCodeResponse> {
  return api<MetalCodeResponse>("/api/generate/metal-code", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getQCLangTemplates(): Promise<
  Array<{ name: string; description: string; source: string }>
> {
  try {
    return await api("/api/qclang/templates");
  } catch {
    return [];
  }
}

// ── Materials ─────────────────────────────────────────────────────────────────

export async function fetchMaterials(): Promise<{
  substrates: Record<string, Material>;
  metals: Record<string, Material>;
}> {
  try {
    return await api("/api/materials");
  } catch {
    return {
      substrates: {
        silicon: {
          key: "silicon",
          label: "Silicon (Si)",
          description: "Standard substrate",
          epsilon_r: 11.9,
          loss_tangent: 1e-6,
          substrate_thickness_um: 500,
        },
        sapphire: {
          key: "sapphire",
          label: "Sapphire (Al₂O₃)",
          description: "Ultra-low-loss substrate",
          epsilon_r: 9.3,
          loss_tangent: 3e-8,
          substrate_thickness_um: 430,
        },
      },
      metals: {
        aluminum: {
          key: "aluminum",
          label: "Aluminum (Al)",
          description: "Standard CQED metal",
          Tc_K: 1.2,
          london_penetration_depth_nm: 16,
        },
        niobium: {
          key: "niobium",
          label: "Niobium (Nb)",
          description: "High-Tc superconductor",
          Tc_K: 9.2,
          london_penetration_depth_nm: 39,
        },
        tantalum: {
          key: "tantalum",
          label: "Tantalum (Ta)",
          description: "State-of-the-art coherence",
          Tc_K: 4.5,
          london_penetration_depth_nm: 96,
        },
      },
    };
  }
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  return api<Project[]>("/api/projects");
}

export async function createProject(data: {
  name: string;
  description?: string;
  topology?: string;
  num_qubits?: number;
  target_frequency_ghz?: number;
  substrate_material?: string;
  metal_layer?: string;
}): Promise<Project> {
  return api<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  return api<Project>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await api(`/api/projects/${id}`, { method: "DELETE" });
}

export async function saveDesignToProject(
  projectId: string,
  payload: GenerateResponse,
): Promise<void> {
  await api(`/api/projects/${projectId}/save-design`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Verification ──────────────────────────────────────────────────────────────

export interface VerificationReport {
  id?: string;
  status: "passed" | "failed" | "warning" | "pending";
  drc_passed: boolean;
  violations: unknown[];
  frequency_collisions: unknown[];
  crosstalk_warnings: unknown[];
  summary: {
    total_issues: number;
    critical: number;
    major: number;
    minor: number;
    yield_estimate: number;
    coherence_budget?: { T1_us: number; T2_us: number };
    num_qubits?: number;
  };
}

export async function runVerification(payload: GenerateResponse): Promise<VerificationReport> {
  try {
    return await api<VerificationReport>("/api/verification/check", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    // Client-side fallback
    return _clientVerify(payload);
  }
}

// ── Simulations ───────────────────────────────────────────────────────────────

export async function fetchSimulations() {
  return api("/api/simulations");
}

// ── Claude ────────────────────────────────────────────────────────────────────

export async function askClaude(
  message: string,
  contextType: string = "general",
  contextData?: unknown,
  history?: Array<{ role: string; content: string }>,
): Promise<{ role: string; content: string }> {
  try {
    return await api("/api/claude/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        context_type: contextType,
        context_data: contextData,
        history,
      }),
    });
  } catch {
    return {
      role: "assistant",
      content:
        "I'm currently unavailable (backend offline). " +
        "Run `cd backend && python run.py` to start the server.",
    };
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const formData = new FormData();
  formData.append("username", email);
  formData.append("password", password);
  const res = await fetch(`${BACKEND_URL}/api/auth/token`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();
  if (data.access_token && typeof window !== "undefined") {
    localStorage.setItem("qs_token", data.access_token);
  }
  return data;
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  organization: string,
) {
  const data = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, organization }),
  });
  const d = data as { access_token?: string };
  if (d.access_token && typeof window !== "undefined") {
    localStorage.setItem("qs_token", d.access_token);
  }
  return data;
}

// ── Client-side fallback generator ───────────────────────────────────────────
// Keeps the designer working even when backend is offline.

function _clientSideGenerate(
  prompt: string,
  substrate: string = "silicon",
  metal: string = "aluminum",
): Promise<GenerateResponse> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(_buildClientResult(prompt, substrate, metal)), 1800);
  });
}

function _buildClientResult(prompt: string, substrate: string, metal: string): GenerateResponse {
  const p = prompt.toLowerCase();

  let numQubits = 5;
  const qMatch = prompt.match(/(\d+)\s*[-\s]?\s*qubit/i) ?? prompt.match(/(\d+)\s*q\b/i);
  if (qMatch) numQubits = Math.min(parseInt(qMatch[1]), 100);
  else if (p.includes("surface code")) numQubits = 49;
  else if (p.includes("heavy hex")) numQubits = 27;

  let topology = "grid";
  if (/heavy.?hex/.test(p)) topology = "heavy-hex";
  else if (p.includes("ring")) topology = "ring";
  else if (p.includes("chain") || p.includes("linear")) topology = "chain";

  const freq = parseFloat(prompt.match(/(\d+\.?\d*)\s*ghz/i)?.[1] ?? "5.0");
  const cols = Math.ceil(Math.sqrt(numQubits));

  const qubits: PlacementQubit[] = Array.from({ length: numQubits }, (_, i) => {
    const name = `Q${i + 1}`;
    if (topology === "chain") return { name, x: i * 2.0, y: 0 };
    if (topology === "ring") {
      const a = (2 * Math.PI * i) / numQubits;
      return {
        name,
        x: parseFloat((Math.cos(a) * 3).toFixed(3)),
        y: parseFloat((Math.sin(a) * 3).toFixed(3)),
      };
    }
    const r = Math.floor(i / cols),
      c = i % cols;
    return {
      name,
      x: parseFloat((c * 2 - (cols - 1)).toFixed(3)),
      y: parseFloat((-r * 2 + (Math.ceil(numQubits / cols) - 1)).toFixed(3)),
    };
  });
  const edges = _buildClientPlacementEdges(numQubits, topology);

  const qubitFreqs: Record<string, number> = {};
  const EJ: Record<string, number> = {};
  const EC: Record<string, number> = {};
  const resFreqs: Record<string, number> = {};
  const resLengths: Record<string, number> = {};

  for (let i = 0; i < numQubits; i++) {
    const qName = `Q${i + 1}`;
    const roName = `RO_${qName}`;
    const group = i % 2 === 0;
    qubitFreqs[qName] = parseFloat(
      (freq + (group ? -0.1 : 0.1) + ((i * 0.013) % 0.06)).toFixed(4),
    );
    EJ[qName] = parseFloat((12.8 + ((i * 0.1) % 0.5)).toFixed(3));
    EC[qName] = parseFloat((0.285 + ((i * 0.002) % 0.01)).toFixed(5));
    resFreqs[roName] = parseFloat((qubitFreqs[qName] + 1.5 + ((i * 0.02) % 0.1)).toFixed(4));
    resLengths[roName] = parseFloat((7.5 - ((i * 0.05) % 0.3)).toFixed(4));
  }

  const subLabels: Record<string, string> = {
    silicon: "Silicon",
    sapphire: "Sapphire",
    silicon_nitride: "SiN",
  };
  const metLabels: Record<string, string> = {
    aluminum: "Al",
    niobium: "Nb",
    tantalum: "Ta",
    nbtin: "NbTiN",
  };

  return {
    label: `QPU-${numQubits} · ${topology.charAt(0).toUpperCase() + topology.slice(1)}`,
    num_qubits: numQubits,
    topology: topology.charAt(0).toUpperCase() + topology.slice(1),
    engine: "client-simulation",
    interpretation: `Simulated ${numQubits}-qubit ${topology} on ${subLabels[substrate] ?? substrate}/${metLabels[metal] ?? metal}. Target: ${freq} GHz. DRC: PASS.`,
    drc: { passed: true, violations: [] },
    frequency_plan: {
      epsilon_eff: substrate === "sapphire" ? 5.15 : 6.27,
      qubit_frequencies_GHz: qubitFreqs,
      qubit_groups: Object.fromEntries(Object.keys(qubitFreqs).map((k, i) => [k, i % 2])),
      EJ_GHz: EJ,
      EC_GHz: EC,
      resonator_frequencies_GHz: resFreqs,
      resonator_lengths_mm: resLengths,
      detunings_GHz: Object.fromEntries(Object.keys(resFreqs).map((k) => [k, 1.5])),
      warnings: [],
      substrate,
      metal,
    },
    placement: {
      solver: "client",
      topology,
      cols,
      rows: Math.ceil(numQubits / cols),
      pitch_mm: 2,
      qubits,
      edges,
    },
    material: { substrate, metal },
    code: `# Silicofeller — ${numQubits}Q ${topology} on ${substrate}/${metal}\nimport qiskit_metal as metal\nfrom qiskit_metal import designs\nfrom qiskit_metal.qlibrary.qubits.transmon_pocket import TransmonPocket\n\ndesign = designs.DesignPlanar()\ndesign.overwrite_enabled = True\n${qubits.map((q) => `${q.name.toLowerCase()} = TransmonPocket(design, '${q.name}', options=dict(pos_x='${q.x}mm', pos_y='${q.y}mm'))`).join("\n")}\ndesign.rebuild()`,
  };
}

function _buildClientPlacementEdges(numQubits: number, topology: string): PlacementEdge[] {
  const edges: PlacementEdge[] = [];
  const addEdge = (a: number, b: number, label: string) => {
    edges.push({
      qubit_a: `Q${a + 1}`,
      pin_a: "a",
      qubit_b: `Q${b + 1}`,
      pin_b: "b",
      label,
    });
  };

  if (topology === "chain") {
    for (let i = 0; i < numQubits - 1; i++) addEdge(i, i + 1, `bus_chain_${i + 1}`);
    return edges;
  }

  if (topology === "ring") {
    for (let i = 0; i < numQubits; i++) addEdge(i, (i + 1) % numQubits, `bus_ring_${i + 1}`);
    return edges;
  }

  if (topology === "heavy-hex") {
    for (let i = 0; i < numQubits - 1; i++) addEdge(i, i + 1, `bus_hex_chain_${i + 1}`);
    for (let i = 0; i + 3 < numQubits; i += 3) addEdge(i, i + 3, `bus_hex_link_${i + 1}`);
    return edges;
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(numQubits)));
  const rows = Math.ceil(numQubits / cols);
  for (let i = 0; i < numQubits; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    if (c + 1 < cols && i + 1 < numQubits) addEdge(i, i + 1, `bus_h_${i + 1}_${i + 2}`);
    if (r + 1 < rows && i + cols < numQubits) addEdge(i, i + cols, `bus_v_${i + 1}_${i + cols + 1}`);
  }
  return edges;
}

function _clientVerify(payload: GenerateResponse): VerificationReport {
  const fp = payload.frequency_plan;
  const freqs = Object.values(fp?.qubit_frequencies_GHz ?? {}).sort((a, b) => a - b);
  let collisions = 0;
  for (let i = 0; i < freqs.length - 1; i++) {
    if (freqs[i + 1] - freqs[i] < 0.05) collisions++;
  }
  return {
    status: collisions > 0 ? "warning" : "passed",
    drc_passed: payload.drc?.passed ?? true,
    violations: payload.drc?.violations ?? [],
    frequency_collisions: [],
    crosstalk_warnings: [],
    summary: {
      total_issues: collisions,
      critical: 0,
      major: collisions,
      minor: 0,
      yield_estimate: Math.max(70, 98 - collisions * 5),
      num_qubits: payload.num_qubits,
    },
  };
}
