import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Activity, ShieldAlert, CheckCircle2,
  MoreHorizontal, Plus, Network, Cpu, PlayCircle,
  ShieldCheck, Upload, Download, AlertTriangle, Bell,
  Clock, Sparkles, FileText, Pencil, Zap, ArrowRight,
  Folder, Boxes, LayoutGrid, Import
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useDesign } from "@/lib/design-context";
import { useProject } from "@/lib/project-context";
import { fetchHealth, type HealthResponse } from "@/lib/api/backend";
import { QISKIT_CATALOG } from "@/components/quantum-editor/qiskit-metal-catalog";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Workspace — Silicofeller" }] }),
  component: WorkspaceHomePage,
});

// ----- Status badge color map for Projects -----
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-50 text-slate-600 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-100",
  review: "bg-amber-50 text-amber-700 border-amber-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const ACTIVITY = [
  {
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50",
    title: "Simulation completed",
    sub: "HeavyHex_64Q · EM Analysis",
    time: "2h ago",
  },
  {
    icon: ShieldAlert,
    color: "text-rose-600 bg-rose-50",
    title: "Verification alert",
    sub: "Frequency collision detected",
    time: "3h ago",
  },
  {
    icon: Pencil,
    color: "text-violet-600 bg-violet-50",
    title: "Design updated",
    sub: "SurfaceCode_49Q",
    time: "5h ago",
  },
  {
    icon: PlayCircle,
    color: "text-blue-600 bg-blue-50",
    title: "Simulation started",
    sub: "Chiplet_Demo · Eigenmode",
    time: "6h ago",
  },
  {
    icon: FileText,
    color: "text-slate-600 bg-slate-100",
    title: "Results exported",
    sub: "TestChip_v2 — Report.pdf",
    time: "1d ago",
  },
];

const NOTIFS = [
  {
    icon: ShieldAlert,
    color: "text-rose-600 bg-rose-50",
    title: "3 critical verification issues",
    sub: "Require immediate attention",
    time: "1h ago",
  },
  {
    icon: Clock,
    color: "text-amber-600 bg-amber-50",
    title: "Simulation queue is high",
    sub: "Your job may take longer",
    time: "2h ago",
  },
  {
    icon: Sparkles,
    color: "text-accent bg-accent-soft",
    title: "New version available",
    sub: "Quantum Studio v1.3.0",
    time: "1d ago",
  },
];

// Tiny SVG sparkline
function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 110,
    h = 36;
  const max = Math.max(...points),
    min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${i * step},${h - ((p - min) / range) * h}`)
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible select-none pointer-events-none">
      <path d={area} fill={color} opacity={0.12} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Donut chart
function Donut({
  segments,
  total,
  label,
}: {
  segments: { value: number; color: string }[];
  total: number;
  label: string;
}) {
  const r = 56,
    c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative w-[160px] h-[160px]">
      <svg viewBox="0 0 140 140" className="-rotate-90 w-full h-full">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#F1F5F9" strokeWidth="14" />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-slate-900">{total}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
    </div>
  );
}

// StatusBadge helper (kept for simulation table)
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Completed": "bg-emerald-50 text-emerald-700 border-emerald-100",
    "Running":   "bg-blue-50 text-blue-700 border-blue-100",
    "Queued":    "bg-amber-50 text-amber-700 border-amber-100",
    "Failed":    "bg-rose-50 text-rose-700 border-rose-100",
    "In Progress": "bg-blue-50 text-blue-700 border-blue-100",
    "Review":    "bg-amber-50 text-amber-700 border-amber-100",
  };
  return (
    <Badge variant="outline" className={`rounded-full text-[10px] font-bold px-2.5 py-0.5 border ${map[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status}
    </Badge>
  );
}

// 8-qubit topology SVG diagram
function QubitTopology() {
  const nodes = [
    { id: "Q1", x: 35, y: 35 },
    { id: "Q2", x: 95, y: 35 },
    { id: "Q3", x: 155, y: 35 },
    { id: "Q4", x: 215, y: 35 },
    { id: "Q5", x: 35, y: 105 },
    { id: "Q6", x: 95, y: 105 },
    { id: "Q7", x: 155, y: 105 },
    { id: "Q8", x: 215, y: 105 },
  ];

  const couplers = [
    // Horizontal
    { from: "Q1", to: "Q2" },
    { from: "Q2", to: "Q3" },
    { from: "Q3", to: "Q4" },
    { from: "Q5", to: "Q6" },
    { from: "Q6", to: "Q7" },
    { from: "Q7", to: "Q8" },
    // Vertical
    { from: "Q1", to: "Q5" },
    { from: "Q2", to: "Q6" },
    { from: "Q3", to: "Q7" },
    { from: "Q4", to: "Q8" },
  ];

  return (
    <svg
      viewBox="0 0 250 140"
      className="w-full h-auto bg-slate-50/50 rounded-lg border border-slate-100 p-2"
    >
      {/* Coupler connections */}
      {couplers.map((c, i) => {
        const fromNode = nodes.find((n) => n.id === c.from)!;
        const toNode = nodes.find((n) => n.id === c.to)!;
        return (
          <line
            key={i}
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke="#7C3AED"
            strokeWidth={1.5}
            opacity={0.3}
          />
        );
      })}

      {/* Qubit nodes */}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle
            cx={n.x}
            cy={n.y}
            r={14}
            stroke="#7C3AED"
            strokeWidth={1.5}
            fill="#FFFFFF"
          />
          <text
            x={n.x}
            y={n.y}
            dy=".3em"
            textAnchor="middle"
            fontSize={9}
            fill="#7C3AED"
            className="font-medium select-none"
            style={{ fontSize: "9px" }}
          >
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

function WorkspaceHomePage() {
  const { user } = useAuth();
  const { conversations } = useDesign();
  const { projects, activeProject, backendOnline } = useProject();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth);
  }, []);

  const designSessions = conversations.filter(c => c.result).length;
  const totalProjects = projects.length || designSessions || 0;

  const metrics = [
    {
      label: "Total Projects",
      value: String(totalProjects),
      subtext: activeProject ? `Active: ${activeProject.name.slice(0, 18)}` : "No active project",
      icon: Folder,
      iconBg: "#EDE9FE",
      iconColor: "#7C3AED",
      sparkColor: "#7C3AED",
      sparkPoints: [Math.max(0, totalProjects-4), Math.max(0, totalProjects-3), Math.max(0, totalProjects-2), Math.max(0, totalProjects-1), totalProjects, totalProjects],
    },
    {
      label: "Total Designs",
      value: String(designSessions),
      subtext: `${conversations.length} conversations`,
      icon: Cpu,
      iconBg: "#EFF6FF",
      iconColor: "#2563EB",
      sparkColor: "#2563EB",
      sparkPoints: [0, 1, 1, 2, designSessions-1 > 0 ? designSessions-1 : 0, designSessions],
    },
    {
      label: "Backend Status",
      value: health?.status === "online" ? "Online" : "Offline",
      subtext: health?.status === "online" ? `v${health.version}` : "Run python run.py",
      icon: ShieldAlert,
      iconBg: health?.status === "online" ? "#EFFDF4" : "#FEF3C7",
      iconColor: health?.status === "online" ? "#10B981" : "#F59E0B",
      sparkColor: health?.status === "online" ? "#10B981" : "#F59E0B",
      sparkPoints: [1, 1, 1, 1, 1, health?.status === "online" ? 1 : 0],
    },
    {
      label: "Component Library",
      value: QISKIT_CATALOG.length.toString(),
      subtext: "Official QComponent gallery",
      icon: Boxes,
      iconBg: "#F0FDF4",
      iconColor: "#059669",
      sparkColor: "#059669",
      sparkPoints: [25, 28, 27, 32, 35, QISKIT_CATALOG.length],
    },
  ];

  return (
    <div
      className="h-full overflow-y-auto bg-[#F8F9FB]"
      style={{
        backgroundImage: "radial-gradient(#E5E7EB 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* SECTION 1 — HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <p className="text-[13px] text-[#6B7280] font-normal" style={{ fontWeight: 400 }}>
              {new Date().toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <h1
              className="mt-1 text-[28px] font-bold text-[#111827] leading-tight"
              style={{ fontWeight: 700 }}
            >
              Hello, {user?.name?.split(" ")[0] || "Viswanath"}
            </h1>
            <p
              className="mt-0.5 text-[20px] font-semibold text-[#7C3AED]"
              style={{ fontWeight: 600 }}
            >
              How can I help you today?
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/projects"
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4.5 py-2 text-[14px] font-medium text-white hover:bg-[#6D28D9] transition-colors shadow-sm select-none"
              style={{ fontWeight: 500 }}
            >
              <Plus className="h-4 w-4" /> Create Design
            </Link>
            <Link
              to="/designer"
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4.5 py-2 text-[14px] font-medium text-[#111827] hover:bg-slate-50 transition-colors shadow-sm select-none"
              style={{ fontWeight: 500 }}
            >
              <LayoutGrid className="h-4 w-4 text-[#111827]" /> Open Designer
            </Link>
            <Link
              to="/designer"
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4.5 py-2 text-[14px] font-medium text-white hover:bg-[#6D28D9] transition-colors shadow-sm select-none"
              style={{ fontWeight: 500 }}
            >
              <Sparkles className="h-4 w-4" /> Ask AI ↗
            </Link>
          </div>
        </motion.div>

        {/* SECTION 2 — METRICS ROW */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <div className="bg-white rounded-xl border border-[#EEEFF2] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 flex flex-col justify-between relative h-full">
                <div className="flex justify-between items-start">
                  <span className="text-[13px] text-[#6B7280] font-medium" style={{ fontWeight: 500 }}>
                    {m.label}
                  </span>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: m.iconBg }}
                  >
                    <m.icon className="h-4 w-4" style={{ color: m.iconColor }} />
                  </div>
                </div>
                <div className="mt-1">
                  <div
                    className="text-[32px] font-bold text-[#111827] leading-none"
                    style={{ fontWeight: 700 }}
                  >
                    {m.value}
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <span className="text-[12px] text-[#6B7280] font-medium" style={{ fontWeight: 500 }}>
                    {m.subtext}
                  </span>
                  <Sparkline points={m.sparkPoints} color={m.sparkColor} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* SECTION 3 — TWO COLUMN ROW */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
          {/* LEFT: Design Overview Card */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="h-full"
          >
            <Card className="rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className="text-[16px] font-semibold text-[#111827]"
                    style={{ fontWeight: 600 }}
                  >
                    Design Overview
                  </h2>
                  <Link
                    to="/layout-viewer"
                    className="text-[13px] font-medium text-[#6366F1] hover:underline"
                    style={{ fontWeight: 500 }}
                  >
                    View in Layout
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 items-center">
                  {/* SVG Topology Diagram (Left 40%) */}
                  <div className="flex justify-center md:justify-start">
                    <QubitTopology />
                  </div>

                  {/* Key-Value parameters list (Right 60%) */}
                  <div className="space-y-3 text-[13px] text-[#111827]">
                    {[
                      { label: "Total Qubits", value: "8" },
                      { label: "Couplers", value: "10" },
                      { label: "Resonators", value: "8" },
                      { label: "Readout Lines", value: "4" },
                      { label: "Topology", value: "2x4 Lattice", icon: true },
                      { label: "Substrate", value: "Silicon (Si)" },
                    ].map((row, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center pb-2.5 border-b border-[#EEEFF2] last:border-0 last:pb-0"
                      >
                        <span className="text-[#6B7280] font-medium" style={{ fontWeight: 500 }}>
                          {row.label}
                        </span>
                        <span
                          className="font-semibold text-[#111827] flex items-center gap-1.5"
                          style={{ fontWeight: 600 }}
                        >
                          {row.value}
                          {row.icon && (
                            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                              <path
                                d="M3.5 1L0.5 6L3.5 11H10.5L13.5 6L10.5 1H3.5Z"
                                stroke="#7C3AED"
                                strokeWidth="1.2"
                              />
                            </svg>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* RIGHT: Recent Projects & Recent Activity Stack */}
          <div className="flex flex-col gap-4">
            {/* Recent Projects Card */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <Card className="rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className="text-[14px] font-semibold text-[#111827]"
                    style={{ fontWeight: 600 }}
                  >
                    Recent Projects
                  </h2>
                  <Link
                    to="/projects"
                    className="text-[13px] font-medium text-[#6366F1] hover:underline"
                    style={{ fontWeight: 500 }}
                  >
                    View all
                  </Link>
                </div>

                {projects.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-[#6B7280] font-semibold" style={{ fontWeight: 500 }}>
                      No projects yet
                    </p>
                    <Link
                      to="/projects"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] hover:underline"
                    >
                      Create a project <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-[#6B7280] font-semibold">
                          <th className="pb-2" style={{ fontWeight: 600 }}>
                            Project
                          </th>
                          <th className="pb-2 text-right" style={{ fontWeight: 600 }}>
                            Qubits
                          </th>
                          <th className="pb-2 text-right" style={{ fontWeight: 600 }}>
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.slice(0, 3).map((p) => (
                          <tr key={p.id} className="border-t border-[#EEEFF2]">
                            <td className="py-2.5">
                              <div>
                                <div
                                  className="font-semibold text-[#111827] text-[12px] truncate max-w-[150px]"
                                  style={{ fontWeight: 600 }}
                                >
                                  {p.name}
                                </div>
                                <div className="text-[10px] text-[#6B7280] capitalize font-medium">
                                  {p.topology.replace("-", " ")} · {p.target_frequency_ghz} GHz
                                </div>
                              </div>
                            </td>
                            <td
                              className="py-2.5 text-right text-[#111827] font-medium"
                              style={{ fontWeight: 500 }}
                            >
                              {p.num_qubits || "—"}
                            </td>
                            <td className="py-2.5 text-right">
                              <Badge
                                variant="outline"
                                className={`rounded-full text-[9px] font-semibold px-2 py-0.5 border ${STATUS_BADGE[p.status] || "bg-slate-50 text-slate-600 border-slate-200"}`}
                                style={{ fontWeight: 600 }}
                              >
                                {p.status.replace("_", " ")}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Recent Activity Card */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card className="rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className="text-[14px] font-semibold text-[#111827]"
                    style={{ fontWeight: 600 }}
                  >
                    Recent Activity
                  </h2>
                </div>

                <div className="space-y-3">
                  {ACTIVITY.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${a.color}`}
                      >
                        <a.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className="text-[12px] font-semibold text-[#111827] truncate"
                            style={{ fontWeight: 600 }}
                          >
                            {a.title}
                          </span>
                          <span
                            className="text-[10px] text-[#6B7280] shrink-0 font-medium"
                            style={{ fontWeight: 500 }}
                          >
                            {a.time}
                          </span>
                        </div>
                        <div
                          className="text-[10px] text-[#6B7280] truncate font-medium"
                          style={{ fontWeight: 500 }}
                        >
                          {a.sub}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* SECTION 4 — ADDITIONAL MAIN SECTIONS */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Simulation Status Card */}
          <Card className="lg:col-span-4 rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[14px] font-semibold text-[#111827]" style={{ fontWeight: 600 }}>Simulation Status</h2>
              <Link to="/simulations" className="text-[13px] font-medium text-[#6366F1] hover:underline" style={{ fontWeight: 500 }}>
                View all
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <Donut
                total={24}
                label="Total"
                segments={[
                  { value: 14, color: "#10B981" },
                  { value: 4, color: "#3B82F6" },
                  { value: 3, color: "#F59E0B" },
                  { value: 3, color: "#EF4444" },
                ]}
              />
              <div className="space-y-2 text-xs">
                {[
                  { c: "#10B981", n: "Completed", v: "14 (58%)" },
                  { c: "#3B82F6", n: "Running", v: "4 (17%)" },
                  { c: "#F59E0B", n: "Queued", v: "3 (13%)" },
                  { c: "#EF4444", n: "Failed", v: "3 (12%)" },
                ].map((s) => (
                  <div key={s.n} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.c }} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#111827]" style={{ fontWeight: 600 }}>{s.n}</span>
                      <span className="text-[10px] text-[#6B7280] font-medium">{s.v}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#EEEFF2]">
              <div className="flex justify-between text-[11px] mb-1.5 font-medium text-[#6B7280]">
                <span>Compute Usage</span>
                <span className="font-semibold text-[#111827]">85%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#3B82F6]"
                  style={{ width: "85%" }}
                />
              </div>
              <div className="flex justify-between text-[10px] mt-1.5 text-[#6B7280] font-medium">
                <span>GPU Hours (This Week)</span>
                <span className="font-semibold text-[#111827]">342 / 400</span>
              </div>
            </div>
          </Card>

          {/* Verification Summary Card */}
          <Card className="lg:col-span-4 rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[14px] font-semibold text-[#111827]" style={{ fontWeight: 600 }}>Verification Summary</h2>
              <Link to="/verification" className="text-[13px] font-medium text-[#6366F1] hover:underline" style={{ fontWeight: 500 }}>
                View all
              </Link>
            </div>
            <div className="flex items-center justify-around">
              <Donut
                total={12}
                label="Total Alerts"
                segments={[
                  { value: 3, color: "#EF4444" },
                  { value: 4, color: "#F59E0B" },
                  { value: 5, color: "#FACC15" },
                  { value: 0, color: "#3B82F6" },
                ]}
              />
              <div className="space-y-1.5 text-xs">
                {[
                  { c: "#EF4444", n: "Critical", v: 3 },
                  { c: "#F59E0B", n: "Major", v: 4 },
                  { c: "#FACC15", n: "Minor", v: 5 },
                  { c: "#3B82F6", n: "Info", v: 0 },
                ].map((s) => (
                  <div key={s.n} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.c }} />
                    <span className="text-[#6B7280] font-medium w-12">{s.n}</span>
                    <span className="font-semibold text-[#111827]">{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#EEEFF2] flex items-center justify-between">
              <span className="text-[10px] text-[#6B7280] font-medium">Last checked: 1h ago</span>
              <Button
                size="sm"
                className="h-8 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold px-3"
              >
                Run Verification
              </Button>
            </div>
          </Card>

          {/* Quick Actions Card */}
          <Card className="lg:col-span-2 rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <h2 className="text-[14px] font-semibold text-[#111827] mb-4" style={{ fontWeight: 600 }}>Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Plus, label: "New Project", to: "/projects" },
                { icon: Network, label: "New Schematic", to: "/schematic-editor" },
                { icon: Cpu, label: "Run Simulation", to: "/simulations" },
                { icon: ShieldCheck, label: "Run Verification", to: "/verification" },
                { icon: Sparkles, label: "Open Designer", to: "/designer" },
                { icon: Upload, label: "Import Design", to: "/projects" },
              ].map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="aspect-square rounded-xl border border-[#EEEFF2] bg-white hover:border-[#7C3AED] hover:bg-violet-50/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-center p-2"
                >
                  <a.icon className="h-4 w-4 text-[#7C3AED]" />
                  <span className="text-[9px] font-semibold text-[#4B5563] leading-tight" style={{ fontWeight: 600 }}>
                    {a.label}
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          {/* Notifications Card */}
          <Card className="lg:col-span-2 rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-[#111827]" style={{ fontWeight: 600 }}>Notifications</h2>
              <button className="text-[13px] font-medium text-[#6366F1] hover:underline">
                View all
              </button>
            </div>
            <div className="space-y-3">
              {NOTIFS.map((n, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div
                    className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${n.color}`}
                  >
                    <n.icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-[#111827] leading-tight" style={{ fontWeight: 600 }}>
                      {n.title}
                    </div>
                    <div className="text-[10px] text-[#6B7280] font-medium mt-0.5">{n.sub}</div>
                    <div className="text-[9px] text-[#9CA3AF] mt-0.5">{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* SECTION 5 — RECENT SIMULATIONS TABLE */}
        <Card className="mt-4 rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[#111827]" style={{ fontWeight: 600 }}>Recent Simulations</h2>
            <Link to="/simulations" className="text-[13px] font-medium text-[#6366F1] hover:underline" style={{ fontWeight: 500 }}>
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {[
              {
                name: "HeavyHex_64Q - EM Analysis",
                status: "Completed",
                time: "2h ago",
                type: "Eigenmode",
                usage: "64.2 GB",
                runtime: "12m 34s",
              },
              {
                name: "SurfaceCode_49Q - DRC",
                status: "Completed",
                time: "4h ago",
                type: "Verification",
                usage: "12.4 GB",
                runtime: "3m 12s",
              },
            ].map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <span className="text-xs font-semibold text-[#111827] flex-1" style={{ fontWeight: 600 }}>{s.name}</span>
                <StatusBadge status={s.status} />
                <span className="text-xs text-[#6B7280] font-medium w-16 text-right">{s.time}</span>
                <span className="text-xs text-[#6B7280] font-medium w-24 text-right">{s.type}</span>
                <span className="text-xs text-[#6B7280] font-medium w-20 text-right">{s.usage}</span>
                <span className="text-xs text-[#6B7280] font-medium w-20 text-right">{s.runtime}</span>
                <button className="ml-3 text-slate-400 hover:text-[#7C3AED]">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
