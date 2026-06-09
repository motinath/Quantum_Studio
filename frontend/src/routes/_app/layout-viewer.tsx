import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, EyeOff, ChevronDown, ChevronRight, Search, Layers,
  ZoomIn, ZoomOut, Maximize2, Move, MousePointer, Ruler,
  Grid3X3, Download, GitCompare, ExternalLink, Play,
  ChevronUp, GripHorizontal, CheckCircle2, AlertTriangle,
  RefreshCw, LayoutTemplate, Info, X, Cpu, Activity,
} from "lucide-react";
import { useDesign } from "@/lib/design-context";
import type { GenerateResponse } from "@/lib/api/backend";

export const Route = createFileRoute("/_app/layout-viewer")({
  head: () => ({ meta: [{ title: "Layout Viewer — Silicofeller" }] }),
  component: LayoutViewerPage,
});

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LayerDef {
  id: string;
  color: string;
  fillColor: string;
  count: number;
  visible: boolean;
}

type ComponentType = "qubit" | "resonator" | "coupler" | "junction" | "port";

interface LayoutComponent {
  id: string;
  type: ComponentType;
  label: string;
  x: number;
  y: number;
  // Qubit-specific
  freq?: number;
  anharmonicity?: number;
  EJ?: number;
  EC?: number;
  // Resonator-specific
  resonatorFreq?: number;
  resonatorLength?: number;
  detuning?: number;
  // Coupler-specific
  qubitA?: string;
  qubitB?: string;
  // Common
  material?: string;
  orientation?: number;
}

// ─── Compile result into layout components ─────────────────────────────────────

function compileLayout(result: GenerateResponse | null): {
  components: LayoutComponent[];
  chipW: number;
  chipH: number;
  cols: number;
  rows: number;
  spacing: number;
} {
  const BASE_SPACING = 900;
  const BASE_X = 600;
  const BASE_Y = 600;

  // Determine qubits from placement or freq plan
  const placement = result?.placement;
  const freqPlan = result?.frequency_plan;
  const numQubits = result?.num_qubits ?? 4;

  // Build qubit position map
  const qubitPos: Record<string, { x: number; y: number; name: string }> = {};
  if (placement?.qubits && placement.qubits.length > 0) {
    const cols = placement.cols ?? Math.ceil(Math.sqrt(numQubits));
    placement.qubits.forEach((q, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      qubitPos[q.name] = {
        name: q.name,
        x: BASE_X + col * BASE_SPACING,
        y: BASE_Y + row * BASE_SPACING,
      };
    });
  } else {
    const cols = Math.ceil(Math.sqrt(numQubits));
    for (let i = 0; i < numQubits; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const name = `Q${i + 1}`;
      qubitPos[name] = { name, x: BASE_X + col * BASE_SPACING, y: BASE_Y + row * BASE_SPACING };
    }
  }

  const components: LayoutComponent[] = [];
  const qubitNames = Object.keys(qubitPos);

  // Add qubits
  qubitNames.forEach(name => {
    const pos = qubitPos[name];
    const freq = freqPlan?.qubit_frequencies_GHz?.[name];
    const EJ = freqPlan?.EJ_GHz?.[name];
    const EC = freqPlan?.EC_GHz?.[name];
    components.push({
      id: name,
      type: "qubit",
      label: name,
      x: pos.x,
      y: pos.y,
      freq: freq ?? (4.9 + Math.random() * 0.4),
      anharmonicity: EC ? -EC : -0.22,
      EJ: EJ,
      EC: EC,
      material: result?.material?.metal ?? "Nb",
      orientation: 0,
    });
  });

  // Add resonators (one per qubit)
  qubitNames.forEach((name, i) => {
    const pos = qubitPos[name];
    const rName = `RO_${name}`;
    const rFreq = freqPlan?.resonator_frequencies_GHz?.[rName] ?? freqPlan?.resonator_frequencies_GHz?.[name];
    const rLen = freqPlan?.resonator_lengths_mm?.[rName] ?? freqPlan?.resonator_lengths_mm?.[name];
    const detuning = freqPlan?.detunings_GHz?.[name];
    components.push({
      id: rName,
      type: "resonator",
      label: rName,
      x: pos.x + 260,
      y: pos.y,
      resonatorFreq: rFreq ?? (6.8 + i * 0.05),
      resonatorLength: rLen,
      detuning: detuning,
      material: result?.material?.metal ?? "Nb",
    });
  });

  // Add couplers from placement edges or default nearest-neighbor
  const edges = placement?.edges ?? [];
  if (edges.length > 0) {
    edges.forEach((e, i) => {
      const qa = qubitPos[e.qubit_a];
      const qb = qubitPos[e.qubit_b];
      if (!qa || !qb) return;
      const cx = (qa.x + qb.x) / 2;
      const cy = (qa.y + qb.y) / 2;
      components.push({
        id: e.label ?? `C${i + 1}`,
        type: "coupler",
        label: e.label ?? `C${i + 1}`,
        x: cx,
        y: cy,
        qubitA: e.qubit_a,
        qubitB: e.qubit_b,
        material: result?.material?.metal ?? "Nb",
      });
    });
  } else {
    // Auto nearest-neighbor
    qubitNames.forEach((name, i) => {
      if (i === 0) return;
      const a = qubitPos[qubitNames[i - 1]];
      const b = qubitPos[name];
      if (!a || !b) return;
      const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      if (dist <= BASE_SPACING * 1.5) {
        components.push({
          id: `C${i}`,
          type: "coupler",
          label: `C${i}`,
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          qubitA: qubitNames[i - 1],
          qubitB: name,
          material: result?.material?.metal ?? "Nb",
        });
      }
    });
  }

  // Add ports
  const cols = Math.ceil(Math.sqrt(numQubits));
  const rows = Math.ceil(numQubits / cols);
  const chipW = (cols + 1) * BASE_SPACING + 800;
  const chipH = (rows + 1) * BASE_SPACING + 800;

  [
    { id: "P1", x: BASE_X + (chipW / 4), y: 50 },
    { id: "P2", x: BASE_X + (chipW * 3 / 4), y: 50 },
    { id: "P3", x: 50, y: BASE_Y + chipH / 2 },
    { id: "P4", x: BASE_X + chipW, y: BASE_Y + chipH / 2 },
  ].forEach(p => {
    components.push({ id: p.id, type: "port", label: p.id, x: p.x, y: p.y, material: "Au" });
  });

  return { components, chipW, chipH, cols, rows, spacing: BASE_SPACING };
}

// ─── Canvas renderer ───────────────────────────────────────────────────────────

interface LayoutCanvasProps {
  layers: LayerDef[];
  layoutData: ReturnType<typeof compileLayout>;
  onSelectComponent: (c: LayoutComponent | null) => void;
  selectedId: string | null;
}

function LayoutCanvas({ layers, layoutData, onSelectComponent, selectedId }: LayoutCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [showGrid, setShowGrid] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const lastMouse = useRef({ x: 0, y: 0 });

  const { components, chipW, chipH } = layoutData;

  const isVisible = (layerId: string) => layers.find(l => l.id === layerId)?.visible !== false;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, W, H);

    // Grid
    if (showGrid) {
      const gridSpacing = 50 * zoom;
      const offsetX = pan.x % gridSpacing;
      const offsetY = pan.y % gridSpacing;
      ctx.strokeStyle = "rgba(100,120,180,0.12)";
      ctx.lineWidth = 0.5;
      for (let x = offsetX; x < W; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = offsetY; y < H; y += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(pan.x + W * 0.08, pan.y + H * 0.08);
    ctx.scale(zoom * 0.08, zoom * 0.08);

    // Ground plane
    if (isVisible("GROUND")) {
      ctx.fillStyle = "rgba(34,197,94,0.06)";
      ctx.strokeStyle = "rgba(34,197,94,0.3)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D).roundRect(100, 100, chipW, chipH, 40);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(34,197,94,0.08)";
      ctx.lineWidth = 4;
      for (let gx = 200; gx < chipW; gx += 180) {
        ctx.beginPath(); ctx.moveTo(gx, 100); ctx.lineTo(gx, chipH + 100); ctx.stroke();
      }
      for (let gy = 200; gy < chipH; gy += 180) {
        ctx.beginPath(); ctx.moveTo(100, gy); ctx.lineTo(chipW + 100, gy); ctx.stroke();
      }
    }

    // Couplers
    if (isVisible("COUPLER")) {
      components.filter(c => c.type === "coupler").forEach(c => {
        const qa = components.find(q => q.id === c.qubitA);
        const qb = components.find(q => q.id === c.qubitB);
        const isSelected = selectedId === c.id;
        if (qa && qb) {
          ctx.strokeStyle = isSelected ? "#fbbf24" : "#f97316";
          ctx.lineWidth = isSelected ? 24 : 18;
          ctx.beginPath();
          ctx.moveTo(qa.x, qa.y);
          ctx.lineTo(qb.x, qb.y);
          ctx.stroke();
        }
        ctx.fillStyle = isSelected ? "#fbbf24" : "#f97316";
        ctx.strokeStyle = isSelected ? "#fff" : "#fbbf24";
        ctx.lineWidth = isSelected ? 8 : 6;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 70, 46, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        if (isSelected) {
          ctx.strokeStyle = "rgba(251,191,36,0.4)";
          ctx.lineWidth = 24;
          ctx.setLineDash([20, 10]);
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 110, 80, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (isVisible("TEXT")) {
          ctx.fillStyle = isSelected ? "#fff" : "#fed7aa";
          ctx.font = "bold 60px monospace";
          ctx.textAlign = "center";
          ctx.fillText(c.label, c.x, c.y - 70);
        }
      });
    }

    // Readout resonators
    if (isVisible("RESONATOR")) {
      components.filter(c => c.type === "resonator").forEach(c => {
        const isSelected = selectedId === c.id;
        ctx.strokeStyle = isSelected ? "#60a5fa" : "#3b82f6";
        ctx.lineWidth = isSelected ? 18 : 14;
        // Meander path
        ctx.beginPath();
        ctx.moveTo(c.x - 140, c.y);
        for (let seg = 0; seg < 5; seg++) {
          const dir = seg % 2 === 0 ? 1 : -1;
          ctx.lineTo(c.x + dir * 80, c.y + seg * 50);
          ctx.lineTo(c.x + dir * 80, c.y + (seg + 1) * 50);
        }
        ctx.stroke();
        if (isSelected) {
          ctx.strokeStyle = "rgba(96,165,250,0.3)";
          ctx.lineWidth = 36;
          ctx.beginPath();
          ctx.moveTo(c.x - 140, c.y);
          for (let seg = 0; seg < 5; seg++) {
            const dir = seg % 2 === 0 ? 1 : -1;
            ctx.lineTo(c.x + dir * 80, c.y + seg * 50);
            ctx.lineTo(c.x + dir * 80, c.y + (seg + 1) * 50);
          }
          ctx.stroke();
        }
        if (isVisible("TEXT")) {
          ctx.fillStyle = isSelected ? "#93c5fd" : "#3b82f6";
          ctx.font = `${isSelected ? "bold " : ""}52px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(c.label, c.x, c.y - 30);
          if (c.resonatorFreq) {
            ctx.fillStyle = "#64748b";
            ctx.font = "40px monospace";
            ctx.fillText(`${c.resonatorFreq.toFixed(2)} GHz`, c.x, c.y - 80);
          }
        }
      });
    }

    // Control lines
    if (isVisible("CONTROL")) {
      components.filter(c => c.type === "qubit").forEach(c => {
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 10;
        ctx.setLineDash([30, 20]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - 120);
        ctx.lineTo(c.x, c.y - 280);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(6,182,212,0.5)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(c.x - 80, c.y - 280);
        ctx.lineTo(c.x + 80, c.y - 280);
        ctx.stroke();
      });
    }

    // Junctions
    if (isVisible("JUNCTION")) {
      components.filter(c => c.type === "qubit").forEach(c => {
        ctx.fillStyle = "#ec4899";
        ctx.strokeStyle = "#f9a8d4";
        ctx.lineWidth = 5;
        [-20, 20].forEach(dx => {
          ctx.fillRect(c.x + dx - 15, c.y + 60, 30, 20);
          ctx.strokeRect(c.x + dx - 15, c.y + 60, 30, 20);
        });
        if (isVisible("TEXT")) {
          ctx.fillStyle = "#fbcfe8";
          ctx.font = "40px monospace";
          ctx.textAlign = "center";
          ctx.fillText("JJ", c.x, c.y + 120);
        }
      });
    }

    // VIAs
    if (isVisible("VIA")) {
      for (let vx = 300; vx < chipW; vx += 350) {
        for (let vy = 300; vy < chipH; vy += 350) {
          ctx.fillStyle = "rgba(234,179,8,0.7)";
          ctx.strokeStyle = "rgba(234,179,8,0.9)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(vx, vy, 18, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }
      }
    }

    // Ports
    if (isVisible("PORT")) {
      components.filter(c => c.type === "port").forEach((c) => {
        const isSelected = selectedId === c.id;
        ctx.fillStyle = isSelected ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.8)";
        ctx.strokeStyle = isSelected ? "#fff" : "rgba(255,255,255,0.6)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.rect(c.x - 40, c.y - 20, 80, 40);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 48px monospace";
        ctx.textAlign = "center";
        ctx.fillText(c.label, c.x, c.y + 16);
      });
    }

    // Qubits (top layer)
    if (isVisible("QUBIT")) {
      components.filter(c => c.type === "qubit").forEach(c => {
        const isSelected = selectedId === c.id;
        ctx.fillStyle = isSelected ? "rgba(139,92,246,0.5)" : "rgba(139,92,246,0.25)";
        ctx.strokeStyle = isSelected ? "#a78bfa" : "#7c3aed";
        ctx.lineWidth = isSelected ? 16 : 10;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 160, 160, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = isSelected ? "#8b5cf6" : "#6d28d9";
        ctx.strokeStyle = isSelected ? "#c4b5fd" : "#a78bfa";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 80, 80, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 24;
        [0, 90, 180, 270].forEach(angle => {
          const rad = (angle * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(c.x + Math.cos(rad) * 80, c.y + Math.sin(rad) * 80);
          ctx.lineTo(c.x + Math.cos(rad) * 155, c.y + Math.sin(rad) * 155);
          ctx.stroke();
        });
        if (isSelected) {
          ctx.strokeStyle = "rgba(167,139,250,0.4)";
          ctx.lineWidth = 30;
          ctx.setLineDash([20, 10]);
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 200, 200, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (isVisible("TEXT")) {
          ctx.fillStyle = "#e2e8f0";
          ctx.font = `bold ${isSelected ? 80 : 68}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(c.label, c.x, c.y - 200);
          if (c.freq) {
            ctx.font = "50px monospace";
            ctx.fillStyle = "#94a3b8";
            ctx.fillText(`${c.freq.toFixed(2)} GHz`, c.x, c.y - 130);
          }
        }
      });
    }

    ctx.restore();

    // Ruler
    if (showRuler) {
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(0, 0, W, 22);
      ctx.fillRect(0, 0, 22, H);
      ctx.fillStyle = "rgba(100,116,139,0.6)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      for (let rx = 0; rx < W; rx += 60) {
        const val = Math.round((rx - pan.x - W * 0.08) / (zoom * 0.08) / 100) * 100;
        ctx.fillText(String(val), rx, 14);
        ctx.strokeStyle = "rgba(100,116,139,0.3)"; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(rx, 18); ctx.lineTo(rx, 22); ctx.stroke();
      }
      for (let ry = 22; ry < H; ry += 60) {
        const val = Math.round((ry - pan.y - H * 0.08) / (zoom * 0.08) / 100) * 100;
        ctx.save(); ctx.translate(14, ry); ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(val), 0, 0); ctx.restore();
      }
    }

    // Scale bar
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.fillRect(W - 140, H - 36, 130, 24);
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W - 130, H - 18); ctx.lineTo(W - 30, H - 18);
    ctx.moveTo(W - 130, H - 24); ctx.lineTo(W - 130, H - 12);
    ctx.moveTo(W - 30, H - 24); ctx.lineTo(W - 30, H - 12);
    ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "10px monospace"; ctx.textAlign = "center";
    ctx.fillText("500 µm", W - 80, H - 22);

  }, [zoom, pan, showGrid, showRuler, layers, components, selectedId, chipW, chipH, isVisible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
  }, [draw]);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [draw]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom(z => Math.max(0.2, Math.min(8, z * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === "pan" || e.button === 1) {
      setIsPanning(true);
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) { setIsPanning(false); return; }
    if (tool === "select") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const W = canvas.width;
      const H = canvas.height;
      const worldX = (mx - pan.x - W * 0.08) / (zoom * 0.08);
      const worldY = (my - pan.y - H * 0.08) / (zoom * 0.08);

      // Hit-test: qubits (circle r=200), resonators (bounding box), couplers (ellipse), ports
      let hit: LayoutComponent | null = null;

      for (const c of components) {
        if (c.type === "qubit" && isVisible("QUBIT")) {
          const dist = Math.sqrt((worldX - c.x) ** 2 + (worldY - c.y) ** 2);
          if (dist < 200) { hit = c; break; }
        }
      }
      if (!hit) {
        for (const c of components) {
          if (c.type === "resonator" && isVisible("RESONATOR")) {
            const dx = Math.abs(worldX - c.x);
            const dy = Math.abs(worldY - c.y);
            if (dx < 180 && dy < 160) { hit = c; break; }
          }
        }
      }
      if (!hit) {
        for (const c of components) {
          if (c.type === "coupler" && isVisible("COUPLER")) {
            const dx = worldX - c.x; const dy = worldY - c.y;
            if ((dx * dx) / (110 * 110) + (dy * dy) / (80 * 80) < 1) { hit = c; break; }
          }
        }
      }
      if (!hit) {
        for (const c of components) {
          if (c.type === "port" && isVisible("PORT")) {
            const dx = Math.abs(worldX - c.x);
            const dy = Math.abs(worldY - c.y);
            if (dx < 80 && dy < 60) { hit = c; break; }
          }
        }
      }

      onSelectComponent(hit);
    }
  };

  const fitToScreen = () => { setZoom(1.0); setPan({ x: 0, y: 0 }); };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a]">
      {/* Toolbar */}
      <div className="flex h-11 items-center gap-2 px-3 border-b border-slate-800 bg-[#0d1425] shrink-0 flex-wrap">
        <div className="flex items-center gap-1 border-r border-slate-700 pr-3 mr-1">
          <button onClick={() => setTool("select")} className={`p-1.5 rounded transition-colors ${tool === "select" ? "bg-accent/20 text-accent" : "text-slate-500 hover:text-slate-300"}`} title="Select">
            <MousePointer className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setTool("pan")} className={`p-1.5 rounded transition-colors ${tool === "pan" ? "bg-accent/20 text-accent" : "text-slate-500 hover:text-slate-300"}`} title="Pan">
            <Move className="h-3.5 w-3.5" />
          </button>
        </div>
        <button onClick={() => setZoom(z => Math.min(8, z * 1.25))} className="p-1.5 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800" title="Zoom In"><ZoomIn className="h-3.5 w-3.5" /></button>
        <button onClick={() => setZoom(z => Math.max(0.2, z / 1.25))} className="p-1.5 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800" title="Zoom Out"><ZoomOut className="h-3.5 w-3.5" /></button>
        <button onClick={fitToScreen} className="p-1.5 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800" title="Fit Screen"><Maximize2 className="h-3.5 w-3.5" /></button>
        <span className="text-[11px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded min-w-[48px] text-center">{Math.round(zoom * 100)}%</span>
        <div className="flex items-center gap-1 border-l border-slate-700 pl-3 ml-1">
          <button onClick={() => setShowGrid(v => !v)} className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded transition-colors ${showGrid ? "bg-accent/20 text-accent" : "text-slate-500 hover:text-slate-300"}`}>
            <Grid3X3 className="h-3 w-3" /> Grid
          </button>
          <button onClick={() => setShowRuler(v => !v)} className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded transition-colors ${showRuler ? "bg-accent/20 text-accent" : "text-slate-500 hover:text-slate-300"}`}>
            <Ruler className="h-3 w-3" /> Ruler
          </button>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-7 text-[10px] border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 gap-1.5 bg-transparent">
          <GitCompare className="h-3 w-3" /> Compare
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 gap-1.5 bg-transparent">
          <Download className="h-3 w-3" /> Export GDS
        </Button>
        <Button size="sm" className="h-7 text-[10px] bg-accent hover:bg-accent/90 gap-1.5">
          <ExternalLink className="h-3 w-3" /> Open in Editor
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsPanning(false)}
        style={{ cursor: tool === "pan" || isPanning ? "grabbing" : "crosshair" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        {/* Minimap */}
        <div className="absolute bottom-3 right-3 w-32 h-24 bg-slate-900/90 border border-slate-700 rounded overflow-hidden">
          <div className="w-full h-full bg-[#0a0f1a] flex items-center justify-center relative">
            <div className="absolute inset-1 opacity-60">
              {components.filter(c => c.type === "qubit").map((c, i) => (
                <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-violet-500"
                  style={{ left: `${(c.x / 8000) * 100}%`, top: `${(c.y / 8000) * 100}%`, transform: "translate(-50%,-50%)" }}
                />
              ))}
            </div>
          </div>
        </div>
        {/* Click hint */}
        {components.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[9px] text-slate-600 bg-slate-900/70 px-2 py-1 rounded pointer-events-none">
            Click any component to inspect properties
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component mini preview SVG ────────────────────────────────────────────────

function ComponentPreview({ comp }: { comp: LayoutComponent }) {
  if (comp.type === "qubit") {
    return (
      <svg width="60" height="60" viewBox="-30 -30 60 60">
        <circle cx="0" cy="0" r="25" fill="rgba(139,92,246,0.3)" stroke="#7c3aed" strokeWidth="2" />
        <circle cx="0" cy="0" r="12" fill="#6d28d9" stroke="#a78bfa" strokeWidth="1.5" />
        {[0, 90, 180, 270].map(a => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={Math.cos(r) * 12} y1={Math.sin(r) * 12} x2={Math.cos(r) * 24} y2={Math.sin(r) * 24} stroke="#7c3aed" strokeWidth="4" />;
        })}
        <rect x="-6" y="8" width="5" height="4" fill="#ec4899" />
        <rect x="1" y="8" width="5" height="4" fill="#ec4899" />
        <text x="0" y="-16" textAnchor="middle" fontSize="6" fill="#c4b5fd" fontWeight="bold">JJ</text>
      </svg>
    );
  }
  if (comp.type === "resonator") {
    return (
      <svg width="60" height="60" viewBox="-30 -30 60 60">
        <path d="M -20 0 L -8 0 L -8 -12 L 8 -12 L 8 12 L 20 12" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
        <circle cx="-20" cy="0" r="3" fill="#3b82f6" />
        <circle cx="20" cy="12" r="3" fill="#06b6d4" />
      </svg>
    );
  }
  if (comp.type === "coupler") {
    return (
      <svg width="60" height="60" viewBox="-30 -30 60 60">
        <line x1="-25" y1="0" x2="25" y2="0" stroke="#f97316" strokeWidth="3" />
        <ellipse cx="0" cy="0" rx="14" ry="8" fill="#f97316" stroke="#fbbf24" strokeWidth="1.5" />
        <text x="0" y="4" textAnchor="middle" fontSize="7" fill="#fed7aa" fontWeight="bold">CPW</text>
      </svg>
    );
  }
  if (comp.type === "port") {
    return (
      <svg width="60" height="60" viewBox="-30 -30 60 60">
        <rect x="-18" y="-10" width="36" height="20" rx="3" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5" />
        <text x="0" y="5" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">{comp.label}</text>
        <line x1="-18" y1="0" x2="-26" y2="0" stroke="#94a3b8" strokeWidth="2" />
      </svg>
    );
  }
  return null;
}

// ─── Properties panel content ──────────────────────────────────────────────────

function PropertiesPanel({ comp }: { comp: LayoutComponent }) {
  const colorMap: Record<ComponentType, string> = {
    qubit: "#8b5cf6",
    resonator: "#3b82f6",
    coupler: "#f97316",
    junction: "#ec4899",
    port: "#94a3b8",
  };

  const rows: Array<[string, string]> = [];
  rows.push(["Type", comp.type.charAt(0).toUpperCase() + comp.type.slice(1)]);
  rows.push(["ID", comp.id]);
  rows.push(["Position", `(${Math.round(comp.x / 10) * 10}, ${Math.round(comp.y / 10) * 10}) µm`]);
  if (comp.material) rows.push(["Material", comp.material]);

  if (comp.type === "qubit") {
    if (comp.freq) rows.push(["Frequency", `${comp.freq.toFixed(3)} GHz`]);
    if (comp.anharmonicity) rows.push(["Anharmonicity", `${comp.anharmonicity.toFixed(3)} GHz`]);
    if (comp.EJ) rows.push(["EJ", `${comp.EJ.toFixed(3)} GHz`]);
    if (comp.EC) rows.push(["EC", `${comp.EC.toFixed(3)} GHz`]);
    rows.push(["Layer", "QUBIT (9)"]);
    rows.push(["Thickness", "200 nm"]);
  } else if (comp.type === "resonator") {
    if (comp.resonatorFreq) rows.push(["Frequency", `${comp.resonatorFreq.toFixed(3)} GHz`]);
    if (comp.resonatorLength) rows.push(["Length", `${comp.resonatorLength.toFixed(2)} mm`]);
    if (comp.detuning) rows.push(["Detuning", `${comp.detuning.toFixed(3)} GHz`]);
    rows.push(["Layer", "RESONATOR (8)"]);
    rows.push(["Width", "10 µm"]);
    rows.push(["Gap", "6 µm"]);
  } else if (comp.type === "coupler") {
    if (comp.qubitA) rows.push(["Qubit A", comp.qubitA]);
    if (comp.qubitB) rows.push(["Qubit B", comp.qubitB]);
    rows.push(["Layer", "COUPLER (7)"]);
    rows.push(["Type", "CPW"]);
    rows.push(["Width", "10 µm"]);
  } else if (comp.type === "port") {
    rows.push(["Layer", "PORT (2)"]);
    rows.push(["Material", "Au"]);
    rows.push(["Thickness", "50 nm"]);
  }

  return (
    <div className="border-t border-slate-800 p-2 shrink-0">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorMap[comp.type] }} />
        <span className="text-[11px] font-bold text-slate-200">{comp.id}</span>
        <Badge className="text-[8px] px-1 py-0 border-0 h-4 ml-auto"
          style={{ backgroundColor: `${colorMap[comp.type]}33`, color: colorMap[comp.type] }}>
          {comp.type}
        </Badge>
      </div>
      <div className="space-y-0.5 text-[9px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-slate-500 shrink-0">{k}</span>
            <span className="text-slate-300 font-mono text-right truncate">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 h-16 bg-slate-900 rounded flex items-center justify-center border border-slate-800">
        <ComponentPreview comp={comp} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const LAYER_DEFAULTS: LayerDef[] = [
  { id: "QUBIT", color: "#8b5cf6", fillColor: "rgba(139,92,246,0.3)", count: 0, visible: true },
  { id: "RESONATOR", color: "#3b82f6", fillColor: "rgba(59,130,246,0.3)", count: 0, visible: true },
  { id: "COUPLER", color: "#f97316", fillColor: "rgba(249,115,22,0.3)", count: 0, visible: true },
  { id: "CONTROL", color: "#06b6d4", fillColor: "rgba(6,182,212,0.3)", count: 0, visible: true },
  { id: "GROUND", color: "#22c55e", fillColor: "rgba(34,197,94,0.2)", count: 2, visible: true },
  { id: "JUNCTION", color: "#ec4899", fillColor: "rgba(236,72,153,0.3)", count: 0, visible: true },
  { id: "VIA", color: "#eab308", fillColor: "rgba(234,179,8,0.3)", count: 128, visible: true },
  { id: "PORT", color: "#f1f5f9", fillColor: "rgba(241,245,249,0.2)", count: 4, visible: true },
  { id: "TEXT", color: "#94a3b8", fillColor: "rgba(148,163,184,0.2)", count: 12, visible: true },
];

const LAYER_STACK = [
  { layer: 9, name: "QUBIT", material: "Nb", thickness: "200 nm", purpose: "Qubit pads and structures" },
  { layer: 8, name: "RESONATOR", material: "Nb", thickness: "200 nm", purpose: "Readout resonators" },
  { layer: 7, name: "COUPLER", material: "Nb", thickness: "200 nm", purpose: "Coupling elements" },
  { layer: 6, name: "CONTROL", material: "Nb", thickness: "200 nm", purpose: "Control and flux lines" },
  { layer: 5, name: "JUNCTION", material: "Al", thickness: "10 nm", purpose: "Josephson junctions" },
  { layer: 4, name: "VIA", material: "Nb", thickness: "400 nm", purpose: "Inter-layer connections" },
  { layer: 3, name: "GROUND", material: "Nb", thickness: "200 nm", purpose: "Ground plane" },
  { layer: 2, name: "PORT", material: "Au", thickness: "50 nm", purpose: "I/O ports" },
  { layer: 1, name: "SUBSTRATE", material: "Si", thickness: "500 µm", purpose: "Silicon substrate" },
];

function LayoutViewerPage() {
  const { activeConversation } = useDesign();
  const result = activeConversation?.result ?? null;

  const [layers, setLayers] = useState<LayerDef[]>(LAYER_DEFAULTS);
  const [selectedComponent, setSelectedComponent] = useState<LayoutComponent | null>(null);
  const [navTab, setNavTab] = useState<"components" | "nets">("components");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["qubits", "resonators"]));
  const [bottomTab, setBottomTab] = useState<"layerstack" | "stats" | "cross">("layerstack");
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [bottomH, setBottomH] = useState(180);
  const [searchQ, setSearchQ] = useState("");
  const [drcRan, setDrcRan] = useState(false);
  const [drcRunning, setDrcRunning] = useState(false);

  // Build layout data from design context
  const layoutData = compileLayout(result);
  const { components } = layoutData;

  const qubitComponents = components.filter(c => c.type === "qubit");
  const resonatorComponents = components.filter(c => c.type === "resonator");
  const couplerComponents = components.filter(c => c.type === "coupler");
  const portComponents = components.filter(c => c.type === "port");

  const qubitCount = qubitComponents.length;
  const resonatorCount = resonatorComponents.length;
  const couplerCount = couplerComponents.length;

  // Reset selected when design changes
  useEffect(() => { setSelectedComponent(null); }, [activeConversation?.id]);

  // Update layer counts
  const updatedLayers = layers.map(l => ({
    ...l,
    count:
      l.id === "QUBIT" ? qubitCount
      : l.id === "RESONATOR" ? resonatorCount
      : l.id === "COUPLER" ? couplerCount
      : l.id === "JUNCTION" ? qubitCount * 2
      : l.id === "PORT" ? portComponents.length
      : l.count,
  }));

  const toggleLayer = (id: string) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  const showAll = () => setLayers(prev => prev.map(l => ({ ...l, visible: true })));
  const hideAll = () => setLayers(prev => prev.map(l => ({ ...l, visible: false })));

  // Component tree groups
  const componentGroups = [
    { id: "qubits", label: "Qubits", color: "#8b5cf6", items: qubitComponents },
    { id: "resonators", label: "Readout Resonators", color: "#3b82f6", items: resonatorComponents },
    { id: "couplers", label: "Couplers", color: "#f97316", items: couplerComponents },
    { id: "ports", label: "Ports", color: "#94a3b8", items: portComponents },
  ];

  const toggleGroup = (id: string) => {
    setExpandedGroups(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const filteredGroups = componentGroups.map(g => ({
    ...g,
    items: searchQ
      ? g.items.filter(c => c.id.toLowerCase().includes(searchQ.toLowerCase()) || c.label.toLowerCase().includes(searchQ.toLowerCase()))
      : g.items,
  })).filter(g => !searchQ || g.items.length > 0);

  // Bottom panel drag
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const onDragBottomStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartH.current = bottomH;
    const onMove = (ev: MouseEvent) => {
      const delta = dragStartY.current - ev.clientY;
      setBottomH(Math.max(80, Math.min(400, dragStartH.current + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const runDRC = async () => {
    setDrcRunning(true);
    await new Promise(r => setTimeout(r, 1200));
    setDrcRunning(false);
    setDrcRan(true);
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-[#0a0f1a] text-slate-200 overflow-hidden">
      {/* ── LEFT SIDEBAR ── */}
      <div className="w-56 flex flex-col border-r border-slate-800 bg-[#0d1425] shrink-0">
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <LayoutTemplate className="h-3.5 w-3.5 text-accent" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Layout Navigator</span>
          </div>
          {result && (
            <div className="flex items-center gap-1.5 mb-2 text-[9px] text-slate-500 bg-slate-800/60 rounded px-2 py-1">
              <Cpu className="h-3 w-3 text-accent shrink-0" />
              <span className="truncate">{result.label ?? `${qubitCount}-Qubit ${result.topology ?? "Design"}`}</span>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search components..."
              className="w-full bg-slate-800 text-[10px] text-slate-300 pl-6 pr-2 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-accent/50 placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex border-b border-slate-800 shrink-0">
          {(["components", "nets"] as const).map(tab => (
            <button key={tab} onClick={() => setNavTab(tab)}
              className={`flex-1 py-1.5 text-[10px] font-semibold capitalize transition-colors border-b-2 ${navTab === tab ? "border-accent text-accent" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {navTab === "components" ? (
            <div className="px-1">
              {filteredGroups.map(group => (
                <div key={group.id} className="mb-0.5">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-1 w-full py-1 px-1 text-[10px] text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800/40 transition-colors"
                  >
                    {expandedGroups.has(group.id) ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="font-semibold flex-1 text-left">{group.label}</span>
                    <span className="text-[9px] text-slate-600 shrink-0">{group.items.length}</span>
                  </button>
                  {expandedGroups.has(group.id) && group.items.length > 0 && (
                    <div className="pl-5 space-y-0">
                      {group.items.slice(0, 30).map(item => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedComponent(item)}
                          className={`flex items-center gap-1.5 w-full py-0.5 px-1 text-[9px] rounded transition-colors ${selectedComponent?.id === item.id ? "bg-accent/15 text-accent" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"}`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                          <span className="flex-1 text-left truncate font-mono">{item.id}</span>
                          {item.freq && <span className="text-[8px] text-slate-600 shrink-0">{item.freq.toFixed(1)}G</span>}
                          {item.resonatorFreq && <span className="text-[8px] text-slate-600 shrink-0">{item.resonatorFreq.toFixed(1)}G</span>}
                        </button>
                      ))}
                      {group.items.length > 30 && (
                        <div className="text-[8px] text-slate-600 px-1 py-0.5">+{group.items.length - 30} more</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Nets tab: show connections
            <div className="px-2 py-1 space-y-1">
              {components.filter(c => c.type === "coupler").slice(0, 20).map(c => (
                <div key={c.id} className="text-[9px] bg-slate-800/40 rounded px-2 py-1">
                  <div className="flex items-center gap-1 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                    <span className="font-mono font-bold">{c.id}</span>
                  </div>
                  <div className="text-slate-600 pl-3 font-mono">{c.qubitA} ↔ {c.qubitB}</div>
                </div>
              ))}
              {couplerComponents.length === 0 && (
                <p className="text-[9px] text-slate-600 italic p-2">No nets in current design</p>
              )}
            </div>
          )}
        </div>

        {/* Properties panel */}
        {selectedComponent ? (
          <PropertiesPanel comp={selectedComponent} />
        ) : (
          <div className="border-t border-slate-800 px-3 py-3 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Properties</span>
            <div className="text-[9px] text-slate-600 mt-2 italic">
              Click a component on the canvas or in the tree to inspect
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN CANVAS ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex-1 min-h-0">
          <LayoutCanvas
            layers={updatedLayers}
            layoutData={layoutData}
            onSelectComponent={setSelectedComponent}
            selectedId={selectedComponent?.id ?? null}
          />
        </div>

        {/* ── BOTTOM INFO PANEL ── */}
        <div className="border-t border-slate-800 bg-[#0d1425] shrink-0" style={{ height: bottomCollapsed ? 36 : bottomH }}>
          <div className="flex items-center h-9 border-b border-slate-800 cursor-row-resize select-none" onMouseDown={onDragBottomStart}>
            <div className="px-2 text-slate-600"><GripHorizontal className="h-3.5 w-3.5" /></div>
            {([["layerstack", "Layer Stack"], ["stats", "Design Stats"], ["cross", "Cross Section"]] as const).map(([id, label]) => (
              <button key={id}
                onClick={e => { e.stopPropagation(); setBottomTab(id); setBottomCollapsed(false); }}
                onMouseDown={e => e.stopPropagation()}
                className={`px-3 h-full text-[10px] font-semibold border-b-2 transition-colors ${bottomTab === id && !bottomCollapsed ? "border-accent text-slate-200" : "border-transparent text-slate-500 hover:text-slate-300"}`}
              >{label}</button>
            ))}
            <div className="flex-1" onMouseDown={onDragBottomStart} />
            <button className="px-2 text-slate-500 hover:text-slate-300" onMouseDown={e => e.stopPropagation()} onClick={() => setBottomCollapsed(v => !v)}>
              {bottomCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {!bottomCollapsed && (
            <div className="overflow-y-auto" style={{ height: bottomH - 36 }}>
              {bottomTab === "layerstack" && (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      {["Layer", "Name", "Material", "Thickness", "Purpose"].map(h => (
                        <th key={h} className="text-left px-3 py-1.5 text-slate-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LAYER_STACK.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 font-mono text-slate-500">{row.layer}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: updatedLayers.find(l => l.id === row.name)?.color ?? "#94a3b8" }} />
                            <span className="font-semibold text-slate-300">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-400">{row.material}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-400">{row.thickness}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {bottomTab === "stats" && (
                <div className="p-3 grid grid-cols-3 gap-3">
                  {[
                    ["Total Qubits", qubitCount, "#8b5cf6"],
                    ["Resonators", resonatorCount, "#3b82f6"],
                    ["Couplers", couplerCount, "#f97316"],
                    ["Topology", result?.topology ?? "Grid", "#22c55e"],
                    ["Engine", result?.engine ?? "—", "#06b6d4"],
                    ["Material", result?.material?.metal ?? "Nb", "#ec4899"],
                    ["Substrate", result?.material?.substrate ?? "Si", "#eab308"],
                    ["Junctions", qubitCount * 2, "#94a3b8"],
                    ["DRC", drcRan ? "Clean" : "Not Run", drcRan ? "#22c55e" : "#f97316"],
                  ].map(([label, value, color]) => (
                    <div key={label as string} className="bg-slate-900/60 rounded p-2 border border-slate-800">
                      <div className="text-[9px] text-slate-500 mb-1">{label as string}</div>
                      <div className="text-[13px] font-bold truncate" style={{ color: color as string }}>{String(value)}</div>
                    </div>
                  ))}
                </div>
              )}

              {bottomTab === "cross" && (
                <div className="flex gap-4 p-3">
                  <div className="flex-1">
                    <p className="text-[9px] text-slate-500 mb-2 font-semibold uppercase tracking-wider">Cross Section (X: 2480 µm)</p>
                    <div className="h-28 bg-slate-900 rounded border border-slate-800 relative overflow-hidden">
                      <svg width="100%" height="100%" viewBox="0 0 400 120">
                        <rect x="0" y="80" width="400" height="40" fill="#1e293b" />
                        <text x="4" y="106" fill="#475569" fontSize="8">Si substrate</text>
                        <rect x="0" y="68" width="400" height="10" fill="rgba(34,197,94,0.3)" stroke="rgba(34,197,94,0.5)" strokeWidth="0.5" />
                        <text x="4" y="77" fill="#22c55e" fontSize="7">Nb ground</text>
                        <rect x="60" y="55" width="80" height="12" rx="2" fill="rgba(139,92,246,0.6)" stroke="#8b5cf6" strokeWidth="1" />
                        <text x="85" y="64" fill="#c4b5fd" fontSize="7">Qubit</text>
                        <rect x="200" y="55" width="60" height="12" rx="2" fill="rgba(59,130,246,0.6)" stroke="#3b82f6" strokeWidth="1" />
                        <text x="210" y="64" fill="#93c5fd" fontSize="7">Resonator</text>
                        <rect x="160" y="58" width="40" height="8" rx="1" fill="rgba(249,115,22,0.6)" stroke="#f97316" strokeWidth="1" />
                        <text x="165" y="65" fill="#fed7aa" fontSize="6">Coupler</text>
                        <rect x="100" y="40" width="8" height="16" rx="1" fill="rgba(236,72,153,0.8)" stroke="#ec4899" strokeWidth="1" />
                        <text x="92" y="36" fill="#fbcfe8" fontSize="7">JJ</text>
                        <line x1="240" y1="10" x2="240" y2="120" stroke="rgba(6,182,212,0.6)" strokeWidth="1" strokeDasharray="3,2" />
                        <text x="243" y="14" fill="#67e8f9" fontSize="7">X: 2480 µm</text>
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ── */}
      <div className="w-52 flex flex-col border-l border-slate-800 bg-[#0d1425] shrink-0 overflow-y-auto">
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Layer Control</span>
            <button className="text-slate-600 hover:text-slate-400"><Info className="h-3 w-3" /></button>
          </div>
        </div>

        <div className="flex-1 py-1">
          {updatedLayers.map(layer => (
            <div key={layer.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/30 group">
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: layer.color }} />
              <span className="flex-1 text-[10px] text-slate-400 font-mono">{layer.id}</span>
              <span className="text-[9px] text-slate-600 group-hover:text-slate-400 min-w-[24px] text-right">{layer.count}</span>
              <button onClick={() => toggleLayer(layer.id)} className="text-slate-600 hover:text-slate-300 transition-colors">
                {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-slate-700" />}
              </button>
            </div>
          ))}
        </div>

        <div className="px-3 py-2 border-t border-slate-800 flex gap-2">
          <button onClick={showAll} className="flex-1 text-[9px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 py-1.5 rounded transition-colors">Show All</button>
          <button onClick={hideAll} className="flex-1 text-[9px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 py-1.5 rounded transition-colors">Hide All</button>
        </div>

        {/* Selected component summary */}
        <div className="border-t border-slate-800 px-3 py-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selected</span>
          {selectedComponent ? (
            <div className="mt-2 space-y-1 text-[9px]">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="h-3 w-3 text-accent" />
                <span className="font-bold text-slate-200">{selectedComponent.id}</span>
                <button onClick={() => setSelectedComponent(null)} className="ml-auto text-slate-600 hover:text-slate-400">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {selectedComponent.type === "qubit" && selectedComponent.freq && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">ω/2π</span><span className="text-violet-400 font-mono">{selectedComponent.freq.toFixed(3)} GHz</span></div>
                  {selectedComponent.anharmonicity && <div className="flex justify-between"><span className="text-slate-500">α/2π</span><span className="text-violet-400 font-mono">{selectedComponent.anharmonicity.toFixed(3)} GHz</span></div>}
                  {selectedComponent.EJ && <div className="flex justify-between"><span className="text-slate-500">EJ</span><span className="text-violet-400 font-mono">{selectedComponent.EJ.toFixed(2)} GHz</span></div>}
                  {selectedComponent.EC && <div className="flex justify-between"><span className="text-slate-500">EC</span><span className="text-violet-400 font-mono">{selectedComponent.EC.toFixed(3)} GHz</span></div>}
                </>
              )}
              {selectedComponent.type === "resonator" && selectedComponent.resonatorFreq && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">f_r</span><span className="text-blue-400 font-mono">{selectedComponent.resonatorFreq.toFixed(3)} GHz</span></div>
                  {selectedComponent.resonatorLength && <div className="flex justify-between"><span className="text-slate-500">Length</span><span className="text-blue-400 font-mono">{selectedComponent.resonatorLength.toFixed(2)} mm</span></div>}
                  {selectedComponent.detuning && <div className="flex justify-between"><span className="text-slate-500">Δ</span><span className="text-blue-400 font-mono">{selectedComponent.detuning.toFixed(3)} GHz</span></div>}
                </>
              )}
              {selectedComponent.type === "coupler" && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Qubit A</span><span className="text-orange-400 font-mono">{selectedComponent.qubitA}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Qubit B</span><span className="text-orange-400 font-mono">{selectedComponent.qubitB}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-orange-400 font-mono">CPW</span></div>
                </>
              )}
            </div>
          ) : (
            <p className="text-[9px] text-slate-600 mt-2 italic">Click a component to view</p>
          )}
        </div>

        {/* DRC Status */}
        <div className="border-t border-slate-800 px-3 py-3 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DRC Status</span>
          <div className="mt-2 flex items-start gap-2">
            {drcRan ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-emerald-400 font-semibold">No Violations</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Checked: just now</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-amber-400 font-semibold">Not Yet Run</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Click to check</p>
                </div>
              </>
            )}
          </div>
          <button onClick={runDRC}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 hover:border-slate-600"
            disabled={drcRunning}
          >
            {drcRunning ? <><RefreshCw className="h-3 w-3 animate-spin" /> Running...</> : <>Run DRC</>}
          </button>
        </div>
      </div>
    </div>
  );
}
