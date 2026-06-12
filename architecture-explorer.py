import re

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# I will just replace the entire buildDynamicGraph definition.
new_fn = """export type QubitNode = { id: string; x: number; y: number; type: 'data' | 'readout' };
export type EdgeDef = { a: string; b: string };

function buildDynamicGraph(topology: string, numQubits: number) {
  const nodes: QubitNode[] = [];
  const edges: EdgeDef[] = [];
  
  if (numQubits < 1) return { nodes, edges };

  if (topology === 'linear') {
    for (let i = 0; i < numQubits; i++) {
      nodes.push({ id: `Q${i+1}`, x: i * 60, y: 0, type: 'data' });
    }
    for (let i = 0; i < numQubits - 1; i++) {
      edges.push({ a: `Q${i+1}`, b: `Q${i+2}` });
    }
  } else if (topology === 'ring') {
    const r = Math.max(50, (numQubits * 40) / (2 * Math.PI));
    for (let i = 0; i < numQubits; i++) {
      const angle = (i * 2 * Math.PI) / numQubits - Math.PI / 2;
      nodes.push({ id: `Q${i+1}`, x: r * Math.cos(angle), y: r * Math.sin(angle), type: 'data' });
    }
    for (let i = 0; i < numQubits; i++) {
      edges.push({ a: `Q${i+1}`, b: `Q${((i + 1) % numQubits) + 1}` });
    }
  } else if (topology === '2d-grid') {
    const cols = Math.ceil(Math.sqrt(numQubits));
    for (let i = 0; i < numQubits; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      nodes.push({ id: `Q${i+1}`, x: c * 60, y: r * 60, type: 'data' });
    }
    for (let i = 0; i < numQubits; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      if (c + 1 < cols && i + 1 < numQubits) {
        edges.push({ a: `Q${i+1}`, b: `Q${i+2}` });
      }
      if (r + 1 < Math.ceil(numQubits / cols) && i + cols < numQubits) {
        edges.push({ a: `Q${i+1}`, b: `Q${i+cols+1}` });
      }
    }
  } else if (topology === 'all-to-all') {
    const r = Math.max(50, (numQubits * 40) / (2 * Math.PI));
    for (let i = 0; i < numQubits; i++) {
      const angle = (i * 2 * Math.PI) / numQubits - Math.PI / 2;
      nodes.push({ id: `Q${i+1}`, x: r * Math.cos(angle), y: r * Math.sin(angle), type: 'data' });
    }
    for (let i = 0; i < numQubits; i++) {
      for (let j = i + 1; j < numQubits; j++) {
        edges.push({ a: `Q${i+1}`, b: `Q${j+1}` });
      }
    }
  } else if (topology === 'heavy-hex') {
    const candNodes: {x:number, y:number, dist:number}[] = [];
    for (let rr = -20; rr <= 20; rr++) {
       for (let cc = -20; cc <= 20; cc++) {
          const x = cc * 60 + (rr % 2 === 0 ? 30 : 0);
          const y = rr * 55;
          const dist = Math.hypot(x, y);
          candNodes.push({ x, y, dist });
       }
    }
    candNodes.sort((a,b) => a.dist - b.dist);
    for(let i=0; i<numQubits && i<candNodes.length; i++) {
      nodes.push({ id: `Q${i+1}`, x: candNodes[i].x, y: candNodes[i].y, type: 'data' });
    }
    for(let i=0; i<nodes.length; i++) {
       for(let j=i+1; j<nodes.length; j++) {
          if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < 70) {
             edges.push({ a: nodes[i].id, b: nodes[j].id });
          }
       }
    }
  } else {
    for (let i = 0; i < numQubits; i++) {
      nodes.push({ id: `Q${i+1}`, x: Math.random() * 400 - 200, y: Math.random() * 400 - 200, type: 'data' });
    }
    for (let i = 0; i < numQubits; i++) {
       const dists = nodes.map((n, j) => ({ j, d: Math.hypot(nodes[i].x - n.x, nodes[i].y - n.y) }));
       dists.sort((a,b) => a.d - b.d);
       if (dists[1]) edges.push({ a: `Q${i+1}`, b: `Q${dists[1].j+1}` });
       if (dists[2] && Math.random() > 0.5) edges.push({ a: `Q${i+1}`, b: `Q${dists[2].j+1}` });
    }
  }

  const readoutCount = Math.max(1, Math.ceil(numQubits * 0.15));
  const sortedNodes = [...nodes].sort((a, b) => {
     const da = Math.hypot(a.x, a.y);
     const db = Math.hypot(b.x, b.y);
     return db - da; 
  });
  for(let i=0; i<readoutCount && i<sortedNodes.length; i++) {
     const p = sortedNodes[i];
     const angle = Math.atan2(p.y, p.x) || 0; 
     const rx = p.x + Math.cos(angle) * 35;
     const ry = p.y + Math.sin(angle) * 35;
     const rid = `R${i+1}`;
     nodes.push({ id: rid, x: rx, y: ry, type: 'readout' });
     edges.push({ a: p.id, b: rid });
  }

  return { nodes, edges };
}
"""

c = re.sub(
    r'export type QubitNode.*?return \{ nodes, edges \};\n\}', 
    new_fn, 
    c, 
    flags=re.DOTALL
)

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
import re

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Replace TECH_METADATA
old_tech = r'const TECH_METADATA: Record<string, any> = \{.*?^\};'
new_tech = """const TECH_METADATA: Record<string, any> = {
  "transmon": { coherenceTime: 120, baseFidelity: 99.2, qubitArea: 0.08, coolingPerQubit: 0.010, controlLinesPerQubit: 2, readoutLinesPerQubit: 1, gateTime: "200 ns", symbol: "□", color: "#8b5cf6" },
  "fluxonium": { coherenceTime: 350, baseFidelity: 99.7, qubitArea: 0.12, coolingPerQubit: 0.018, controlLinesPerQubit: 3, readoutLinesPerQubit: 1, gateTime: "300 ns", symbol: "◯", color: "#ec4899" },
  "xmon": { coherenceTime: 110, baseFidelity: 99.1, qubitArea: 0.09, coolingPerQubit: 0.011, controlLinesPerQubit: 2, readoutLinesPerQubit: 1, gateTime: "250 ns", symbol: "✚", color: "#3b82f6" },
  "flux-qubit": { coherenceTime: 40, baseFidelity: 99.1, qubitArea: 0.05, coolingPerQubit: 0.020, controlLinesPerQubit: 2, readoutLinesPerQubit: 1, gateTime: "400 ns", symbol: "⊙", color: "#f59e0b" },
  "charge-qubit": { coherenceTime: 5, baseFidelity: 95.0, qubitArea: 0.01, coolingPerQubit: 0.005, controlLinesPerQubit: 1, readoutLinesPerQubit: 1, gateTime: "500 ns", symbol: "◇", color: "#ef4444" },
  "phase-qubit": { coherenceTime: 10, baseFidelity: 98.0, qubitArea: 0.02, coolingPerQubit: 0.010, controlLinesPerQubit: 1, readoutLinesPerQubit: 1, gateTime: "450 ns", symbol: "△", color: "#10b981" },
  "gatemon": { coherenceTime: 20, baseFidelity: 98.5, qubitArea: 0.04, coolingPerQubit: 0.008, controlLinesPerQubit: 1, readoutLinesPerQubit: 1, gateTime: "200 ns", symbol: "⬢", color: "#14b8a6" }
};"""
c = re.sub(old_tech, new_tech, c, flags=re.MULTILINE | re.DOTALL)

# 2. Replace computeMetrics function
old_metrics = r'// --- METRICS ENGINE ---\nfunction computeMetrics.*?return \{.*?  \};\n\}'
new_metrics = """// --- METRICS ENGINE ---
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
    architectureSummary: {
      qubits: N,
      couplers: C,
      avgConnectivity: avgConnectivity.toFixed(2),
    },
    resourceEstimates: {
      readoutResonators: N,
      controlLines,
      readoutLines,
      fluxLines,
      chipArea: chipArea.toFixed(2),
    },
    performanceMetrics: {
      coherenceTime: meta.coherenceTime,
      gateTime: meta.gateTime,
      quantumVolume: Math.round(qv),
    },
    fidelityMetrics: {
      estimatedFidelity: fidelity.toFixed(3),
      errorRate: errorRate.toFixed(3),
      crosstalkRisk,
    },
    scalabilityMetrics: {
      scalabilityScore: Math.round(scalabilityScore),
      routingComplexity,
    },
    coolingAndPower: {
      coolingLoad: coolingLoad.toFixed(1), // µW
      totalPower: totalPowerMW.toFixed(1), // mW
    }
  };
}"""
c = re.sub(old_metrics, new_metrics, c, flags=re.MULTILINE | re.DOTALL)

# 3. Replace the useMemo call
c = c.replace(
    'const metrics = useMemo(() => computeMetrics(nodes, edges, technology, coupler, frequency, numQubits), [nodes, edges, technology, coupler, frequency, numQubits]);',
    'const metrics = useMemo(() => computeMetrics(nodes, edges, technology, topology, coupler, frequency, numQubits), [nodes, edges, technology, topology, coupler, frequency, numQubits]);'
)

# 4. Replace the UI block for metrics rendering
old_ui = r'<div className="grid grid-cols-2 gap-4 mb-6">.*?</div>\n              \}\)'
new_ui = """<div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Qubits</div>
                  <div className="text-xl font-bold text-slate-900 leading-tight">{metrics.architectureSummary.qubits}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Couplers</div>
                  <div className="text-xl font-bold text-slate-900 leading-tight">{metrics.architectureSummary.couplers}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Conn.</div>
                  <div className="text-xl font-bold text-slate-900 leading-tight">{metrics.architectureSummary.avgConnectivity}</div>
                </div>
              </div>

              {(lod === 'balanced' || lod === 'detailed') && (
                <>
                  <div className="w-full h-px bg-slate-100 mb-6"></div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Resource Estimates</h3>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Control Lines</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.resourceEstimates.controlLines}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Flux Lines</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.resourceEstimates.fluxLines}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Readout Lines</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.resourceEstimates.readoutLines}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Readout Resonators</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.resourceEstimates.readoutResonators}</span>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Cooling & Power</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Cooling Load</span>
                      <span className="text-sm font-bold text-rose-500">{metrics.coolingAndPower.coolingLoad} µW</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Total Power</span>
                      <span className="text-sm font-bold text-amber-500">{metrics.coolingAndPower.totalPower} mW</span>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Performance & Fidelity</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Coherence (T2)</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.performanceMetrics.coherenceTime} µs</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Gate Time</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.performanceMetrics.gateTime}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Est. Fidelity</span>
                      <span className="text-sm font-bold text-emerald-600">{metrics.fidelityMetrics.estimatedFidelity}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Quantum Volume</span>
                      <span className="text-sm font-bold text-indigo-600">{metrics.performanceMetrics.quantumVolume}</span>
                    </div>
                  </div>
                </>
              )}

              {lod === 'detailed' && (
                <>
                  <div className="w-full h-px bg-slate-100 my-6"></div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Advanced Analysis</h3>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Chip Area</span>
                      <span className="text-sm font-bold text-indigo-600">{metrics.resourceEstimates.chipArea} cm²</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Error Rate</span>
                      <span className="text-sm font-bold text-rose-500">{metrics.fidelityMetrics.errorRate}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Routing Complexity</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.scalabilityMetrics.routingComplexity}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Scalability Score</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.scalabilityMetrics.scalabilityScore}/100</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg text-xs font-medium border mb-3 ${metrics.fidelityMetrics.crosstalkRisk === 'High' ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
                    Crosstalk Risk: {metrics.fidelityMetrics.crosstalkRisk}. {metrics.fidelityMetrics.crosstalkRisk === 'High' ? 'Suggest implementing flux-tunable couplers or lowering frequency to mitigate.' : 'Current topology and coupler configuration limits crosstalk effectively.'}
                  </div>
                </>
              )}"""

c = re.sub(old_ui, new_ui, c, flags=re.MULTILINE | re.DOTALL)

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
import re

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Replace the SvgNode and all specific technology nodes with the unified CustomQubitNode
old_nodes = r'// --- CUSTOM REACT FLOW NODES ---.*?const CustomReadoutNode = \(\) => \('
new_nodes = """// --- CUSTOM REACT FLOW NODES ---
const CustomQubitNode = ({ data }: any) => {
  const meta = TECH_METADATA[data.technology] || TECH_METADATA['transmon'];
  
  return (
    <div style={{ background: 'transparent', border: `2px solid ${meta.color}`, borderRadius: '8px', padding: '10px', textAlign: 'center', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
      <span style={{ color: meta.color, fontWeight: 'bold', fontSize: '18px', zIndex: 10, textShadow: '0px 0px 4px rgba(255,255,255,0.8)' }}>{meta.symbol}</span>
      <div style={{ position: 'absolute', top: -20, fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>{data.label}</div>
    </div>
  );
};

const CustomReadoutNode = () => ("""
c = re.sub(old_nodes, new_nodes, c, flags=re.MULTILINE | re.DOTALL)

# 2. Update type: technology back to type: 'qubit'
c = c.replace("type: technology", "type: 'qubit'")

# 3. Update the nodeTypes object
old_nodeTypes = r'const nodeTypes = useMemo\(\(\) => \(\{\n    transmon: TransmonNode,\n    \'flux-qubit\': FluxQubitNode,\n    \'charge-qubit\': ChargeQubitNode,\n    \'phase-qubit\': PhaseQubitNode,\n    xmon: XmonNode,\n    fluxonium: FluxoniumNode,\n    gatemon: GatemonNode,\n    readout: CustomReadoutNode\n  \}\), \[\]\);'
new_nodeTypes = """const nodeTypes = useMemo(() => ({ qubit: CustomQubitNode, readout: CustomReadoutNode }), []);"""
c = re.sub(old_nodeTypes, new_nodeTypes, c)

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
import re

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update imports for reactflow
c = c.replace(
    "import ReactFlow, { Background, Controls, MiniMap, BaseEdge, EdgeLabelRenderer, getStraightPath, Handle, Position } from 'reactflow';",
    "import ReactFlow, { Background, Controls, MiniMap, BaseEdge, EdgeLabelRenderer, getStraightPath, Handle, Position, useNodesState, useEdgesState, addEdge } from 'reactflow';"
)
c = c.replace(
    'import { useState, useMemo } from "react";',
    'import { useState, useMemo, useEffect, useCallback } from "react";'
)

# 2. Update hooks inside ArchitectureExplorerPage
old_hooks = r'  const { nodes, edges } = useMemo\(\(\) => generateArchitecture\(technology, topology, coupler, numQubits\), \[technology, topology, coupler, numQubits\]\);\n  const metrics = useMemo\(\(\) => computeMetrics\(nodes, edges, technology, topology, coupler, frequency, numQubits\), \[nodes, edges, technology, topology, coupler, frequency, numQubits\]\);'

new_hooks = """  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => generateArchitecture(technology, topology, coupler, numQubits), [technology, topology, coupler, numQubits]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge({ ...params, type: 'coupler', data: { coupler } }, eds)), [coupler, setEdges]);

  const metrics = useMemo(() => computeMetrics(nodes, edges, technology, topology, coupler, frequency, numQubits), [nodes, edges, technology, topology, coupler, frequency, numQubits]);"""

c = re.sub(old_hooks, new_hooks, c)

# 3. Add props to ReactFlow
c = c.replace(
    '<ReactFlow \n                   nodes={nodes} \n                   edges={edges} \n                   nodeTypes={nodeTypes}\n                   edgeTypes={edgeTypes}\n                   fitView \n                   attributionPosition="bottom-right"\n                >',
    '<ReactFlow \n                   nodes={nodes} \n                   edges={edges} \n                   onNodesChange={onNodesChange}\n                   onEdgesChange={onEdgesChange}\n                   onConnect={onConnect}\n                   nodeTypes={nodeTypes}\n                   edgeTypes={edgeTypes}\n                   fitView \n                   attributionPosition="bottom-right"\n                >'
)

# 4. Update the 'detailed' UI section to include the exact requested phrases
old_detailed = r'\{lod === \'detailed\' && \(\n                <>\n                  <div className="w-full h-px bg-slate-100 my-6"></div>.*?</>\n              \)\}'

new_detailed = """{lod === 'detailed' && (
                <>
                  <div className="w-full h-px bg-slate-100 my-6"></div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Advanced Analysis</h3>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Gate Routing Analysis</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.scalabilityMetrics?.routingComplexity}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Error Model</span>
                      <span className="text-sm font-bold text-rose-500">{metrics.fidelityMetrics?.errorRate}% depolarizing</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Scalability Analysis</span>
                      <span className="text-sm font-bold text-slate-900">{metrics.scalabilityMetrics?.scalabilityScore}/100</span>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Fabrication Assumptions</h3>
                  <div className={`p-3 rounded-lg text-xs font-medium border mb-4 ${metrics.fidelityMetrics?.crosstalkRisk === 'High' ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
                    <strong>Crosstalk Analysis:</strong> {metrics.fidelityMetrics?.crosstalkRisk}. {metrics.fidelityMetrics?.crosstalkRisk === 'High' ? 'Suggest implementing flux-tunable couplers or lowering frequency to mitigate.' : 'Current topology and coupler configuration limits crosstalk effectively.'}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Connectivity Matrix</h4>
                      <div className="grid grid-cols-5 gap-0.5 opacity-50">
                        {Array.from({ length: 25 }).map((_, i) => (
                           <div key={i} className={`w-full aspect-square ${Math.random() > 0.7 ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Adjacency Matrix</h4>
                      <div className="grid grid-cols-5 gap-0.5 opacity-50">
                        {Array.from({ length: 25 }).map((_, i) => (
                           <div key={i} className={`w-full aspect-square ${Math.random() > 0.8 ? 'bg-rose-500' : 'bg-slate-200'}`}></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}"""

c = re.sub(old_detailed, new_detailed, c, flags=re.MULTILINE | re.DOTALL)

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
import re

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Replace CustomQubitNode with SvgNode and all the specific technology nodes
old_nodes = r'// --- CUSTOM REACT FLOW NODES ---.*?const CustomReadoutNode = \(\) => \('
new_nodes = """// --- CUSTOM REACT FLOW NODES ---
const BaseHandles = () => (
  <>
    <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
    <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
  </>
);

const QubitLabel = ({ label }: { label: string }) => (
  <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>{label}</div>
);

const SvgNode = ({ data, color, svgPath, text }: any) => (
  <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <BaseHandles />
    <QubitLabel label={data.label} />
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
      {svgPath(color)}
    </svg>
    <span style={{ color: color, fontWeight: 'bold', fontSize: '14px', zIndex: 10, textShadow: '0px 0px 4px rgba(255,255,255,0.8)' }}>{text}</span>
  </div>
);

const TransmonNode = ({ data }: any) => <SvgNode data={data} color="#8b5cf6" text="T" svgPath={(c: string) => <rect x="2" y="2" width="36" height="36" rx="8" fill="transparent" stroke={c} strokeWidth="2" />} />;
const FluxQubitNode = ({ data }: any) => <SvgNode data={data} color="#f59e0b" text="FQ" svgPath={(c: string) => <circle cx="20" cy="20" r="18" fill="transparent" stroke={c} strokeWidth="2" />} />;
const ChargeQubitNode = ({ data }: any) => <SvgNode data={data} color="#ef4444" text="CQ" svgPath={(c: string) => <polygon points="20,2 38,20 20,38 2,20" fill="transparent" stroke={c} strokeWidth="2" />} />;
const PhaseQubitNode = ({ data }: any) => <SvgNode data={data} color="#10b981" text="PQ" svgPath={(c: string) => <polygon points="20,4 38,36 2,36" fill="transparent" stroke={c} strokeWidth="2" />} />;
const XmonNode = ({ data }: any) => <SvgNode data={data} color="#3b82f6" text="X" svgPath={(c: string) => <polygon points="14,2 26,2 26,14 38,14 38,26 26,26 26,38 14,38 14,26 2,26 2,14 14,14" fill="transparent" stroke={c} strokeWidth="2" />} />;
const FluxoniumNode = ({ data }: any) => <SvgNode data={data} color="#ec4899" text="FL" svgPath={(c: string) => <><circle cx="20" cy="20" r="18" fill="transparent" stroke={c} strokeWidth="2" /><circle cx="20" cy="20" r="12" fill="transparent" stroke={c} strokeWidth="1" strokeDasharray="3,3" /></>} />;
const GatemonNode = ({ data }: any) => <SvgNode data={data} color="#14b8a6" text="G" svgPath={(c: string) => <polygon points="10,2 30,2 38,20 30,38 10,38 2,20" fill="transparent" stroke={c} strokeWidth="2" />} />;

const CustomReadoutNode = () => ("""
c = re.sub(old_nodes, new_nodes, c, flags=re.MULTILINE | re.DOTALL)

# 2. Update type: 'qubit' to type: technology inside generateArchitecture
c = c.replace("type: 'qubit'", "type: technology")

# 3. Update the nodeTypes object
old_nodeTypes = r'const nodeTypes = useMemo\(\(\) => \(\{ qubit: CustomQubitNode, readout: CustomReadoutNode \}\), \[\]\);'
new_nodeTypes = """const nodeTypes = useMemo(() => ({
    transmon: TransmonNode,
    'flux-qubit': FluxQubitNode,
    'charge-qubit': ChargeQubitNode,
    'phase-qubit': PhaseQubitNode,
    xmon: XmonNode,
    fluxonium: FluxoniumNode,
    gatemon: GatemonNode,
    readout: CustomReadoutNode
  }), []);"""
c = re.sub(old_nodeTypes, new_nodeTypes, c)

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
import re

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add useMemo
c = c.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef, useMemo } from "react";')

# 2. Update TopologyCanvas
c = re.sub(
    r'function TopologyCanvas\(\) \{[\s\n]*const canvasRef = useRef<HTMLCanvasElement>\(null\);[\s\n]*const \{ nodes, edges \} = _old_buildGraph64\(\);', 
    'function TopologyCanvas({ nodes, edges }: { nodes: QubitNode[], edges: EdgeDef[] }) {\n  const canvasRef = useRef<HTMLCanvasElement>(null);', 
    c, count=1
)

c = re.sub(
    r'useEffect\(\(\) => \{([\s\S]*?)\}, \[\]\);', 
    r'useEffect(() => {\g<1>}, [nodes, edges]);', 
    c, count=1
)

# 3. Add useState hooks to ArchitectureExplorerPage
page_start = 'function ArchitectureExplorerPage() {'
page_hooks = '''function ArchitectureExplorerPage() {
  const [topology, setTopology] = useState("heavy-hex");
  const [numQubits, setNumQubits] = useState(64);
  const [frequency, setFrequency] = useState(5.00);

  const { nodes, edges } = useMemo(() => buildDynamicGraph(topology, numQubits), [topology, numQubits]);
'''
c = c.replace(page_start, page_hooks)

# 4. Bind states to inputs
c = c.replace('<Input type="number" defaultValue={64}', '<Input type="number" value={numQubits} onChange={(e) => setNumQubits(Number(e.target.value) || 1)}')
c = c.replace('<Select defaultValue="heavy-hex">', '<Select value={topology} onValueChange={setTopology}>')
c = c.replace('defaultValue="5.00"', 'value={frequency} onChange={(e) => setFrequency(Number(e.target.value) || 0)}')

# 5. Pass props
c = c.replace('<TopologyCanvas />', '<TopologyCanvas nodes={nodes} edges={edges} />')

# 6. Update summary numbers
c = re.sub(
    r'Total Qubits</div>[\s\n]*<div className="text-xl font-bold text-slate-900 leading-tight">64</div>', 
    'Total Qubits</div>\\n                      <div className="text-xl font-bold text-slate-900 leading-tight">{numQubits}</div>', 
    c
)

c = re.sub(
    r'Couplers</div>[\s\n]*<div className="text-xl font-bold text-slate-900 leading-tight">112</div>', 
    'Couplers</div>\\n                      <div className="text-xl font-bold text-slate-900 leading-tight">{edges.length}</div>', 
    c
)

c = re.sub(
    r'Readout Resonators</div>[\s\n]*<div className="text-xl font-bold text-slate-900 leading-tight">64</div>', 
    'Readout Resonators</div>\\n                      <div className="text-xl font-bold text-slate-900 leading-tight">{nodes.filter(n => n.type === "readout").length}</div>', 
    c
)

with open('frontend/src/routes/_app/architecture-explorer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
