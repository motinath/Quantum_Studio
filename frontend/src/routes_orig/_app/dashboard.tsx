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
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useDesign } from "@/lib/design-context";
import { useProject } from "@/lib/project-context";
import { fetchHealth, type HealthResponse } from "@/lib/api/backend";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Workspace — Silicofeller" }] }),
  component: WorkspaceHomePage,
});

// ----- Status badge color map -----
const STATUS_BADGE: Record<string, string> = {
  draft:       "bg-slate-50 text-slate-600 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-100",
  review:      "bg-amber-50 text-amber-700 border-amber-100",
  completed:   "bg-emerald-50 text-emerald-700 border-emerald-100",
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
    color: "text-accent bg-accent-soft",
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
    <svg width={w} height={h} className="overflow-visible">
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
  const activeProjects = projects.filter(p => p.status === "in_progress").length || designSessions;

  const kpis = [
    {
      label: "Total Projects",
      value: String(totalProjects),
      sub: activeProject ? `Active: ${activeProject.name.slice(0, 18)}` : "No active project",
      icon: TrendingUp,
      color: "#7C3AED",
      spark: [Math.max(0,totalProjects-4), Math.max(0,totalProjects-3), Math.max(0,totalProjects-2), Math.max(0,totalProjects-1), totalProjects, totalProjects, totalProjects, totalProjects],
    },
    {
      label: "Design Sessions",
      value: String(designSessions),
      sub: `${conversations.length} conversations`,
      icon: Activity,
      color: "#10B981",
      spark: [0, 1, 1, 2, 2, 3, designSessions-1 > 0 ? designSessions-1 : 0, designSessions],
    },
    {
      label: "Backend Status",
      value: health?.status === "online" ? "Online" : "Offline",
      sub: health?.status === "online" ? `v${health.version}` : "Run python run.py",
      subColor: health?.status === "online" ? "text-emerald-600" : "text-amber-600",
      icon: ShieldAlert,
      color: health?.status === "online" ? "#10B981" : "#F59E0B",
      spark: [1,1,1,1,1,1,1,health?.status === "online" ? 1 : 0],
    },
    {
      label: "Active Designs",
      value: String(activeProjects),
      sub: "In design sessions",
      icon: CheckCircle2,
      color: "#3B82F6",
      spark: [0, 0, 1, 1, 2, 2, Math.max(0,activeProjects-1), activeProjects],
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FB]">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {user?.name?.split(" ")[0] || "there"}! Here's what's happening with your
            quantum designs.
          </p>
        </motion.div>

        {/* KPI cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {k.label}
                    </div>
                    <div className="mt-2 text-3xl font-black text-slate-900">{k.value}</div>
                  </div>
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: `${k.color}15` }}
                  >
                    <k.icon className="h-4 w-4" style={{ color: k.color }} />
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className={`text-[11px] font-semibold ${k.subColor || "text-slate-500"}`}>
                    {k.sub}
                  </span>
                  <Sparkline points={k.spark} color={k.color} />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Row 2: projects / sim status / activity */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Recent Projects — live data */}
          <Card className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">Recent Projects</h2>
              <Link to="/projects" className="text-xs font-semibold text-accent hover:underline">View all</Link>
            </div>
            {projects.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-400 font-semibold">No projects yet</p>
                <Link to="/projects" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                  Create a project <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="pb-2 font-bold">Project</th>
                    <th className="pb-2 font-bold">Qubits</th>
                    <th className="pb-2 font-bold">Updated</th>
                    <th className="pb-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.slice(0, 5).map(p => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent-soft to-white border border-slate-200 flex items-center justify-center shrink-0">
                            <Cpu className="h-3 w-3 text-accent" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-[12px] truncate max-w-[120px]">{p.name}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{p.topology.replace("-"," ")} · {p.target_frequency_ghz} GHz</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-slate-700 font-semibold">{p.num_qubits || "—"}</td>
                      <td className="py-2.5 text-slate-500 text-[10px]">{new Date(p.updated_at).toLocaleDateString()}</td>
                      <td className="py-2.5">
                        <Badge variant="outline" className={`rounded-full text-[9px] font-bold px-2 py-0.5 border ${STATUS_BADGE[p.status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                          {p.status.replace("_"," ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </Card>

          {/* Simulation Status */}
          <Card className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900">Simulation Status</h2>
              <button className="text-xs font-semibold text-accent hover:underline">
                View all
              </button>
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
                      <span className="font-bold text-slate-900">{s.n}</span>
                      <span className="text-[10px] text-slate-400">{s.v}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-slate-500 font-semibold">Compute Usage</span>
                <span className="font-bold text-slate-900">85%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                  style={{ width: "85%" }}
                />
              </div>
              <div className="flex justify-between text-[10px] mt-1.5 text-slate-400">
                <span>GPU Hours (This Week)</span>
                <span className="font-semibold text-slate-600">342 / 400</span>
              </div>
            </div>
          </Card>

          {/* Activity */}
          <Card className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
              <button className="text-xs font-semibold text-accent hover:underline">
                View all
              </button>
            </div>
            <div className="space-y-3">
              {ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${a.color}`}
                  >
                    <a.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-bold text-slate-900 truncate">
                        {a.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{a.time}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Row 3: design overview / verification / quick actions / notifs */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Design Overview */}
          <Card className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">Design Overview</h2>
              <Link
                to="/layout-viewer"
                className="text-xs font-semibold text-accent hover:underline"
              >
                View in Layout
              </Link>
            </div>
            <div className="flex gap-4">
              <ChipSchematic />
              <div className="flex-1 space-y-2.5 text-xs">
                {[
                  { l: "Total Qubits", v: "64" },
                  { l: "Couplers", v: "112" },
                  { l: "Resonators", v: "64" },
                  { l: "Readout Lines", v: "16" },
                  { l: "Topology", v: "Heavy Hex", icon: true },
                ].map((row) => (
                  <div
                    key={row.l}
                    className="flex justify-between items-center pb-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-slate-500">{row.l}</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      {row.v}
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

          {/* Verification Summary */}
          <Card className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900">Verification Summary</h2>
              <Link
                to="/verification"
                className="text-xs font-semibold text-accent hover:underline"
              >
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
                    <span className="text-slate-600 w-12">{s.n}</span>
                    <span className="font-bold text-slate-900">{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Last checked: 1h ago</span>
              <Button
                size="sm"
                className="h-8 rounded-lg bg-accent hover:bg-accent-2 text-white text-xs font-bold"
              >
                Run Verification
              </Button>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h2>
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
                  className="aspect-square rounded-xl border border-slate-200 bg-white hover:border-accent hover:bg-accent-soft transition-colors flex flex-col items-center justify-center gap-1.5 text-center p-2"
                >
                  <a.icon className="h-4 w-4 text-accent" />
                  <span className="text-[9px] font-bold text-slate-700 leading-tight">
                    {a.label}
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          {/* Notifications */}
          <Card className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
              <button className="text-xs font-semibold text-accent hover:underline">
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
                    <div className="text-[11px] font-bold text-slate-900 leading-tight">
                      {n.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{n.sub}</div>
                    <div className="text-[9px] text-slate-300 mt-0.5">{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Simulations */}
        <Card className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Recent Simulations</h2>
            <Link to="/simulations" className="text-xs font-semibold text-accent hover:underline">
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
                <span className="text-xs font-bold text-slate-900 flex-1">{s.name}</span>
                <StatusBadge status={s.status} />
                <span className="text-xs text-slate-500 w-16 text-right">{s.time}</span>
                <span className="text-xs text-slate-500 w-24 text-right">{s.type}</span>
                <span className="text-xs text-slate-500 w-20 text-right">{s.usage}</span>
                <span className="text-xs text-slate-500 w-20 text-right">{s.runtime}</span>
                <button className="ml-3 text-slate-400 hover:text-accent">
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

// Heavy-hex inspired qubit chip schematic
function ChipSchematic() {
  const positions: { id: string; x: number; y: number }[] = [];
  const rows = 4,
    cols = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offset = r % 2 === 0 ? 0 : 22;
      positions.push({ id: `Q${r * cols + c + 1}`, x: 30 + c * 44 + offset, y: 30 + r * 40 });
    }
  }
  return (
    <svg
      viewBox="0 0 260 200"
      className="w-[240px] h-[180px] rounded-lg border border-slate-100 bg-slate-50/60"
    >
      {/* connections */}
      {positions.map((p, i) =>
        positions.slice(i + 1).map((q) => {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 50)
            return (
              <line
                key={`${p.id}-${q.id}`}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                stroke="#7C3AED"
                strokeWidth="1"
                opacity="0.35"
              />
            );
          return null;
        }),
      )}
      {/* readout lines on edges */}
      {[0, cols, cols * 2, cols * 3].map((idx) => (
        <line
          key={idx}
          x1={10}
          y1={positions[idx]?.y || 0}
          x2={positions[idx]?.x || 0}
          y2={positions[idx]?.y || 0}
          stroke="#D97706"
          strokeWidth="1.5"
        />
      ))}
      {/* qubits */}
      {positions.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r="9" fill="#fff" stroke="#7C3AED" strokeWidth="1.5" />
          <text
            x={p.x}
            y={p.y + 3}
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fill="#7C3AED"
          >
            {p.id}
          </text>
        </g>
      ))}
    </svg>
  );
}
