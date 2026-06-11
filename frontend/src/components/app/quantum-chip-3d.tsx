/**
 * QuantumChip3D — Interactive 3D quantum chip visualization
 *
 * Renders qubits as 3D-style nodes, resonators as arcs, couplers as lines,
 * and feedlines as horizontal traces — all synced to simulation state.
 *
 * Uses pure SVG + CSS transforms so it works without WebGL / Three.js.
 * Drop this inside any dashboard panel without touching existing layout.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { GenerateResponse, PlacementQubit, PlacementEdge } from "@/lib/api/backend";

interface QubitTableRow {
  name: string;
  freq_GHz: number;
  group: string;
  T1_us?: number;
  T2_us?: number;
  status?: string;
  x_mm?: number;
  y_mm?: number;
}

interface Props {
  result?: GenerateResponse | null;
  className?: string;
  height?: number;
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  A: "#7C3AED",   // violet
  B: "#0EA5E9",   // sky
  C: "#F59E0B",   // amber  (star hub / overflow)
};
const STATUS_COLORS: Record<string, string> = {
  PASS: "#10B981",
  FAIL: "#EF4444",
};
const RESONATOR_COLOR = "#6366F1";
const COUPLER_COLOR   = "#94A3B8";
const FEEDLINE_COLOR  = "#D97706";
const CHIP_BG         = "#F8FAFF";
const CHIP_BORDER     = "#E2E8F0";

// ── Projection helpers ────────────────────────────────────────────────────────
// Simple isometric-lite: project (x, y, z) → (sx, sy) in SVG coords
function iso(x: number, y: number, z: number, cx: number, cy: number, scale: number) {
  const sx = cx + (x - y) * scale * 0.7;
  const sy = cy + (x + y) * scale * 0.4 - z * scale * 0.6;
  return { sx, sy };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ── Main component ────────────────────────────────────────────────────────────
export function QuantumChip3D({ result, className, height = 320 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const [rotation, setRotation] = useState(36);
  const [tilt, setTilt] = useState(54);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; mode: "rotate" | "pan" } | null>(null);

  // Animate "pulse" on qubits
  useEffect(() => {
    const id = setInterval(() => setAnimPhase(p => (p + 1) % 360), 50);
    return () => clearInterval(id);
  }, []);

  const fp        = result?.frequency_plan;
  const placement = result?.placement;
  const W = 560;
  const H = height;
  const cx = W / 2 + pan.x;
  const cy = H * 0.52 + pan.y;

  const project = (x: number, y: number, z: number) => {
    const theta = (rotation * Math.PI) / 180;
    const phi = (tilt * Math.PI) / 180;
    const xr = x * Math.cos(theta) - y * Math.sin(theta);
    const yr = x * Math.sin(theta) + y * Math.cos(theta);
    const sx = cx + xr * scale * zoom;
    const sy = cy + (yr * Math.cos(phi) - z * Math.sin(phi)) * scale * zoom;
    return { sx, sy };
  };

  // ── Build qubit data ──────────────────────────────────────────────────────
  type QubitNode = {
    name: string;
    x: number; y: number;
    group: string;
    freq: number;
    T1?: number;
    T2?: number;
    status: string;
  };

  const qubitNodes: QubitNode[] = [];

  // Prefer qubit_table (from corrector), else placement + freq_plan
  const qubitTable: QubitTableRow[] = (fp as any)?.qubit_table ?? [];

  if (qubitTable.length > 0) {
    qubitTable.forEach(q => {
      qubitNodes.push({
        name: q.name,
        x: q.x_mm ?? 0,
        y: q.y_mm ?? 0,
        group: q.group ?? "A",
        freq: q.freq_GHz,
        T1: q.T1_us,
        T2: q.T2_us,
        status: q.status ?? "PASS",
      });
    });
  } else if (placement?.qubits) {
    placement.qubits.forEach(pq => {
      const g = (fp?.qubit_groups?.[pq.name] as string) ?? "A";
      const freq = fp?.qubit_frequencies_GHz?.[pq.name] ?? 5.0;
      qubitNodes.push({
        name: pq.name, x: pq.x ?? 0, y: pq.y ?? 0,
        group: g, freq, status: "PASS",
      });
    });
  } else if (fp?.qubit_frequencies_GHz) {
    // Fallback: auto-layout from frequency data
    const names = Object.keys(fp.qubit_frequencies_GHz);
    const n = names.length;
    const cols = Math.ceil(Math.sqrt(n));
    names.forEach((name, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      qubitNodes.push({
        name, x: (col - (cols-1)/2) * 1.1, y: (row - Math.floor(n/cols)/2) * 1.1,
        group: (fp.qubit_groups?.[name] as string) ?? "A",
        freq: fp.qubit_frequencies_GHz[name], status: "PASS",
      });
    });
  }

  if (qubitNodes.length === 0) {
    // Demo mode: 5-qubit cross
    const demo = [
      { name: "Q1", x: 0, y: 0 }, { name: "Q2", x: 1.1, y: 0 },
      { name: "Q3", x: -1.1, y: 0 }, { name: "Q4", x: 0, y: 1.1 },
      { name: "Q5", x: 0, y: -1.1 },
    ];
    demo.forEach((d, i) => qubitNodes.push({
      ...d, group: i % 2 === 0 ? "A" : "B", freq: 4.9 + i * 0.1, status: "PASS",
    }));
  }

  // ── Normalise coordinates → scale to SVG ─────────────────────────────────
  const xs = qubitNodes.map(q => q.x);
  const ys = qubitNodes.map(q => q.y);
  const xRange = Math.max(Math.max(...xs) - Math.min(...xs), 0.01);
  const yRange = Math.max(Math.max(...ys) - Math.min(...ys), 0.01);
  const viewRange = Math.max(xRange, yRange);
  const scale = Math.min((W * 0.35) / viewRange, 28);

  // z = 0 (flat chip); slight z-tilt effect using animPhase
  const zChip = 0;

  type Proj = { sx: number; sy: number };
  const projected: Record<string, Proj> = {};
  qubitNodes.forEach(q => {
    projected[q.name] = project(q.x, q.y, zChip);
  });

  // ── Edges (couplers) ─────────────────────────────────────────────────────
  const edges: PlacementEdge[] = placement?.edges ?? [];
  const couplerMap = (fp as any)?.coupling_map as Array<{qubit_a:string; qubit_b:string; coupling_strength_MHz: number}> | undefined;

  // ── Chip boundary (isometric rectangle) ──────────────────────────────────
  const chipHalf = viewRange * scale * 0.72 + 18;
  const tl = project(-chipHalf / scale, -chipHalf / scale, 0);
  const tr = project(+chipHalf / scale, -chipHalf / scale, 0);
  const br = project(+chipHalf / scale, +chipHalf / scale, 0);
  const bl = project(-chipHalf / scale, +chipHalf / scale, 0);
  const chipPath = `M${tl.sx},${tl.sy} L${tr.sx},${tr.sy} L${br.sx},${br.sy} L${bl.sx},${bl.sy} Z`;

  // ── Feedlines ─────────────────────────────────────────────────────────────
  const feedlines: Array<{ name: string; y_mm: number }> =
    (fp as any)?.feedlines ?? [];

  const qubitR = Math.max(7, Math.min(14, 120 / Math.max(qubitNodes.length, 1)));
  const ringR  = qubitR + 4;
  const fieldCells = useMemo(() => Array.from({ length: 72 }, (_, i) => {
    const col = i % 12;
    const row = Math.floor(i / 12);
    const x = -2.75 + col * 0.5;
    const y = -1.25 + row * 0.5;
    const value = 0.45 + 0.5 * Math.sin(i * 0.73);
    return { x, y, value };
  }), []);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY, mode: e.shiftKey ? "pan" : "rotate" });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (drag.mode === "pan") {
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      setRotation(r => r + dx * 0.45);
      setTilt(t => Math.max(25, Math.min(72, t + dy * 0.25)));
    }
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setZoom(z => Math.max(0.65, Math.min(1.8, z - e.deltaY * 0.001)));
  };

  return (
    <div className={cn("relative select-none", className)} style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        style={{ fontFamily: "inherit", touchAction: "none", cursor: drag ? "grabbing" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
        onWheel={handleWheel}
      >
        {/* Background */}
        <rect x={0} y={0} width={W} height={H} fill="transparent" />

        {/* Chip substrate (isometric panel) */}
        <path
          d={chipPath}
          fill={CHIP_BG}
          stroke={CHIP_BORDER}
          strokeWidth={1.5}
          opacity={0.9}
        />
        {/* Chip edge shadow */}
        <path d={chipPath} fill="none" stroke="#C4CBE0" strokeWidth={3} opacity={0.3} />

        {/* EM field / capacitance intensity surface, inspired by HFSS and Q3D references */}
        {fieldCells.map((cell, i) => {
          const p = project(cell.x, cell.y, 0.04 + 0.08 * Math.sin((animPhase + i * 9) * Math.PI / 180));
          const heat = Math.max(0, Math.min(1, cell.value + 0.18 * Math.sin((animPhase + i * 5) * Math.PI / 180)));
          const color = heat > 0.72 ? "#ef4444" : heat > 0.52 ? "#f59e0b" : heat > 0.34 ? "#22c55e" : "#2563eb";
          return (
            <rect
              key={`field-${i}`}
              x={p.sx - 9 * zoom}
              y={p.sy - 4 * zoom}
              width={18 * zoom}
              height={8 * zoom}
              rx={2}
              fill={color}
              opacity={0.13 + heat * 0.28}
            />
          );
        })}

        {/* Grid lines on chip surface */}
        {qubitNodes.length <= 25 && qubitNodes.map((q, i) => {
          const { sx: qx, sy: qy } = projected[q.name];
          return (
            <line
              key={`grid-h-${i}`}
              x1={tl.sx + (tl.sx < tr.sx ? -4 : 4)} y1={qy}
              x2={tr.sx + (tl.sx < tr.sx ? 4 : -4)} y2={qy}
              stroke="#E2E8F0" strokeWidth={0.5} opacity={0.5}
            />
          );
        })}

        {/* Feedlines */}
        {feedlines.map((fl, i) => {
          const yN = fl.y_mm / Math.max(viewRange, 0.1) * (viewRange * scale) / scale;
          const fLeft  = project(-chipHalf / scale, yN, 0.02);
          const fRight = project(+chipHalf / scale, yN, 0.02);
          return (
            <line
              key={`fl-${i}`}
              x1={fLeft.sx} y1={fLeft.sy}
              x2={fRight.sx} y2={fRight.sy}
              stroke={FEEDLINE_COLOR} strokeWidth={2} strokeDasharray="6 3"
              opacity={0.7}
            />
          );
        })}

        {/* Coupler lines */}
        {edges.map((e, i) => {
          const a = projected[e.qubit_a];
          const b = projected[e.qubit_b];
          if (!a || !b) return null;
          const isHighlighted = hovered === e.qubit_a || hovered === e.qubit_b;
          const couplerStrength = couplerMap?.find(
            c => (c.qubit_a === e.qubit_a && c.qubit_b === e.qubit_b) ||
                 (c.qubit_b === e.qubit_a && c.qubit_a === e.qubit_b)
          )?.coupling_strength_MHz ?? 80;
          const opacity = isHighlighted ? 0.9 : 0.35;
          const sw = isHighlighted ? 2 : 1;
          return (
            <g key={`edge-${i}`}>
              <line
                x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy}
                stroke={COUPLER_COLOR} strokeWidth={sw} opacity={opacity}
              />
              {isHighlighted && (
                <text
                  x={(a.sx + b.sx) / 2}
                  y={(a.sy + b.sy) / 2 - 4}
                  textAnchor="middle"
                  fontSize={8}
                  fill={COUPLER_COLOR}
                  fontWeight={700}
                >
                  {couplerStrength} MHz
                </text>
              )}
            </g>
          );
        })}

        {/* Resonator arcs */}
        {qubitNodes.map((q, i) => {
          const { sx, sy } = projected[q.name];
          const resFreq = fp?.resonator_frequencies_GHz?.[`RO_${q.name}`];
          if (!resFreq) return null;
          // Arc goes upward from qubit node
          const arc_h = qubitR * 2.8;
          const arc_w = qubitR * 2.0;
          const d = `M${sx - arc_w},${sy} Q${sx},${sy - arc_h} ${sx + arc_w},${sy}`;
          const isHov = hovered === q.name;
          return (
            <g key={`res-${i}`}>
              <path
                d={d} fill="none"
                stroke={RESONATOR_COLOR}
                strokeWidth={isHov ? 2 : 1}
                strokeDasharray="3 2"
                opacity={isHov ? 0.9 : 0.45}
              />
              {isHov && (
                <text
                  x={sx} y={sy - arc_h - 4}
                  textAnchor="middle" fontSize={7} fill={RESONATOR_COLOR} fontWeight={700}
                >
                  {resFreq.toFixed(3)} GHz
                </text>
              )}
            </g>
          );
        })}

        {/* Qubit nodes */}
        {qubitNodes.map((q, i) => {
          const { sx, sy } = projected[q.name];
          const isHov = hovered === q.name;
          const groupColor  = GROUP_COLORS[q.group] ?? GROUP_COLORS.A;
          const statusColor = STATUS_COLORS[q.status] ?? STATUS_COLORS.PASS;
          // Pulsing ring phase
          const pulse = Math.sin((animPhase + i * 30) * (Math.PI / 180));
          const rPulse = ringR + pulse * 2;

          return (
            <g
              key={q.name}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(q.name)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Glow */}
              <circle
                cx={sx} cy={sy} r={rPulse + 4}
                fill={groupColor}
                opacity={isHov ? 0.18 : 0.07}
              />
              {/* Ring */}
              <circle
                cx={sx} cy={sy} r={ringR}
                fill="none"
                stroke={groupColor}
                strokeWidth={isHov ? 2 : 1}
                opacity={isHov ? 0.6 : 0.3}
              />
              {/* Qubit body */}
              <circle
                cx={sx} cy={sy} r={qubitR}
                fill={isHov ? groupColor : "white"}
                stroke={groupColor}
                strokeWidth={isHov ? 2.5 : 1.8}
              />
              {/* Status dot */}
              <circle
                cx={sx + qubitR * 0.6}
                cy={sy - qubitR * 0.6}
                r={3}
                fill={statusColor}
                stroke="white"
                strokeWidth={1}
              />
              {/* Label */}
              <text
                x={sx} y={sy + 3}
                textAnchor="middle"
                fontSize={Math.max(6, qubitR * 0.7)}
                fontWeight={700}
                fill={isHov ? "white" : groupColor}
              >
                {q.name}
              </text>

              {/* Hover tooltip */}
              {isHov && (
                <g>
                  <rect
                    x={sx - 48} y={sy - qubitR - 52}
                    width={96} height={44}
                    rx={6} ry={6}
                    fill="#1E293B" opacity={0.93}
                  />
                  <text x={sx} y={sy - qubitR - 37} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="white">
                    {q.name} · Group {q.group}
                  </text>
                  <text x={sx} y={sy - qubitR - 25} textAnchor="middle" fontSize={7.5} fill="#94A3B8">
                    {q.freq.toFixed(4)} GHz
                  </text>
                  {q.T1 && (
                    <text x={sx} y={sy - qubitR - 14} textAnchor="middle" fontSize={7} fill="#94A3B8">
                      T₁={q.T1}µs · T₂={q.T2}µs
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(12, 12)">
          {[
            { color: GROUP_COLORS.A, label: "Group A qubits" },
            { color: GROUP_COLORS.B, label: "Group B qubits" },
            { color: RESONATOR_COLOR, label: "Resonators" },
            { color: FEEDLINE_COLOR, label: "Feedlines" },
          ].map((item, i) => (
            <g key={i} transform={`translate(0, ${i * 16})`}>
              <circle cx={5} cy={5} r={4} fill={item.color} opacity={0.85} />
              <text x={14} y={9} fontSize={9} fill="#64748B" fontWeight={600}>{item.label}</text>
            </g>
          ))}
        </g>

        <g transform={`translate(12, ${H - 50})`}>
          <rect width="178" height="36" rx="9" fill="#0F172A" opacity="0.82" />
          <text x="10" y="14" fontSize="8" fontWeight="800" fill="#CBD5E1">INTERACTION</text>
          <text x="10" y="27" fontSize="8" fill="#E2E8F0">Drag rotate · Shift-drag pan · Wheel zoom</text>
        </g>

        {/* Stats badge */}
        <g transform={`translate(${W - 12}, 12)`}>
          <g transform="translate(-90, 0)">
            <rect x={0} y={0} width={90} height={28} rx={8} ry={8}
              fill="#1E293B" opacity={0.8} />
            <text x={8} y={12} fontSize={8} fontWeight={700} fill="#94A3B8">QUBITS</text>
            <text x={8} y={22} fontSize={10} fontWeight={900} fill="white">{qubitNodes.length}</text>
            <text x={44} y={12} fontSize={8} fontWeight={700} fill="#94A3B8">DRC</text>
            <text x={44} y={22} fontSize={10} fontWeight={900}
              fill={(result as any)?.drc?.passed ? "#10B981" : "#EF4444"}>
              {(result as any)?.drc?.passed ? "PASS" : result ? "FAIL" : "—"}
            </text>
            {fp && (
              <>
                <text x={70} y={12} fontSize={8} fontWeight={700} fill="#94A3B8">ε</text>
                <text x={68} y={22} fontSize={9} fontWeight={700} fill="#A78BFA">
                  {fp.epsilon_eff?.toFixed(2)}
                </text>
              </>
            )}
          </g>
        </g>
      </svg>
      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur">
        <button className="h-7 w-7 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-100" onClick={() => setZoom(z => Math.max(0.65, z - 0.12))}>-</button>
        <button className="h-7 rounded-lg px-2 text-[10px] font-bold text-slate-600 hover:bg-slate-100" onClick={() => { setRotation(36); setTilt(54); setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
        <button className="h-7 w-7 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-100" onClick={() => setZoom(z => Math.min(1.8, z + 0.12))}>+</button>
      </div>
    </div>
  );
}
