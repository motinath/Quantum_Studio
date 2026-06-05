import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Network, Cpu, Zap, Circle, GitBranch, LayoutGrid,
  RefreshCw, Download, Info, ChevronRight, Layers,
} from "lucide-react";
import { useDesign } from "@/lib/design-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/architecture-explorer")({
  head: () => ({ meta: [{ title: "Architecture Explorer — Silicofeller" }] }),
  component: ArchitectureExplorerPage,
});

const TOPOLOGY_PRESETS = [
  {
    id: "heavy-hex",
    name: "Heavy Hex",
    description: "IBM-style heavy-hexagonal lattice. Max 3 neighbors per qubit. Optimal for surface-code error correction.",
    qubits: 27,
    couplers: 28,
    avg_degree: 2.1,
    color: "#7C3AED",
  },
  {
    id: "surface-code",
    name: "Surface Code",
    description: "2D square lattice. Each data qubit couples to 4 neighbors. Standard for fault-tolerant QEC.",
    qubits: 49,
    couplers: 72,
    avg_degree: 2.9,
    color: "#2563EB",
  },
  {
    id: "ring",
    name: "Ring",
    description: "Circular qubit chain. Simple, low crosstalk. Used for small demonstrations and noise benchmarking.",
    qubits: 9,
    couplers: 9,
    avg_degree: 2.0,
    color: "#059669",
  },
  {
    id: "linear",
    name: "Linear Chain",
    description: "Nearest-neighbor 1D chain. Lowest connectivity overhead. Common for NISQ variational algorithms.",
    qubits: 7,
    couplers: 6,
    avg_degree: 1.7,
    color: "#D97706",
  },
  {
    id: "all-to-all",
    name: "All-to-All",
    description: "Every qubit connected to every other. Maximum connectivity but highest crosstalk and routing complexity.",
    qubits: 6,
    couplers: 15,
    avg_degree: 5.0,
    color: "#DC2626",
  },
  {
    id: "star",
    name: "Star / Hub",
    description: "Central bus qubit coupled to all others. Used in early cQED architectures and cross-resonance gates.",
    qubits: 7,
    couplers: 6,
    avg_degree: 1.7,
    color: "#7C3AED",
  },
];

type QubitNode = { id: string; x: number; y: number; type: "data" | "ancilla" | "readout" };
type EdgeDef  = { a: string; b: string };

function buildGraph(topologyId: string): { nodes: QubitNode[]; edges: EdgeDef[] } {
  const nodes: QubitNode[] = [];
  const edges: EdgeDef[]   = [];

  const cx = 300, cy = 230, r = 160;

  if (topologyId === "ring") {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      nodes.push({ id: `Q${i}`, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), type: "data" });
    }
    for (let i = 0; i < n; i++) edges.push({ a: `Q${i}`, b: `Q${(i + 1) % n}` });
    return { nodes, edges };
  }

  if (topologyId === "linear") {
    for (let i = 0; i < 7; i++) {
      nodes.push({ id: `Q${i}`, x: 60 + i * 80, y: cy, type: "data" });
    }
    for (let i = 0; i < 6; i++) edges.push({ a: `Q${i}`, b: `Q${i + 1}` });
    return { nodes, edges };
  }

  if (topologyId === "star") {
    nodes.push({ id: "Q0", x: cx, y: cy, type: "ancilla" });
    for (let i = 1; i <= 6; i++) {
      const angle = (2 * Math.PI * (i - 1)) / 6 - Math.PI / 2;
      nodes.push({ id: `Q${i}`, x: cx + r * 0.8 * Math.cos(angle), y: cy + r * 0.8 * Math.sin(angle), type: "data" });
      edges.push({ a: "Q0", b: `Q${i}` });
    }
    return { nodes, edges };
  }

  if (topologyId === "all-to-all") {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      nodes.push({ id: `Q${i}`, x: cx + r * 0.7 * Math.cos(angle), y: cy + r * 0.7 * Math.sin(angle), type: "data" });
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        edges.push({ a: `Q${i}`, b: `Q${j}` });
    return { nodes, edges };
  }

  if (topologyId === "surface-code") {
    const cols = 7, rows = 7;
    for (let r2 = 0; r2 < rows; r2++) {
      for (let c = 0; c < cols; c++) {
        const id = `Q${r2 * cols + c}`;
        nodes.push({ id, x: 50 + c * 70, y: 50 + r2 * 60, type: r2 % 2 === c % 2 ? "data" : "ancilla" });
      }
    }
    for (let r2 = 0; r2 < rows; r2++) {
      for (let c = 0; c < cols; c++) {
        const i = r2 * cols + c;
        if (c + 1 < cols) edges.push({ a: `Q${i}`, b: `Q${i + 1}` });
        if (r2 + 1 < rows) edges.push({ a: `Q${i}`, b: `Q${i + cols}` });
      }
    }
    return { nodes, edges };
  }

  // Heavy-hex (27Q)
  const positions: [number, number][] = [
    [1,0],[2,0],[3,0],[4,0],[5,0],
    [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],
    [1,2],[2,2],[3,2],[4,2],[5,2],
    [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
    [1,4],[2,4],[3,4],
  ];
  positions.forEach(([c, row], i) => {
    nodes.push({ id: `Q${i}`, x: 40 + c * 75, y: 40 + row * 75, type: i % 3 === 1 ? "ancilla" : "data" });
  });
  const hexEdges = [
    [0,1],[1,2],[2,3],[3,4],
    [5,6],[6,7],[7,8],[8,9],[9,10],[10,11],
    [12,13],[13,14],[14,15],[15,16],
    [17,18],[18,19],[19,20],[20,21],[21,22],[22,23],
    [24,25],[25,26],
    [0,6],[1,7],[2,8],[3,9],[4,10],
    [6,12],[7,13],[8,14],[9,15],[10,16],
    [12,18],[13,19],[14,20],[15,21],[16,22],
    [18,24],[19,25],[20,26],
  ];
  hexEdges.forEach(([a, b]) => edges.push({ a: `Q${a}`, b: `Q${b}` }));
  return { nodes, edges };
}

function TopologyCanvas({ topologyId, color }: { topologyId: string; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const { nodes, edges } = buildGraph(topologyId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = 600 * dpr;
    canvas.height = 460 * dpr;
    canvas.style.width  = "600px";
    canvas.style.height = "460px";
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, 600, 460);

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 600; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 460); ctx.stroke(); }
    for (let y = 0; y < 460; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke(); }

    const posMap: Record<string, { x: number; y: number }> = {};
    nodes.forEach(n => { posMap[n.id] = { x: n.x, y: n.y }; });

    // edges
    edges.forEach(e => {
      const p1 = posMap[e.a], p2 = posMap[e.b];
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.strokeStyle = hovered === e.a || hovered === e.b ? color : "rgba(100,116,139,0.5)";
      ctx.lineWidth = hovered === e.a || hovered === e.b ? 2.5 : 1.5;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    // nodes
    nodes.forEach(n => {
      const isHovered = hovered === n.id;
      if (isHovered) {
        const grad = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, 22);
        grad.addColorStop(0, color + "44");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(n.x, n.y, 22, 0, 2 * Math.PI); ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, isHovered ? 12 : 9, 0, 2 * Math.PI);
      ctx.fillStyle = n.type === "ancilla" ? "#E2E8F0" : "#fff";
      ctx.strokeStyle = isHovered ? color : (n.type === "ancilla" ? "#94A3B8" : color);
      ctx.lineWidth = isHovered ? 3 : 1.8;
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = isHovered ? color : "#475569";
      ctx.font = `bold ${isHovered ? 8 : 7}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.id, n.x, n.y);
    });
  }, [topologyId, hovered, color, nodes, edges]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const found = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < 14);
    setHovered(found?.id ?? null);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(null)}
      className="rounded-2xl border border-slate-200 cursor-crosshair w-full"
      style={{ maxWidth: 600 }}
    />
  );
}

function ArchitectureExplorerPage() {
  const { activeConversation } = useDesign();
  const [selected, setSelected] = useState("heavy-hex");
  const [compareMode, setCompareMode] = useState(false);
  const [compareWith, setCompareWith] = useState("surface-code");

  const primary   = TOPOLOGY_PRESETS.find(t => t.id === selected)!;
  const secondary = TOPOLOGY_PRESETS.find(t => t.id === compareWith)!;

  const activeTopology = activeConversation?.result?.topology?.toLowerCase().replace(" ", "-") ?? null;

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FB]">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent-soft border border-accent/10 flex items-center justify-center">
                <Network className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Architecture Explorer</h1>
                <p className="text-sm text-slate-500">Compare topologies · Inspect connectivity · Drill to layout</p>
              </div>
            </div>
            <Button
              variant={compareMode ? "default" : "outline"}
              onClick={() => setCompareMode(v => !v)}
              className={cn("rounded-xl text-xs font-bold h-9", compareMode && "bg-accent text-white border-accent")}
            >
              <GitBranch className="h-3.5 w-3.5 mr-1.5" />
              {compareMode ? "Exit Compare" : "Compare Mode"}
            </Button>
          </div>
        </motion.div>

        {/* Active design badge */}
        {activeTopology && (
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active design uses <strong className="text-accent ml-1">{activeConversation?.result?.topology}</strong> topology
            · {activeConversation?.result?.num_qubits} qubits
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Sidebar: topology picker */}
          <div className="lg:col-span-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">Topologies</p>
            {TOPOLOGY_PRESETS.map(t => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                  selected === t.id
                    ? "border-accent bg-accent-soft shadow-sm"
                    : "border-slate-200 bg-white hover:border-accent/40 hover:bg-slate-50"
                )}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                <div className="min-w-0">
                  <p className={cn("text-xs font-bold truncate", selected === t.id ? "text-accent" : "text-slate-800")}>
                    {t.name}
                  </p>
                  <p className="text-[10px] text-slate-400">{t.qubits}Q · {t.couplers} couplers</p>
                </div>
                {selected === t.id && <ChevronRight className="h-3.5 w-3.5 text-accent ml-auto shrink-0" />}
              </button>
            ))}
          </div>

          {/* Main canvas */}
          <div className="lg:col-span-9 space-y-4">
            <div className={cn("grid gap-4", compareMode ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1")}>
              {/* Primary */}
              <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary</p>
                    <h3 className="text-base font-black text-slate-900 mt-0.5">{primary.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-sm">{primary.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="rounded-full text-[9px] font-bold px-2 py-0.5 bg-slate-50">
                      {primary.qubits}Q
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[9px] font-bold px-2 py-0.5 bg-slate-50">
                      deg {primary.avg_degree.toFixed(1)}
                    </Badge>
                  </div>
                </div>
                <TopologyCanvas topologyId={selected} color={primary.color} />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Qubits", val: primary.qubits },
                    { label: "Couplers", val: primary.couplers },
                    { label: "Avg Degree", val: primary.avg_degree.toFixed(1) },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{s.label}</p>
                      <p className="text-lg font-black text-slate-800 mt-0.5">{s.val}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Compare */}
              {compareMode && (
                <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Compare With</p>
                      <div className="mt-1">
                        <select
                          value={compareWith}
                          onChange={e => setCompareWith(e.target.value)}
                          className="text-sm font-black text-slate-900 bg-transparent border-0 outline-none cursor-pointer"
                        >
                          {TOPOLOGY_PRESETS.filter(t => t.id !== selected).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-sm">{secondary.description}</p>
                    </div>
                  </div>
                  <TopologyCanvas topologyId={compareWith} color={secondary.color} />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Qubits", val: secondary.qubits, diff: secondary.qubits - primary.qubits },
                      { label: "Couplers", val: secondary.couplers, diff: secondary.couplers - primary.couplers },
                      { label: "Avg Degree", val: secondary.avg_degree.toFixed(1), diff: secondary.avg_degree - primary.avg_degree },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                        <p className="text-[9px] font-bold uppercase text-slate-400">{s.label}</p>
                        <p className="text-lg font-black text-slate-800 mt-0.5">{s.val}</p>
                        <p className={cn("text-[10px] font-bold", Number(s.diff) > 0 ? "text-emerald-600" : Number(s.diff) < 0 ? "text-rose-600" : "text-slate-400")}>
                          {Number(s.diff) > 0 ? "+" : ""}{typeof s.diff === "number" ? s.diff.toFixed(typeof s.val === "string" ? 1 : 0) : s.diff}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Layers, title: "Use Case", text: primary.id === "heavy-hex" ? "Surface code QEC on NISQ/FT hardware" : primary.id === "surface-code" ? "Fault-tolerant quantum computation" : primary.id === "ring" ? "Noise benchmarking, small algorithms" : primary.id === "linear" ? "VQE, QAOA on near-term devices" : primary.id === "all-to-all" ? "Dense connectivity, trapped ion style" : "Bus-qubit cross-resonance gates" },
                { icon: Zap, title: "Crosstalk Risk", text: primary.avg_degree <= 2 ? "Low — sparse connectivity" : primary.avg_degree <= 3 ? "Medium — moderate ZZ coupling" : "High — dense coupling requires careful freq. planning" },
                { icon: Info, title: "Error Correction", text: primary.id === "heavy-hex" || primary.id === "surface-code" ? "Supports surface code / repetition code" : "Bare NISQ — no QEC topology" },
              ].map(s => (
                <Card key={s.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <s.icon className="h-3.5 w-3.5 text-accent" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.title}</p>
                  </div>
                  <p className="text-xs text-slate-700 font-semibold leading-relaxed">{s.text}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
