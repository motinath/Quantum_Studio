import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, BaseEdge, EdgeLabelRenderer, getStraightPath, Handle, Position, useNodesState, useEdgesState, addEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { RefreshCw, Download, Bookmark, Bell, Info, Maximize, Minimize } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_app/architecture-explorer")({
  component: ArchitectureExplorerPage,
});

const SafeTooltip = ({ message }: { message: string }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) {
    return <Info className="h-3.5 w-3.5 text-slate-400" />;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full transition-transform hover:scale-110">
            <Info className="h-3.5 w-3.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          align="center" 
          sideOffset={8}
          collisionPadding={10}
          className="max-w-[300px] p-3 text-xs leading-relaxed shadow-xl z-[100] animate-in fade-in-0 zoom-in-95 duration-200"
        >
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// --- PHYSICS ENGINE DATA ---
const TECH_METADATA: Record<string, any> = {
  "transmon": { coherenceTime: 120, baseFidelity: 99.2, qubitArea: 0.08, coolingPerQubit: 0.010, controlLinesPerQubit: 2, readoutLinesPerQubit: 1, gateTime: "200 ns", symbol: "□", color: "#8b5cf6" },
  "fluxonium": { coherenceTime: 350, baseFidelity: 99.7, qubitArea: 0.12, coolingPerQubit: 0.018, controlLinesPerQubit: 3, readoutLinesPerQubit: 1, gateTime: "300 ns", symbol: "◯", color: "#ec4899" },
  "xmon": { coherenceTime: 110, baseFidelity: 99.1, qubitArea: 0.09, coolingPerQubit: 0.011, controlLinesPerQubit: 2, readoutLinesPerQubit: 1, gateTime: "250 ns", symbol: "✚", color: "#3b82f6" },
  "flux-qubit": { coherenceTime: 40, baseFidelity: 99.1, qubitArea: 0.05, coolingPerQubit: 0.020, controlLinesPerQubit: 2, readoutLinesPerQubit: 1, gateTime: "400 ns", symbol: "⊙", color: "#f59e0b" },
  "charge-qubit": { coherenceTime: 5, baseFidelity: 95.0, qubitArea: 0.01, coolingPerQubit: 0.005, controlLinesPerQubit: 1, readoutLinesPerQubit: 1, gateTime: "500 ns", symbol: "◇", color: "#ef4444" },
  "phase-qubit": { coherenceTime: 10, baseFidelity: 98.0, qubitArea: 0.02, coolingPerQubit: 0.010, controlLinesPerQubit: 1, readoutLinesPerQubit: 1, gateTime: "450 ns", symbol: "△", color: "#10b981" },
  "gatemon": { coherenceTime: 20, baseFidelity: 98.5, qubitArea: 0.04, coolingPerQubit: 0.008, controlLinesPerQubit: 1, readoutLinesPerQubit: 1, gateTime: "200 ns", symbol: "⬢", color: "#14b8a6" }
};

// --- CUSTOM REACT FLOW NODES ---
const BaseHandles = () => (
  <>
    <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
    <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
  </>
);

const QubitLabel = ({ label }: { label: string }) => (
  <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>{label}</div>
);

const SvgNode = ({ data, color }: any) => {
  const symbol = TECH_METADATA[data.technology]?.symbol || "?";
  return (
    <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <BaseHandles />
      <QubitLabel label={data.label} />
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
        <rect x="2" y="2" width="36" height="36" rx="8" fill="white" stroke={color} strokeWidth="2" />
      </svg>
      <span style={{ color: color, fontWeight: 'bold', fontSize: '18px', zIndex: 10 }}>{symbol}</span>
    </div>
  );
};

const TransmonNode = ({ data }: any) => <SvgNode data={data} color="#8b5cf6" />;
const FluxQubitNode = ({ data }: any) => <SvgNode data={data} color="#f59e0b" />;
const ChargeQubitNode = ({ data }: any) => <SvgNode data={data} color="#ef4444" />;
const PhaseQubitNode = ({ data }: any) => <SvgNode data={data} color="#10b981" />;
const XmonNode = ({ data }: any) => <SvgNode data={data} color="#3b82f6" />;
const FluxoniumNode = ({ data }: any) => <SvgNode data={data} color="#ec4899" />;
const GatemonNode = ({ data }: any) => <SvgNode data={data} color="#14b8a6" />;

const CustomReadoutNode = () => (
  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'white', border: '2px solid #3b82f6', boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)' }}>
    <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
    <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
  </div>
);

// --- CUSTOM REACT FLOW EDGES ---
const CustomCouplerEdge = ({ id, sourceX, sourceY, targetX, targetY, style = {}, markerEnd, data }: any) => {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  let path = edgePath;
  let strokeDasharray = "none";
  let color = data?.topology === 'heavy-hex' ? "#F59E0B" : "#cbd5e1";

  if (data?.coupler === 'readout') color = "#60A5FA";
  else if (data?.coupler === 'tunable') color = "#3b82f6";
  else if (data?.coupler === 'flux-tunable') color = "#8b5cf6";
  else if (data?.coupler === 'inductive') { color = "#10b981"; strokeDasharray = "5,5"; }
  else if (data?.coupler === 'resonator-bus') color = "#f59e0b";
  else if (data?.coupler === 'cross-resonance') { color = "#ef4444"; strokeDasharray = "10,5"; }

  const strokeWidth = data?.coupler === 'readout' ? 1.5 : (data?.topology === 'heavy-hex' ? 1.5 : 2);

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={{ ...style, stroke: color, strokeWidth, strokeDasharray }} />
      {data?.coupler === 'resonator-bus' && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: 10, border: `1px solid ${color}`, color, fontWeight: 'bold', pointerEvents: 'none' }}>
            R
          </div>
        </EdgeLabelRenderer>
      )}
      {data?.coupler === 'tunable' && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, color, fontSize: 16, pointerEvents: 'none' }}>◎</div>
        </EdgeLabelRenderer>
      )}
      {data?.coupler === 'flux-tunable' && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, color, fontSize: 16, pointerEvents: 'none' }}>⊗</div>
        </EdgeLabelRenderer>
      )}
      {data?.coupler === 'cross-resonance' && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, color, fontSize: 16, pointerEvents: 'none' }}>↝</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

// --- TOPOLOGY GENERATION ALGORITHMS ---
function generateArchitecture(technology: string, topology: string, coupler: string, numQubits: number) {
  const nodes: any[] = [];
  const edges: any[] = [];
  
  if (numQubits < 1) return { nodes, edges };

  const spacing = 160;
  
  if (topology === 'linear') {
    for (let i = 0; i < numQubits; i++) {
      nodes.push({ id: `Q${i+1}`, position: { x: i * spacing, y: 0 }, data: { topology, label: `Q${i+1}`, technology }, type: technology });
    }
    for (let i = 0; i < numQubits - 1; i++) {
      edges.push({ id: `e-Q${i+1}-Q${i+2}`, source: `Q${i+1}`, target: `Q${i+2}`, type: 'coupler', data: { topology, coupler } });
    }
  } else if (topology === 'ring') {
    const r = Math.max(100, (numQubits * spacing) / (2 * Math.PI));
    for (let i = 0; i < numQubits; i++) {
      const angle = (i * 2 * Math.PI) / numQubits - Math.PI / 2;
      nodes.push({ id: `Q${i+1}`, position: { x: r * Math.cos(angle), y: r * Math.sin(angle) }, data: { topology, label: `Q${i+1}`, technology }, type: technology });
    }
    for (let i = 0; i < numQubits; i++) {
      edges.push({ id: `e-${i}`, source: `Q${i+1}`, target: `Q${((i + 1) % numQubits) + 1}`, type: 'coupler', data: { topology, coupler } });
    }
  } else if (topology === '2d-grid') {
    const cols = Math.ceil(Math.sqrt(numQubits));
    for (let i = 0; i < numQubits; i++) {
      nodes.push({ id: `Q${i+1}`, position: { x: (i % cols) * spacing, y: Math.floor(i / cols) * spacing }, data: { topology, label: `Q${i+1}`, technology }, type: technology });
    }
    for (let i = 0; i < numQubits; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      if (c + 1 < cols && i + 1 < numQubits) {
        edges.push({ id: `eh-${i}`, source: `Q${i+1}`, target: `Q${i+2}`, type: 'coupler', data: { topology, coupler } });
      }
      if (r + 1 < Math.ceil(numQubits / cols) && i + cols < numQubits) {
        edges.push({ id: `ev-${i}`, source: `Q${i+1}`, target: `Q${i+cols+1}`, type: 'coupler', data: { topology, coupler } });
      }
    }
  } else if (topology === 'heavy-hex') {
    const R = spacing * 0.6;
    const W = Math.sqrt(3) * R;
    const H = 1.5 * R;
    const tempNodes = [];
    for (let row = -10; row <= 10; row++) {
      for (let col = -10; col <= 10; col++) {
        const cx = col * W + (Math.abs(row) % 2 === 1 ? W / 2 : 0);
        const cy = row * H;
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 6 + (Math.PI / 3) * i;
          tempNodes.push({ x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle), dist: Math.hypot(cx, cy) });
        }
      }
    }
    tempNodes.sort((a, b) => a.dist - b.dist);
    const finalNodes: any[] = [];
    for (const tn of tempNodes) {
      let isDup = false;
      for (const fn of finalNodes) {
        if (Math.hypot(tn.x - fn.x, tn.y - fn.y) < 2) {
          isDup = true; break;
        }
      }
      if (!isDup && finalNodes.length < numQubits) {
        finalNodes.push({ x: tn.x, y: tn.y });
      }
    }
    finalNodes.forEach((n1, i) => {
      nodes.push({ id: `Q${i+1}`, position: { x: n1.x, y: n1.y }, data: { topology, label: `Q${i+1}`, technology }, type: technology });
    });
    for (let i = 0; i < finalNodes.length; i++) {
      for (let j = i + 1; j < finalNodes.length; j++) {
        const dist = Math.hypot(finalNodes[i].x - finalNodes[j].x, finalNodes[i].y - finalNodes[j].y);
        if (dist > R * 0.9 && dist < R * 1.1) {
          edges.push({ id: `e-${i}-${j}`, source: `Q${i+1}`, target: `Q${j+1}`, type: 'coupler', data: { topology, coupler } });
        }
      }
    }
  } else if (topology === 'all-to-all') {
    const r = Math.max(100, (numQubits * spacing) / (2 * Math.PI));
    for (let i = 0; i < numQubits; i++) {
      const angle = (i * 2 * Math.PI) / numQubits - Math.PI / 2;
      nodes.push({ id: `Q${i+1}`, position: { x: r * Math.cos(angle), y: r * Math.sin(angle) }, data: { topology, label: `Q${i+1}`, technology }, type: technology });
    }
    for (let i = 0; i < numQubits; i++) {
      for (let j = i + 1; j < numQubits; j++) {
        edges.push({ id: `e-${i}-${j}`, source: `Q${i+1}`, target: `Q${j+1}`, type: 'coupler', data: { topology, coupler } });
      }
    }
  } else {
    for (let i = 0; i < numQubits; i++) {
      nodes.push({ id: `Q${i+1}`, position: { x: Math.random() * 500 - 250, y: Math.random() * 500 - 250 }, data: { topology, label: `Q${i+1}`, technology }, type: technology });
    }
    for (let i = 0; i < numQubits; i++) {
       const dists = nodes.map((n, j) => ({ j, d: Math.hypot(nodes[i].position.x - n.position.x, nodes[i].position.y - n.position.y) })).sort((a,b) => a.d - b.d);
       if (dists[1]) edges.push({ id: `e-${i}-1`, source: `Q${i+1}`, target: `nodes[dists[1].j].id`, type: 'coupler', data: { topology, coupler } });
       if (dists[2] && Math.random() > 0.5) edges.push({ id: `e-${i}-2`, source: `Q${i+1}`, target: `nodes[dists[2].j].id`, type: 'coupler', data: { topology, coupler } });
    }
  }

  return { nodes, edges };
}

// --- METRICS ENGINE ---
function computeMetrics(nodes: any[], edges: any[], tech: string, topology: string, coupler: string, freq: number, numQubits: number) {
  const meta = TECH_METADATA[tech] || TECH_METADATA['transmon'];
  const N = numQubits;
  const C = edges.length;
  
  // Coupler Rules
  let couplerArea = 0.008;
  let couplerFidelityMod = 0;
  let fluxLines = 0;
  let controlLinesMult = 1.0;
  let readoutAreaMult = 1.0;

  if (coupler === 'fixed') { couplerArea = 0.008; fluxLines = 0; couplerFidelityMod = 0; }
  else if (coupler === 'tunable') { couplerArea = 0.012; fluxLines = N; couplerFidelityMod = 0.15; }
  else if (coupler === 'flux-tunable') { couplerArea = 0.015; fluxLines = N; couplerFidelityMod = 0.25; }
  else if (coupler === 'resonator-bus') { couplerArea = 0.020; fluxLines = 0; readoutAreaMult = 1.2; }
  else if (coupler === 'inductive') { couplerArea = 0.010; fluxLines = 0; couplerFidelityMod = 0.05; }
  else if (coupler === 'cross-resonance') { couplerArea = 0.009; controlLinesMult = 1.3; couplerFidelityMod = 0.10; }

  // Resource Calculations
  const controlLines = Math.ceil(N * meta.controlLinesPerQubit * controlLinesMult);
  const readoutLines = N * meta.readoutLinesPerQubit;
  
  // Chip Area Multiplier & Topology Penalties
  let areaMult = 1.0;
  let topPenalty = 0;
  let routingComplexity = "Low";
  let crosstalkRisk = "Low";
  
  if (topology === 'linear') { areaMult = 1.00; topPenalty = -0.20; routingComplexity = "Low"; }
  else if (topology === 'ring') { areaMult = 1.05; topPenalty = -0.15; routingComplexity = "Low-Medium"; }
  else if (topology === '2d-grid') { areaMult = 1.15; topPenalty = -0.10; routingComplexity = "Medium"; crosstalkRisk = "Medium"; }
  else if (topology === 'heavy-hex') { areaMult = 1.20; topPenalty = -0.05; routingComplexity = "Medium"; }
  else if (topology === 'all-to-all') { areaMult = 1.50; topPenalty = -0.30; routingComplexity = "Very High"; crosstalkRisk = "High"; }
  else { areaMult = 1.20; topPenalty = -0.10; routingComplexity = "Medium"; crosstalkRisk = "High"; }

  if (freq > 6) crosstalkRisk = "High";
  if (coupler === 'cross-resonance') crosstalkRisk = "High";

  const chipArea = ((N * meta.qubitArea) + (C * couplerArea) + (N * 0.03 * readoutAreaMult) + (N * 0.02)) * areaMult;
  const coolingLoad = N * meta.coolingPerQubit * 1000; // µW
  const totalPower = (controlLines * 0.004) + (readoutLines * 0.002) + (fluxLines * 0.003); // W -> mW
  const totalPowerMW = totalPower * 1000;

  // Fidelity Estimation
  const freqPenalty = freq > 5 ? (freq - 5) * -0.05 : 0;
  const scalingPenalty = -(N / 1000);
  const fidelity = meta.baseFidelity + couplerFidelityMod + freqPenalty + topPenalty + scalingPenalty;

  const avgConnectivity = (2 * C) / (N || 1);
  const errorRate = 100 - fidelity;
  
  // Scalability Score
  const scalabilityScore = Math.max(0, Math.min(100, 100 - (controlLines/N * 10) - (topPenalty * -100) + (meta.coherenceTime/10)));
  
  // Quantum Volume Estimate (approx)
  const qv = N * (fidelity / 100) * (avgConnectivity / 2);

  return {
    overallArchitectureScore: Math.round(scalabilityScore),
    architectureSummary: {
      qubits: N,
      couplers: C,
      averageConnectivity: avgConnectivity.toFixed(2),
      chipArea: chipArea.toFixed(2),
    },
    performanceMetrics: {
      singleQubitFidelity: fidelity.toFixed(3),
      twoQubitFidelity: (fidelity - 0.5).toFixed(3),
      readoutFidelity: (fidelity + 0.1).toFixed(3),
      quantumVolume: Math.round(qv),
    },
    reliabilityMetrics: {
      T1: meta.coherenceTime,
      T2: Math.round(meta.coherenceTime * 0.8),
      errorRate: errorRate.toFixed(3),
      crosstalkRisk,
    },
    resourceMetrics: {
      controlLines,
      readoutLines,
      dcFluxLines: fluxLines,
      coolingLoad: coolingLoad.toFixed(1),
      totalPower: totalPowerMW.toFixed(1),
    },
    scalabilityMetrics: {
      scalabilityScore: Math.round(scalabilityScore),
      routingComplexity,
      surfaceCodeCompatibility: topology === "heavy-hex" || topology === "2d-grid" ? "High" : "Low",
    },
    validationMetrics: {
      architectureRanking: scalabilityScore > 80 ? "S-Tier" : scalabilityScore > 60 ? "A-Tier" : "B-Tier"
    }
  };
}

// --- MAIN PAGE ---
function ArchitectureExplorerPage() {

  const [technology, setTechnology] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('arch-technology') : null) || "transmon");
  const [topology, setTopology] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('arch-topology') : null) || "heavy-hex");
  const [coupler, setCoupler] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('arch-coupler') : null) || "fixed");
  const [numQubits, setNumQubits] = useState(() => parseInt((typeof window !== 'undefined' ? sessionStorage.getItem('arch-numQubits') : null) || "64"));
  const [frequency, setFrequency] = useState(() => parseFloat((typeof window !== 'undefined' ? sessionStorage.getItem('arch-frequency') : null) || "5.00"));
  const [lod, setLod] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('arch-lod') : null) || "balanced");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('arch-technology', technology);
    sessionStorage.setItem('arch-topology', topology);
    sessionStorage.setItem('arch-coupler', coupler);
    sessionStorage.setItem('arch-numQubits', numQubits.toString());
    sessionStorage.setItem('arch-frequency', frequency.toString());
    sessionStorage.setItem('arch-lod', lod);
  }, [technology, topology, coupler, numQubits, frequency, lod]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => generateArchitecture(technology, topology, coupler, numQubits), [technology, topology, coupler, numQubits]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge({ ...params, type: 'coupler', data: { coupler } }, eds)), [coupler, setEdges]);

  const metrics = useMemo(() => computeMetrics(nodes, edges, technology, topology, coupler, frequency, numQubits), [nodes, edges, technology, topology, coupler, frequency, numQubits]);

  const nodeTypes = useMemo(() => ({
    transmon: TransmonNode,
    'flux-qubit': FluxQubitNode,
    'charge-qubit': ChargeQubitNode,
    'phase-qubit': PhaseQubitNode,
    xmon: XmonNode,
    fluxonium: FluxoniumNode,
    gatemon: GatemonNode,
    readout: CustomReadoutNode
  }), []);
  const edgeTypes = useMemo(() => ({ coupler: CustomCouplerEdge }), []);

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50">
      <div className="mx-auto max-w-[1500px] px-4 py-4 flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Quantum Simulator</h1>
            <p className="text-sm text-slate-500 mt-1">Explore dynamically generated chip architectures and resource requirements.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-9 gap-2 text-slate-600 font-medium rounded-lg border-slate-200 shadow-sm" onClick={() => {
              localStorage.setItem('saved-quantum-architecture', JSON.stringify({ technology, topology, coupler, numQubits, frequency }));
              alert('Architecture configuration successfully saved!');
            }}>
              <Bookmark className="h-4 w-4" /> Save
            </Button>
            <Button variant="outline" className="h-9 gap-2 text-slate-600 font-medium rounded-lg border-slate-200 shadow-sm" onClick={() => {
              const report = `# Quantum Architecture Report

## Configuration
- Technology: ${technology}
- Topology: ${topology}
- Coupler: ${coupler}
- Qubit Count: ${numQubits}
- Target Frequency: ${frequency} GHz

## Top 20 Recommended Metrics
1. Total Qubits: ${metrics.architectureSummary?.qubits}
2. Coupler Count: ${metrics.architectureSummary?.couplers}
3. Connectivity Degree: ${metrics.architectureSummary?.averageConnectivity}
4. Chip Area: ${metrics.architectureSummary?.chipArea} mm²
5. Single-Qubit Fidelity: ${metrics.performanceMetrics?.singleQubitFidelity}%
6. Two-Qubit Fidelity: ${metrics.performanceMetrics?.twoQubitFidelity}%
7. Readout Fidelity: ${metrics.performanceMetrics?.readoutFidelity}%
8. T1 Time: ${metrics.reliabilityMetrics?.T1} µs
9. T2 Time: ${metrics.reliabilityMetrics?.T2} µs
10. Error Rate: ${metrics.reliabilityMetrics?.errorRate}%
11. Quantum Volume: ${metrics.performanceMetrics?.quantumVolume}
12. Crosstalk Risk: ${metrics.reliabilityMetrics?.crosstalkRisk}
13. Control Lines: ${metrics.resourceMetrics?.controlLines}
14. Readout Lines: ${metrics.resourceMetrics?.readoutLines}
15. Flux Lines: ${metrics.resourceMetrics?.dcFluxLines}
16. Power Consumption: ${metrics.resourceMetrics?.totalPower} mW
17. Cooling Load: ${metrics.resourceMetrics?.coolingLoad} µW
18. Routing Complexity: ${metrics.scalabilityMetrics?.routingComplexity}
19. Scalability Score: ${metrics.scalabilityMetrics?.scalabilityScore}/100
20. Overall Architecture Score: ${metrics.overallArchitectureScore}/100
`;
              const blob = new Blob([report], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `quantum-architecture-report.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </div>
        </div>

        {/* Top Controls Bar */}
        <Card className="rounded-md border border-slate-200 bg-white p-3 shadow-sm flex items-center justify-between gap-4">
          <div className="flex-1 grid grid-cols-6 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500">Technology</label>
              <Select value={technology} onValueChange={setTechnology}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transmon">Transmon</SelectItem>
                  <SelectItem value="flux-qubit">Flux Qubit</SelectItem>
                  <SelectItem value="charge-qubit">Charge Qubit</SelectItem>
                  <SelectItem value="phase-qubit">Phase Qubit</SelectItem>
                  <SelectItem value="xmon">Xmon</SelectItem>
                  <SelectItem value="fluxonium">Fluxonium</SelectItem>
                  <SelectItem value="gatemon">Gatemon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500">Target Qubits</label>
              <Input type="number" value={numQubits} onChange={(e) => setNumQubits(Number(e.target.value) || 1)} className="h-9 rounded-xl border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50/50" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">Topology <SafeTooltip message="Defines the connectivity pattern between qubits on the quantum chip. Topology affects routing complexity, gate execution efficiency, circuit depth, scalability, and overall hardware performance. Examples include Heavy-Hex, Grid, Linear Chain, and All-to-All connectivity."/></label>
              <Select value={topology} onValueChange={setTopology}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="ring">Ring</SelectItem>
                  <SelectItem value="2d-grid">2D Grid</SelectItem>
                  <SelectItem value="heavy-hex">Heavy-Hex</SelectItem>
                  <SelectItem value="all-to-all">All-to-All</SelectItem>
                  <SelectItem value="custom">Custom Graph</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">Qubit Frequency <SafeTooltip message="Represents the operating frequency of qubits, typically measured in GHz. Frequency influences qubit control, gate speed, resonance behavior, crosstalk, and overall device performance."/></label>
              <div className="relative">
                <Input type="number" step="0.01" value={frequency} onChange={(e) => setFrequency(Number(e.target.value) || 0)} className="h-9 rounded-xl border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50/50 pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">GHz</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">Coupler Type <SafeTooltip message="Specifies the mechanism used to connect and interact qubits. Different coupler types impact gate fidelity, interaction strength, tunability, noise characteristics, and hardware efficiency. Examples include Fixed Coupler, Tunable Coupler, Resonator Coupler, and Bus Coupler."/></label>
              <Select value={coupler} onValueChange={setCoupler}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="tunable">Tunable</SelectItem>
                  <SelectItem value="flux-tunable">Flux-Tunable</SelectItem>
                  <SelectItem value="resonator-bus">Resonator Bus</SelectItem>
                  <SelectItem value="inductive">Inductive</SelectItem>
                  <SelectItem value="cross-resonance">Cross-Resonance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">Level of Detail <SafeTooltip message="Controls the amount of architectural information displayed in the visualization. Higher detail levels show additional hardware parameters, connectivity information, performance metrics, and implementation-specific characteristics."/></label>
              <Select value={lod} onValueChange={setLod}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col justify-end pt-5 pl-6 border-l border-slate-100 shrink-0">
            <Button className="w-40 h-10 bg-[#5E43F3] hover:bg-[#4F36E3] text-white rounded-md text-sm font-bold shadow-md shadow-indigo-500/20">
              <RefreshCw className="h-4 w-4 mr-2" /> Live Reloading
            </Button>
            <span className="text-[10px] text-slate-400 font-medium mt-2 text-center">Instantly synced</span>
          </div>
        </Card>

        {/* Main Layout Grid */}
        <div className="grid grid-cols-12 gap-4 h-[800px]">
          
          {/* Main Visualizer (React Flow) */}
          <div className="col-span-8 flex flex-col gap-4">
            <Card className={`p-2 shadow-sm overflow-hidden relative transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none bg-slate-100 flex-1' : 'flex-1 rounded-md border border-slate-200 bg-slate-100'}`}>
              <div className="absolute inset-x-4 top-4 z-10 flex justify-between items-start pointer-events-none">
                <div className="flex gap-2 items-center pointer-events-auto">
                  <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200/50 shadow-sm">
                    <span className="text-xs font-semibold text-slate-700">Topology Canvas</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end pointer-events-auto">
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200/50 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-slate-700 capitalize">{technology}</span>
                  </div>
                </div>
              </div>
              <div className="w-full h-full bg-white rounded-md border border-slate-200/50 relative">
                <ReactFlow 
                   nodes={nodes} 
                   edges={edges} 
                   onNodesChange={onNodesChange}
                   onEdgesChange={onEdgesChange}
                   onConnect={onConnect}
                   nodeTypes={nodeTypes}
                   edgeTypes={edgeTypes}
                   fitView 
                   nodesDraggable={false}
                   nodesConnectable={false}
                   proOptions={{ hideAttribution: true }}
                   minZoom={0.1}
                   maxZoom={4.0}
                >
                   <Background color="#cbd5e1" gap={16} />
                   <Controls 
                     showInteractive={false} 
                     onFitView={() => setIsFullscreen(true)} 
                     position="top-left" 
                     orientation="horizontal"
                     style={{ marginTop: '60px', marginLeft: '2px' }}
                     className="scale-110 origin-top-left" 
                   />
                   {lod !== 'basic' && <MiniMap nodeColor="#5E43F3" maskColor="rgba(248, 250, 252, 0.7)" />}
                </ReactFlow>
              </div>
            </Card>
          </div>

          {/* Right Sidebar - Metrics & Resources */}
          <div className="col-span-4 flex flex-col gap-4">
            <Card className="rounded-md border border-slate-200 bg-white p-4 shadow-sm relative overflow-hidden">
              {/* Decorative Glows */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 flex items-center gap-2 uppercase tracking-widest">
                    Architecture Summary
                  </h2>
                  <div className="bg-slate-50 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-2 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Score</span>
                    <span className="text-sm font-black text-emerald-400">{metrics.overallArchitectureScore}/100</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 hover:bg-slate-100 transition-all hover:scale-[1.02] cursor-default shadow-sm">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Qubits</div>
                    <div className="text-2xl font-black text-slate-900 leading-tight">{metrics.architectureSummary?.qubits}</div>
                  </div>
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 hover:bg-slate-100 transition-all hover:scale-[1.02] cursor-default shadow-sm">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Couplers</div>
                    <div className="text-2xl font-black text-slate-900 leading-tight">{metrics.architectureSummary?.couplers}</div>
                  </div>
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 hover:bg-slate-100 transition-all hover:scale-[1.02] cursor-default shadow-sm">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Conn.</div>
                    <div className="text-2xl font-black text-slate-900 leading-tight">{metrics.architectureSummary?.averageConnectivity}</div>
                  </div>
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 hover:bg-slate-100 transition-all hover:scale-[1.02] cursor-default shadow-sm">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Area (mm²)</div>
                    <div className="text-2xl font-black text-slate-900 leading-tight">{metrics.architectureSummary?.chipArea}</div>
                  </div>
                </div>

                {(lod === 'balanced' || lod === 'detailed') && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-[11px] font-bold text-indigo-400/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                        Performance & Reliability
                      </h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">1Q Fidelity</span>
                          <span className="text-xs font-bold text-emerald-400">{metrics.performanceMetrics?.singleQubitFidelity}%</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">2Q Fidelity</span>
                          <span className="text-xs font-bold text-emerald-400">{metrics.performanceMetrics?.twoQubitFidelity}%</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">Readout Fidelity</span>
                          <span className="text-xs font-bold text-emerald-400">{metrics.performanceMetrics?.readoutFidelity}%</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">Quantum Volume</span>
                          <span className="text-xs font-bold text-indigo-400">{metrics.performanceMetrics?.quantumVolume}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">T1 Time</span>
                          <span className="text-xs font-bold text-slate-900">{metrics.reliabilityMetrics?.T1} µs</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">T2 Time</span>
                          <span className="text-xs font-bold text-slate-900">{metrics.reliabilityMetrics?.T2} µs</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">Error Rate</span>
                          <span className="text-xs font-bold text-rose-400">{metrics.reliabilityMetrics?.errorRate}%</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[11px] font-bold text-cyan-400/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                        Hardware Resources
                      </h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">Control Lines</span>
                          <span className="text-xs font-bold text-slate-900 bg-white px-2 rounded border border-slate-200 shadow-sm">{metrics.resourceMetrics?.controlLines}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">Flux Lines</span>
                          <span className="text-xs font-bold text-slate-900 bg-white px-2 rounded border border-slate-200 shadow-sm">{metrics.resourceMetrics?.dcFluxLines}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">Readout Lines</span>
                          <span className="text-xs font-bold text-slate-900 bg-white px-2 rounded border border-slate-200 shadow-sm">{metrics.resourceMetrics?.readoutLines}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">Cooling Load</span>
                          <span className="text-xs font-bold text-cyan-400">{metrics.resourceMetrics?.coolingLoad} µW</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs font-medium text-slate-500">Total Power</span>
                          <span className="text-xs font-bold text-amber-400">{metrics.resourceMetrics?.totalPower} mW</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {lod === 'detailed' && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h3 className="text-[11px] font-bold text-rose-400/80 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                      Scalability & Validation
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-slate-500 uppercase">Routing Complexity</span>
                        <span className="text-xs font-bold text-slate-900">{metrics.scalabilityMetrics?.routingComplexity}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-slate-500 uppercase">Crosstalk Risk</span>
                        <span className={`text-xs font-bold ${metrics.reliabilityMetrics?.crosstalkRisk === 'High' ? 'text-rose-400' : 'text-emerald-400'}`}>{metrics.reliabilityMetrics?.crosstalkRisk}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-slate-500 uppercase">Surface Code</span>
                        <span className="text-xs font-bold text-slate-900">{metrics.scalabilityMetrics?.surfaceCodeCompatibility}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-slate-500 uppercase">Architecture Ranking</span>
                        <span className="text-xs font-bold text-indigo-300">{metrics.validationMetrics?.architectureRanking}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 mb-6">
                      <span className="text-[10px] font-medium text-slate-500 uppercase flex justify-between">
                        <span>Scalability Score</span>
                        <span className="text-slate-900">{metrics.scalabilityMetrics?.scalabilityScore}/100</span>
                      </span>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${metrics.scalabilityMetrics?.scalabilityScore}%` }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
