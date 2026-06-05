import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Settings, Bell, Shield, Cpu, Database, Key } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Silicofeller" }] }),
  component: SettingsPage,
});

const BACKEND = (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000").replace(/\/$/, "");

function SettingsPage() {
  const { user } = useAuth();
  const { activeProject, backendOnline } = useProject();

  const [wsName,   setWsName]   = useState(user?.organization ?? "Silicofeller Lab");
  const [maxQubits, setMaxQubits] = useState("256");
  const [backendUrl, setBackendUrl] = useState(BACKEND);
  const [claudeKey, setClaudeKey] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const [notifs, setNotifs] = useState({
    design_events:    true,
    verification_alerts: true,
    simulation_done:  true,
    weekly_digest:    false,
  });

  const save = (section: string) => {
    setSaved(section);
    setTimeout(() => setSaved(null), 2500);
  };

  const SECTIONS = [
    { id: "workspace", label: "Workspace",      icon: Cpu },
    { id: "backend",   label: "Backend",        icon: Database },
    { id: "ai",        label: "AI (Claude)",    icon: Key },
    { id: "notifs",    label: "Notifications",  icon: Bell },
    { id: "security",  label: "Security",       icon: Shield },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FB]">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl px-6 py-8 space-y-6"
      >
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Workspace, backend, AI, and notification preferences.</p>
        </div>

        {/* Workspace */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-slate-900">Workspace</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ws-name" className="text-xs font-bold text-slate-600">Organization Name</Label>
              <Input id="ws-name" value={wsName} onChange={e => setWsName(e.target.value)} className="mt-1.5 h-9 rounded-xl text-sm border-slate-200" />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Active Project</Label>
              <div className="mt-1.5 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center px-3 gap-2">
                {activeProject
                  ? <><span className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-sm text-slate-700 truncate">{activeProject.name}</span></>
                  : <span className="text-sm text-slate-400">No project selected</span>}
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Max Qubits</Label>
              <Input value={maxQubits} onChange={e => setMaxQubits(e.target.value)} type="number" className="mt-1.5 h-9 rounded-xl text-sm border-slate-200" />
            </div>
          </div>
          <Button onClick={() => save("workspace")} className="mt-4 h-9 rounded-xl bg-accent text-white text-xs font-bold px-5">
            {saved === "workspace" ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved!</> : "Save Changes"}
          </Button>
        </Card>

        {/* Backend */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold text-slate-900">Backend Connection</h2>
            </div>
            <Badge variant="outline" className={`rounded-full text-[9px] font-bold px-2 py-0.5 ${backendOnline ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
              {backendOnline ? "● Online" : "● Offline"}
            </Badge>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold text-slate-600">Backend URL</Label>
              <Input value={backendUrl} onChange={e => setBackendUrl(e.target.value)} className="mt-1.5 h-9 rounded-xl text-xs font-mono border-slate-200" placeholder="http://localhost:5000" />
              <p className="text-[10px] text-slate-400 mt-1">Changes take effect after page reload.</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start backend locally</p>
              <code className="text-[11px] font-mono text-slate-700 block">cd backend</code>
              <code className="text-[11px] font-mono text-slate-700 block">.venv\Scripts\python run.py</code>
              <p className="text-[10px] text-slate-400 mt-1.5">Docs: <a href={`${backendUrl}/docs`} target="_blank" className="text-accent hover:underline">{backendUrl}/docs</a></p>
            </div>
          </div>
        </Card>

        {/* Claude AI */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-slate-900">Claude AI</h2>
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-600">Anthropic API Key</Label>
            <Input
              type="password"
              value={claudeKey}
              onChange={e => setClaudeKey(e.target.value)}
              placeholder="sk-ant-..."
              className="mt-1.5 h-9 rounded-xl text-xs font-mono border-slate-200"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Set in <code className="font-mono">backend/.env</code> as <code className="font-mono">ANTHROPIC_API_KEY</code>.{" "}
              Without it, the assistant uses built-in rule-based responses.
            </p>
          </div>
          <Button onClick={() => save("ai")} className="mt-4 h-9 rounded-xl bg-accent text-white text-xs font-bold px-5">
            {saved === "ai" ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved!</> : "Save Key"}
          </Button>
        </Card>

        {/* Notifications */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
          </div>
          <div className="space-y-4">
            {[
              { id: "design_events",       label: "Design events",         desc: "When a chip is generated or edited" },
              { id: "verification_alerts", label: "Verification alerts",   desc: "DRC failures and frequency collisions" },
              { id: "simulation_done",     label: "Simulation completed",  desc: "When a simulation job finishes" },
              { id: "weekly_digest",       label: "Weekly digest",         desc: "Summary of activity each week" },
            ].map(n => (
              <div key={n.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-800">{n.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{n.desc}</p>
                </div>
                <Switch
                  checked={notifs[n.id as keyof typeof notifs]}
                  onCheckedChange={v => setNotifs(prev => ({ ...prev, [n.id]: v }))}
                />
              </div>
            ))}
          </div>
          <Button onClick={() => save("notifs")} className="mt-4 h-9 rounded-xl bg-accent text-white text-xs font-bold px-5">
            {saved === "notifs" ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved!</> : "Save Preferences"}
          </Button>
        </Card>

        {/* Security */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-slate-900">Security</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-800">JWT Token Expiry</p>
                <p className="text-[10px] text-slate-500">7 days (configured in backend/.env)</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[9px] font-bold bg-slate-50 border-slate-200">
                10080 min
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-bold text-slate-800">Auth Mode</p>
                <p className="text-[10px] text-slate-500">Local JWT — no external OAuth configured</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border-blue-200">
                JWT / HS256
              </Badge>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
