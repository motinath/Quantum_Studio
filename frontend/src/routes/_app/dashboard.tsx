import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Folder,
  Cpu,
  Boxes,
  Plus,
  LayoutGrid,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Pencil,
  PlayCircle,
  FileText,
  Import,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { QISKIT_CATALOG } from "@/components/quantum-editor/qiskit-metal-catalog";
import { Button } from "@/components/ui/button";

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
  const { projects } = useProject();

  const metrics = [
    {
      label: "Total Projects",
      value: projects.length.toString(),
      subtext: `Active: ${projects.length > 0 ? projects[0].name : "None"}`,
      icon: Folder,
      iconBg: "#EDE9FE",
      iconColor: "#7C3AED",
      sparkColor: "#7C3AED",
      sparkPoints: [1, 2, 1.5, 3, 3.5, Math.max(4, projects.length)],
    },
    {
      label: "Total Designs",
      value: projects.reduce((acc, p) => acc + (p.topology ? 1 : 0), 0).toString(),
      subtext: "Synced from workspace",
      icon: Cpu,
      iconBg: "#EFF6FF",
      iconColor: "#2563EB",
      sparkColor: "#2563EB",
      sparkPoints: [6, 8, 7, 9, 10, projects.length + 2],
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
            <p className="text-[13px] text-[#6B7280] font-normal" style={{ fontWeight: 400 }}>Wed, Jun 11</p>
            <h1
              className="mt-1 text-[28px] font-bold text-[#111827] leading-tight"
              style={{ fontWeight: 700 }}
            >
              Hello, Viswanath
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
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          >
            <Card className="rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] h-full">
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

            {/* Quick Actions Card */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.35 }}
            >
              <Card className="rounded-xl border border-[#EEEFF2] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className="text-[14px] font-semibold text-[#111827]"
                    style={{ fontWeight: 600 }}
                  >
                    Quick Actions
                  </h2>
                </div>
                <div className="space-y-3">
                  <Button className="w-full justify-start gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg h-[38px] font-medium shadow-sm">
                    <Import className="h-4 w-4" /> Import Design
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
