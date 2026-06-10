import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Network, Cpu, Zap, RefreshCw, Download, Info, ChevronDown, ChevronUp, ChevronRight,
  Layers, Save, FileText, Activity, CheckCircle2, AlertTriangle,
  Lightbulb, ArrowRight, Settings2, Hexagon, Grid3x3, Minus,
  CircleDot, Plus, BarChart3, Gauge, Radio, Thermometer,
  Box, Wifi, Cable, BatteryCharging, Snowflake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateChip } from "@/lib/api/backend";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
export interface GNode { id: number; x: number; y: number; }
export type GEdge = [number, number];

export const Route = createFileRoute("/_app/architecture-explorer")({
  head: () => ({ meta: [{ title: "Architecture Explorer — Silicofeller" }] }),
  component: ArchitectureExplorerPage,
});

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface ArchConfig {
  technology: string;
  targetQubits: number;
  topology: string;
  qubitFrequency: number;
  couplerType: string;
  levelOfDetail: string;
}

interface ArchScores {
  architectureScore: number;
  scalabilityScore: number;
  connectivityScore: number;
  complexityScore: number;
  fidelityScore: number;
  efficiencyScore: number;
  simplicityScore: number;
}

interface ArchResult {
  totalQubits: number;
  couplers: number;
  readoutResonators: number;
  chipArea: number;
  controlLines: number;
  fidelity: number;
  scores: ArchScores;
  t1Coherence: number;
  t2Coherence: number;
  crosstalk: number;
  routingComplexity: number;
  fabricationDifficulty: number;
  estimatedYield: number;
  powerConsumption: number;
  errorRate: number;
  recommendations: { text: string; type: "success" | "warning" | "info" }[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS — technology / topology / coupler tables
   ═══════════════════════════════════════════════════════════════════════════ */

const TECHNOLOGIES = [
  { id: "transmon", name: "Transmon", chipAreaPerQubit: 0.12, baseFidelity: 99.2, powerPerQubit: 0.02, coolingPerQubit: 0.01047, coherenceFactor: 1.0 },
  { id: "silicon-spin", name: "Silicon Spin", chipAreaPerQubit: 0.04, baseFidelity: 98.8, powerPerQubit: 0.008, coolingPerQubit: 0.005, coherenceFactor: 0.9 },
  { id: "trapped-ion", name: "Trapped Ion", chipAreaPerQubit: 0.08, baseFidelity: 99.5, powerPerQubit: 0.05, coolingPerQubit: 0.002, coherenceFactor: 1.0 },
  { id: "photonic", name: "Photonic", chipAreaPerQubit: 0.08, baseFidelity: 98.5, powerPerQubit: 0.03, coolingPerQubit: 0.001, coherenceFactor: 1.1 },
  { id: "fluxonium", name: "Fluxonium", chipAreaPerQubit: 0.18, baseFidelity: 99.5, powerPerQubit: 0.025, coolingPerQubit: 0.012, coherenceFactor: 1.2 },
] as const;

const TOPOLOGY_IMPACT: Record<string, { complexityFactor: number, areaMultiplier: number, fidelityBonus: number }> = {
  "line": { complexityFactor: 1.0, areaMultiplier: 1.0, fidelityBonus: 0.0 },
  "circular": { complexityFactor: 1.15, areaMultiplier: 1.10, fidelityBonus: 0.0 },
  "square-grid": { complexityFactor: 1.30, areaMultiplier: 1.25, fidelityBonus: 0.0 },
  "heavy-hex": { complexityFactor: 1.40, areaMultiplier: 1.35, fidelityBonus: 0.2 },
  "custom": { complexityFactor: 1.20, areaMultiplier: 1.15, fidelityBonus: 0.0 }
};

const TOPOLOGIES = [
  { id: "heavy-hex", name: "Heavy Hex" },
  { id: "square-grid", name: "Square Grid" },
  { id: "line", name: "Line" },
  { id: "circular", name: "Circular" },
  { id: "custom", name: "Custom" },
] as const;

const COUPLER_TYPES = [
  { id: "fixed", name: "Fixed", fidelityBonus: 0, dcFluxFactor: 1.5, controlMul: 1.0 },
  { id: "tunable", name: "Tunable", fidelityBonus: 0.3, dcFluxFactor: 2.5, controlMul: 1.2 },
  { id: "resonator", name: "Resonator-Mediated", fidelityBonus: 0.1, dcFluxFactor: 1.0, controlMul: 1.05 },
] as const;


const DETAIL_LEVELS = ["Minimal", "Balanced", "Detailed"] as const;

const TEMPLATES = [
  { id: "heavy-hex", topology: "heavy-hex", label: "Heavy Hex", sub: "IBM style", icon: Hexagon, color: "violet" },
  { id: "square-grid", topology: "square-grid", label: "Square Grid", sub: "Google style", icon: Grid3x3, color: "blue" },
  { id: "line", topology: "line", label: "Line", sub: "Linear chain", icon: Minus, color: "amber" },
  { id: "circular", topology: "circular", label: "Circular", sub: "Ring topology", icon: CircleDot, color: "emerald" },
  { id: "custom", topology: "custom", label: "Custom", sub: "Build your own", icon: Plus, color: "slate" },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   COMPUTATION ENGINE — all metrics derived from inputs
   ═══════════════════════════════════════════════════════════════════════════ */

function computeArchitecture(config: ArchConfig): ArchResult {
  const { technology, targetQubits, topology, qubitFrequency, couplerType } = config;
  const tech = TECHNOLOGIES.find(t => t.id === technology) || TECHNOLOGIES[0];
  const topo = TOPOLOGY_IMPACT[topology] || TOPOLOGY_IMPACT["custom"];
  const coup = COUPLER_TYPES.find(c => c.id === couplerType) || COUPLER_TYPES[0];

  const couplers = Math.floor(targetQubits * topo.complexityFactor);
  const readoutResonators = targetQubits;

  const area = targetQubits * tech.chipAreaPerQubit * topo.areaMultiplier;
  const controls = Math.floor(targetQubits * coup.controlMul * 1.5);

  return {
    totalQubits: targetQubits,
    couplers,
    readoutResonators,
    chipArea: parseFloat(area.toFixed(2)),
    controlLines: controls,
    fidelity: parseFloat((tech.baseFidelity + topo.fidelityBonus + coup.fidelityBonus).toFixed(2)),
    scores: {
      architectureScore: 85,
      scalabilityScore: 80,
      connectivityScore: 75,
      complexityScore: 60,
      fidelityScore: 90,
      efficiencyScore: 70,
      simplicityScore: 65,
    },
    t1Coherence: 150 * tech.coherenceFactor,
    t2Coherence: 120 * tech.coherenceFactor,
    crosstalk: 2.5,
    routingComplexity: 3.2,
    fabricationDifficulty: 75,
    estimatedYield: 65,
    powerConsumption: targetQubits * tech.powerPerQubit,
    errorRate: 100 - tech.baseFidelity,
    recommendations: [
      { text: "Architecture looks stable.", type: "success" }
    ]
  };
}

function buildGraph(n: number, topo: string): { nodes: GNode[]; edges: GEdge[] } {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  
  if (topo === "line") {
    for (let i = 0; i < n; i++) {
      nodes.push({ id: i, x: 50 + i * 40, y: 100 });
      if (i > 0) edges.push([i - 1, i]);
    }
  } else if (topo === "circular") {
    const radius = Math.max(50, n * 8);
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI;
      nodes.push({ id: i, x: 100 + radius + radius * Math.cos(angle), y: 100 + radius + radius * Math.sin(angle) });
      edges.push([i, (i + 1) % n]);
    }
  } else if (topo === "square-grid") {
    const cols = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      nodes.push({ id: i, x: 50 + c * 40, y: 50 + r * 40 });
      if (c > 0) edges.push([i - 1, i]);
      if (r > 0 && i - cols >= 0) edges.push([i - cols, i]);
    }
  } else {
    // Heavy-hex or custom (approximate heavy-hex via hexagonal lattice subset)
    const cols = Math.ceil(Math.sqrt(n));
    const hexRadius = 25;
    const xOffset = hexRadius * Math.sqrt(3);
    const yOffset = hexRadius * 1.5;
    
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const isShifted = c % 2 !== 0;
      
      const x = 50 + c * xOffset;
      const y = 50 + r * yOffset * 2 + (isShifted ? yOffset : 0);
      nodes.push({ id: i, x, y });
      
      if (r > 0 && i - cols >= 0) {
         edges.push([i - cols, i]);
      }
      if (c > 0 && r > 0 && isShifted && i - cols - 1 >= 0) {
         edges.push([i - cols - 1, i]);
      }
      if (c > 0 && !isShifted && i - 1 >= 0) {
         edges.push([i - 1, i]);
      }
    }
  }
  return { nodes, edges };
}/* ═══════════════════════════════════════════════════════════════════════════
   SVG TOPOLOGY VISUALIZATION
   ═══════════════════════════════════════════════════════════════════════════ */

function TopologyGraph({ nodes, edges, n, accentColor = "#7C3AED" }: {
  nodes: GNode[]; edges: GEdge[]; n: number; accentColor?: string;
}) {
  if (nodes.length === 0) return <div className="h-full flex items-center justify-center text-slate-400 text-sm">No qubits to display</div>;

  const r = n > 200 ? 3 : n > 128 ? 4 : n > 64 ? 6 : n > 36 ? 8 : n > 16 ? 10 : 14;
  const showLabels = n <= 64;
  const showCouplerDots = n <= 128;
  const fontSize = r < 6 ? 5 : r < 8 ? 6 : r < 10 ? 7 : 8;

  const posMap: Record<number, GNode> = {};
  nodes.forEach(nd => { posMap[nd.id] = nd; });

  /* Calculate viewBox from node positions */
  const xs = nodes.map(nd => nd.x);
  const ys = nodes.map(nd => nd.y);
  const vPad = 30;
  const minX = Math.min(...xs) - vPad;
  const minY = Math.min(...ys) - vPad;
  const maxX = Math.max(...xs) + vPad;
  const maxY = Math.max(...ys) + vPad;
  const vw = Math.max(maxX - minX, 100);
  const vh = Math.max(maxY - minY, 80);

  return (
    <svg
      viewBox={`${minX} ${minY} ${vw} ${vh}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid pattern */}
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={minX} y={minY} width={vw} height={vh} fill="url(#grid)" />

      {/* Edges */}
      {edges.map(([a, b], i) => {
        const p1 = posMap[a], p2 = posMap[b];
        if (!p1 || !p2) return null;
        return (
          <line key={`e${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="rgba(100,116,139,0.40)" strokeWidth={n > 100 ? 0.5 : 1} />
        );
      })}

      {/* Coupler dots at edge midpoints */}
      {showCouplerDots && edges.map(([a, b], i) => {
        const p1 = posMap[a], p2 = posMap[b];
        if (!p1 || !p2) return null;
        return (
          <circle key={`c${i}`} cx={(p1.x + p2.x) / 2} cy={(p1.y + p2.y) / 2}
            r={Math.max(1.5, r * 0.25)} fill="#14B8A6" opacity={0.7} />
        );
      })}

      {/* Qubit nodes */}
      {nodes.map(nd => (
        <g key={nd.id}>
          <circle cx={nd.x} cy={nd.y} r={r} fill={accentColor} stroke="white" strokeWidth={r > 6 ? 1.5 : 0.5} opacity={0.9} />
          {showLabels && (
            <text x={nd.x} y={nd.y + fontSize * 0.35} textAnchor="middle"
              fontSize={fontSize} fontWeight="700" fill="white" style={{ userSelect: "none" }}>
              Q{nd.id + 1}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCORE GAUGE — radial donut chart
   ═══════════════════════════════════════════════════════════════════════════ */

function ScoreGauge({ score, size = 110 }: { score: number; size?: number }) {
  const strokeW = 8;
  const radius = (size - strokeW) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#7C3AED" : score >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="rgba(148,163,184,0.12)" strokeWidth={strokeW} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-900">{score}</span>
        <span className="text-[9px] font-bold text-slate-400">/100</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCORE BAR — horizontal progress bar for sub-scores
   ═══════════════════════════════════════════════════════════════════════════ */

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-violet-500" : value >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-slate-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-black text-slate-700 w-7 text-right">{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESOURCE CARD with mini bar indicator
   ═══════════════════════════════════════════════════════════════════════════ */

function ResourceCard({ label, value, unit, max }: { label: string; value: number; unit: string; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 shadow-sm">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-base font-black text-slate-900 leading-tight">
        {value < 1 ? value.toFixed(2) : value.toFixed(value >= 100 ? 0 : 2)}{" "}
        <span className="text-[9px] font-bold text-slate-400">{unit}</span>
      </p>
      <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setPersistentState = useCallback((value: T | ((val: T) => T)) => {
    setState((prev) => {
      const next = value instanceof Function ? value(prev) : value;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  }, [key]);

  return [state, setPersistentState] as const;
}

function ArchitectureExplorerPage() {
  /* ── State ──────────────────────────────────────────────────────────── */
  const [technology, setTechnology] = usePersistentState("arch_technology", "transmon");
  const [targetQubits, setTargetQubits] = usePersistentState("arch_targetQubits", 64);
  const [qubitsInput, setQubitsInput] = usePersistentState("arch_qubitsInput", "64");
  const [topology, setTopology] = usePersistentState("arch_topology", "heavy-hex");
  const [qubitFrequency, setQubitFrequency] = usePersistentState("arch_qubitFrequency", 5.0);
  const [freqInput, setFreqInput] = usePersistentState("arch_freqInput", "5.00");
  const [couplerType, setCouplerType] = usePersistentState("arch_couplerType", "fixed");
  const [levelOfDetail, setLevelOfDetail] = usePersistentState("arch_levelOfDetail", "Minimal");
  const [showAdvanced, setShowAdvanced] = usePersistentState("arch_showAdvanced", false);
  const [inputError, setInputError] = useState<string | null>(null);

  /* Advanced options (cosmetic for now) */
  const [connectivity, setConnectivity] = usePersistentState("arch_connectivity", "Custom");
  const [controlArch, setControlArch] = usePersistentState("arch_controlArch", "Multiplexed");
  const [packaging, setPackaging] = usePersistentState("arch_packaging", "Flip-chip");
  const [environment, setEnvironment] = usePersistentState("arch_environment", "10 mK");

  /* ── Compute result from current state ──────────────────────────────── */
  const config: ArchConfig = useMemo(() => ({
    technology, targetQubits, topology, qubitFrequency, couplerType, levelOfDetail,
  }), [technology, targetQubits, topology, qubitFrequency, couplerType, levelOfDetail]);

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = usePersistentState("arch_lastUpdated", "Never");
  const [result, setResult] = usePersistentState<ArchResult>("arch_result", computeArchitecture(config));
  const [graph, setGraph] = usePersistentState<{ nodes: GNode[]; edges: GEdge[] }>("arch_graph", buildGraph(targetQubits, topology));

  const scores = result.scores;
  const recommendations = result.recommendations;

  const navigate = useNavigate();
  const { createAndActivate } = useProject();

  const handleRecalculate = async () => {
    setIsLoading(true);
    try {
      const response = await generateChip(`${targetQubits} qubit ${topology}`, "silicon", "aluminum");
      
      const newGraph = {
        nodes: [] as GNode[],
        edges: [] as GEdge[]
      };
      
      if (response.placement && response.placement.qubits.length > 0) {
        const qMap: Record<string, number> = {};
        // Adjust coordinate scaling based on whether it's grid or offset
        response.placement.qubits.forEach((q, i) => {
          qMap[q.name] = i;
          // Scale from backend mm representation to viewBox representation
          // Using 50 + x * 20 to center and spread out the qubits
          newGraph.nodes.push({ id: i, x: 100 + q.x * 25, y: 100 - q.y * 25 });
        });
        
        if (response.placement.edges) {
          response.placement.edges.forEach(e => {
            if (qMap[e.qubit_a] !== undefined && qMap[e.qubit_b] !== undefined) {
              newGraph.edges.push([qMap[e.qubit_a], qMap[e.qubit_b]]);
            }
          });
        }
      } else {
         const fallback = buildGraph(targetQubits, topology);
         newGraph.nodes = fallback.nodes;
         newGraph.edges = fallback.edges;
      }
      
      setGraph(newGraph);
      setResult(computeArchitecture(config));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      toast.error(e.message || "Failed to generate circuit from backend");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveArchitecture = async () => {
    try {
      await createAndActivate({
        name: `${targetQubits}Q ${topology}`,
        num_qubits: targetQubits,
        topology: topology,
        target_frequency_ghz: qubitFrequency,
        substrate_material: "silicon",
        metal_layer: "aluminum"
      });
      toast.success("Architecture saved to project successfully!");
      navigate({ to: "/projects" });
    } catch (e: any) {
      toast.error(e.message || "Failed to save architecture");
    }
  };

  const handleExportReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      config,
      metrics: result,
      graph,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `architecture_report_${targetQubits}q_${topology.toLowerCase().replace(" ", "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report export completed.");
  };

  /* ── Handlers ───────────────────────────────────────────────────────── */
  const handleQubitChange = useCallback((raw: string) => {
    setQubitsInput(raw);
    const num = parseInt(raw, 10);
    if (isNaN(num)) { setInputError("Enter a valid number"); return; }
    if (num < 1) { setInputError("Minimum 1 qubit"); return; }
    if (num > 1000) { setInputError("Maximum 1000 qubits"); return; }
    setInputError(null);
    setTargetQubits(num);
  }, []);

  const handleFreqChange = useCallback((raw: string) => {
    setFreqInput(raw);
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    setQubitFrequency(Math.max(1, Math.min(10, num)));
  }, []);

  const handleTemplateClick = useCallback((topo: string) => {
    setTopology(topo);
  }, []);

  const configString = JSON.stringify(config);

  /* ── Select styling helper ──────────────────────────────────────────── */
  const selectCls = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 cursor-pointer appearance-none";
  const inputCls = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 w-full";
  const labelCls = "text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1";

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-[1400px] px-5 py-5">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>

          {/* ─── Page Header ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Architecture Explorer</h1>
              <p className="text-xs text-slate-500 mt-0.5">Explore system architectures and estimate resources, connectivity, and performance.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveArchitecture} variant="outline" size="sm" className="h-8 rounded-lg text-[11px] font-bold gap-1.5 border-slate-200 cursor-pointer">
                <Save className="h-3.5 w-3.5" /> Save Architecture
              </Button>
              <Button onClick={handleExportReport} variant="outline" size="sm" className="h-8 rounded-lg text-[11px] font-bold gap-1.5 border-slate-200 cursor-pointer">
                <Download className="h-3.5 w-3.5" /> Export Report
              </Button>
            </div>
          </div>

          {/* ─── Top Control Bar ────────────────────────────────────────── */}
          <Card className="rounded-2xl border-slate-200/70 shadow-sm bg-white p-4 mb-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Technology */}
              <div className="min-w-[130px]">
                <p className={labelCls}>Technology</p>
                <div className="relative">
                  <select value={technology} onChange={e => setTechnology(e.target.value)} className={selectCls + " w-full pr-8"}>
                    {TECHNOLOGIES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Target Qubits */}
              <div className="min-w-[110px]">
                <p className={labelCls}>Target Qubits</p>
                <input type="number" min={1} max={1000} value={qubitsInput}
                  onChange={e => handleQubitChange(e.target.value)}
                  onBlur={() => { if (inputError) { setQubitsInput(String(targetQubits)); setInputError(null); } }}
                  className={cn(inputCls, inputError && "border-rose-400 focus:ring-rose-400/40")}
                />
                {inputError && <p className="text-[9px] text-rose-500 font-bold mt-0.5">{inputError}</p>}
              </div>

              {/* Topology */}
              <div className="min-w-[130px]">
                <p className={labelCls}>
                  Topology <Info className="h-3 w-3 text-slate-300" />
                </p>
                <div className="relative">
                  <select value={topology} onChange={e => setTopology(e.target.value)} className={selectCls + " w-full pr-8"}>
                    {TOPOLOGIES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Qubit Frequency */}
              <div className="min-w-[130px]">
                <p className={labelCls}>
                  Qubit Frequency <Info className="h-3 w-3 text-slate-300" />
                </p>
                <div className="relative">
                  <input type="number" step="0.01" min={1} max={10} value={freqInput}
                    onChange={e => handleFreqChange(e.target.value)}
                    onBlur={() => setFreqInput(qubitFrequency.toFixed(2))}
                    className={inputCls + " pr-12"}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">GHz</span>
                </div>
              </div>

              {/* Coupler Type */}
              <div className="min-w-[150px]">
                <p className={labelCls}>
                  Coupler Type <Info className="h-3 w-3 text-slate-300" />
                </p>
                <div className="relative">
                  <select value={couplerType} onChange={e => setCouplerType(e.target.value)} className={selectCls + " w-full pr-8"}>
                    {COUPLER_TYPES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Level of Detail */}
              <div className="min-w-[110px]">
                <p className={labelCls}>
                  Level of Detail <Info className="h-3 w-3 text-slate-300" />
                </p>
                <div className="relative">
                  <select value={levelOfDetail} onChange={e => setLevelOfDetail(e.target.value)} className={selectCls + " w-full pr-8"}>
                    {DETAIL_LEVELS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Recalculate Button */}
              <div className="ml-auto min-w-[120px] flex flex-col justify-end">
                <Button 
                  onClick={handleRecalculate} 
                  disabled={isLoading || !!inputError}
                  className="h-9 w-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-lg shadow-sm shadow-violet-600/20"
                >
                  {isLoading ? (
                    <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-3.5 w-3.5" />
                  )}
                  {isLoading ? "Generating..." : "Recalculate"}
                </Button>
                <p className="text-[9px] text-slate-400 text-center mt-1 font-medium">
                  Last updated: {lastUpdated}
                </p>
              </div>
              </div>
            </Card>

          {/* ─── Main 3-Column Layout ──────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* ── LEFT: Templates + Advanced ────────────────────────────── */}
            <div className="lg:col-span-3 space-y-4">
              {/* Architecture Templates */}
              <Card className="rounded-2xl border-slate-200/70 shadow-sm bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Architecture Templates</p>
                <div className="space-y-1.5">
                  {TEMPLATES.map(t => {
                    const active = topology === t.topology;
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => handleTemplateClick(t.topology)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer group",
                          active
                            ? "border-violet-300 bg-violet-50 shadow-sm"
                            : "border-transparent hover:bg-slate-50 hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          active ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-400 group-hover:text-slate-600"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-[11px] font-bold truncate", active ? "text-violet-700" : "text-slate-700")}>
                            {t.label} ({targetQubits})
                          </p>
                          <p className="text-[9px] text-slate-400">{t.sub}</p>
                        </div>
                        {active && <ChevronRight className="h-3.5 w-3.5 text-violet-400 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => toast.info("Template management coming soon.")} className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-violet-600 transition-colors cursor-pointer">
                  <Settings2 className="h-3 w-3" /> Manage Templates
                </button>
              </Card>

              {/* Advanced Options */}
              <Card className="rounded-2xl border-slate-200/70 shadow-sm bg-white p-4">
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
                >
                  <span>Advanced Options</span>
                  {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showAdvanced && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 space-y-3 overflow-hidden"
                  >
                    <div>
                      <p className={labelCls}>Connectivity Constraints</p>
                      <div className="relative">
                        <select value={connectivity} onChange={e => setConnectivity(e.target.value)} className={selectCls + " w-full pr-8"}>
                          {["Custom", "Nearest-Neighbor", "All-to-All"].map(o => <option key={o}>{o}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <p className={labelCls}>Control Architecture</p>
                      <div className="relative">
                        <select value={controlArch} onChange={e => setControlArch(e.target.value)} className={selectCls + " w-full pr-8"}>
                          {["Multiplexed", "Individual", "Shared Bus"].map(o => <option key={o}>{o}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <p className={labelCls}>Packaging</p>
                      <div className="relative">
                        <select value={packaging} onChange={e => setPackaging(e.target.value)} className={selectCls + " w-full pr-8"}>
                          {["Flip-chip", "Wire-bonded", "3D-integrated"].map(o => <option key={o}>{o}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <p className={labelCls}>Environment</p>
                      <div className="relative">
                        <select value={environment} onChange={e => setEnvironment(e.target.value)} className={selectCls + " w-full pr-8"}>
                          {["10 mK", "20 mK", "50 mK", "100 mK"].map(o => <option key={o}>{o}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </Card>
            </div>

            {/* ── CENTER: Topology Visualization ───────────────────────── */}
            <div className="lg:col-span-5">
              <Card className="rounded-2xl border-slate-200/70 shadow-sm bg-white overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-800">Architecture Topology</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                      <span className="text-[9px] font-semibold text-slate-500">Qubit</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                      <span className="text-[9px] font-semibold text-slate-500">Coupler</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-[9px] font-semibold text-slate-500">Readout</span>
                    </div>
                  </div>
                </div>

                {/* SVG Visualization */}
                <motion.div key={lastUpdated} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}
                  className="h-[360px] bg-[#FAFAFC] p-2"
                >
                  <TopologyGraph nodes={graph.nodes} edges={graph.edges} n={targetQubits} />
                </motion.div>

                {/* Footer stats bar */}
                <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex-wrap">
                  {[
                    { label: "Total Qubits", value: result.totalQubits },
                    { label: "Couplers", value: result.couplers },
                    { label: "Readout Resonators", value: result.readoutResonators },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className="text-[9px] font-semibold text-slate-400">{s.label}:</span>
                      <Badge variant="secondary" className="rounded-full text-[9px] font-black px-2 py-0 bg-white border-slate-200">
                        {s.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* ── RIGHT: Summary + Score ────────────────────────────────── */}
            <div className="lg:col-span-4 space-y-4">
              {/* Architecture Summary */}
              <Card className="rounded-2xl border-slate-200/70 shadow-sm bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Architecture Summary</p>
                <motion.div key={configString} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
                  className="grid grid-cols-2 gap-2.5"
                >
                  {/* Total Qubits */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Cpu className="h-3 w-3 text-violet-500" />
                      <span className="text-[9px] font-bold text-slate-400">Total Qubits</span>
                    </div>
                    <p className="text-xl font-black text-slate-900">{result.totalQubits}</p>
                  </div>
                  {/* Couplers */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Cable className="h-3 w-3 text-teal-500" />
                      <span className="text-[9px] font-bold text-slate-400">Couplers</span>
                    </div>
                    <p className="text-xl font-black text-slate-900">{result.couplers}</p>
                  </div>
                  {/* Readout Resonators */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Radio className="h-3 w-3 text-amber-500" />
                      <span className="text-[9px] font-bold text-slate-400">Readout Resonators</span>
                    </div>
                    <p className="text-xl font-black text-slate-900">{result.readoutResonators}</p>
                  </div>
                  {/* Chip Area */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Box className="h-3 w-3 text-blue-500" />
                      <span className="text-[9px] font-bold text-slate-400">Chip Area <span className="text-slate-300">(est.)</span></span>
                    </div>
                    <p className="text-xl font-black text-slate-900">{result.chipArea} <span className="text-xs font-bold text-slate-400">mm²</span></p>
                  </div>
                  {/* Control Lines */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className="h-3 w-3 text-orange-500" />
                      <span className="text-[9px] font-bold text-slate-400">Control Lines <span className="text-slate-300">(est.)</span></span>
                    </div>
                    <p className="text-xl font-black text-slate-900">{result.controlLines}</p>
                  </div>
                  {/* Two-Qubit Gate Fidelity */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Gauge className="h-3 w-3 text-emerald-500" />
                      <span className="text-[9px] font-bold text-slate-400">Two-Qubit Gate</span>
                    </div>
                    <p className="text-xl font-black text-slate-900">{result.fidelity}%</p>
                    <p className="text-[9px] font-bold text-slate-400">Fidelity</p>
                  </div>
                </motion.div>
              </Card>

              {/* Architecture Score */}
              <Card className="rounded-2xl border-slate-200/70 shadow-sm bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Architecture Score</p>
                <motion.div key={configString} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
                  className="flex gap-5"
                >
                  <ScoreGauge score={scores.architectureScore} />
                  <div className="flex-1 space-y-2.5 py-1">
                    <ScoreBar label="Scalability" value={scores.scalabilityScore} />
                    <ScoreBar label="Connectivity" value={scores.connectivityScore} />
                    <ScoreBar label="Complexity" value={scores.complexityScore} />
                    <ScoreBar label="Fidelity" value={scores.fidelityScore} />
                    <ScoreBar label="Efficiency" value={scores.efficiencyScore} />
                    <ScoreBar label="Simplicity" value={scores.simplicityScore} />
                  </div>
                </motion.div>
                <button onClick={() => toast.info("Full analysis dashboard is under construction.")} className="mt-3 flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer">
                  View full analysis <ArrowRight className="h-3 w-3" />
                </button>
              </Card>
            </div>
          </div>

          {/* ─── Bottom Section: Resources + Recommendations ───────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">

            {/* Resource Estimates */}
            <Card className="rounded-2xl border-slate-200/70 shadow-sm bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Resource Estimates</p>
              <motion.div key={configString} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
                className="grid grid-cols-3 gap-2.5"
              >
                <ResourceCard label="T1 Coherence" value={result.t1Coherence} unit="us" max={500} />
                <ResourceCard label="T2 Coherence" value={result.t2Coherence} unit="us" max={400} />
                <ResourceCard label="Crosstalk Est." value={result.crosstalk} unit="%" max={10} />
                <ResourceCard label="Routing Cmplx." value={result.routingComplexity} unit="" max={5} />
                <ResourceCard label="Fabrication Diff." value={result.fabricationDifficulty} unit="/100" max={100} />
                <ResourceCard label="Estimated Yield" value={result.estimatedYield} unit="%" max={100} />
                <ResourceCard label="Power Consump." value={result.powerConsumption} unit="W" max={50} />
                <ResourceCard label="Error Rate" value={result.errorRate} unit="%" max={5} />
              </motion.div>
              <p className="mt-3 text-[9px] text-slate-400 font-semibold">
                Estimates are based on selected technology and typical parameters.
              </p>
            </Card>

            {/* Recommendations */}
            <Card className="rounded-2xl border-slate-200/70 shadow-sm bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Recommendations</p>
              <motion.div key={configString} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
                className="space-y-2.5"
              >
                {recommendations.map((rec, i) => {
                  const Icon = rec.type === "success" ? CheckCircle2 : rec.type === "warning" ? AlertTriangle : Lightbulb;
                  const color = rec.type === "success" ? "text-emerald-500" : rec.type === "warning" ? "text-amber-500" : "text-blue-500";
                  return (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
                      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", color)} />
                      <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">{rec.text}</p>
                    </div>
                  );
                })}
              </motion.div>
              <button onClick={() => toast.info("Detailed reports are coming soon.")} className="mt-3 flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer">
                View detailed report <ArrowRight className="h-3 w-3" />
              </button>
            </Card>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
