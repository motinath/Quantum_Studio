import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Cpu, Search, Trash2, MoreHorizontal, FolderOpen,
  FlaskConical, Layers, Calendar, ArrowRight, Loader2,
  Sparkles, CircuitBoard, CheckCircle2, Clock, Network,
  Edit3, Check, X, Save,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteProject, updateProject, type Project } from "@/lib/api/backend";
import { useProject } from "@/lib/project-context";
import { useDesign } from "@/lib/design-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({ meta: [{ title: "Projects — Silicofeller" }] }),
  component: ProjectsPage,
});

const STATUS_COLORS: Record<string, string> = {
  draft:       "bg-slate-50 text-slate-600 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-100",
  review:      "bg-amber-50 text-amber-700 border-amber-100",
  completed:   "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const TOPOLOGY_OPTIONS = ["custom","heavy-hex","surface-code","grid","ring","chain","star","all-to-all"];

// ── Create project modal ───────────────────────────────────────────────────────

function CreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: Parameters<ReturnType<typeof useProject>["createAndActivate"]>[0]) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [topology, setTopology] = useState("heavy-hex");
  const [qubits, setQubits] = useState("27");
  const [freq, setFreq] = useState("5.0");
  const [substrate, setSubstrate] = useState("silicon");
  const [metal, setMetal] = useState("aluminum");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate({
      name: name.trim(),
      topology,
      num_qubits: parseInt(qubits) || 0,
      target_frequency_ghz: parseFloat(freq) || 5.0,
      substrate_material: substrate,
      metal_layer: metal,
    });
    setSaving(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent-soft border border-accent/10 flex items-center justify-center">
                <Cpu className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">New Project</h2>
                <p className="text-xs text-slate-500">Define your quantum chip parameters</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Project Name *</p>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. IBM_Style_64Q"
              className="rounded-xl text-sm border-slate-200"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Topology</p>
              <Select value={topology} onValueChange={setTopology}>
                <SelectTrigger className="rounded-xl text-xs h-9 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOPOLOGY_OPTIONS.map(t => (
                    <SelectItem key={t} value={t} className="text-xs capitalize">{t.replace("-", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Qubits</p>
              <Input value={qubits} onChange={e => setQubits(e.target.value)} type="number" min={1} max={512} className="rounded-xl text-xs h-9 border-slate-200" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Freq (GHz)</p>
              <Input value={freq} onChange={e => setFreq(e.target.value)} type="number" step={0.1} className="rounded-xl text-xs h-9 border-slate-200" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Technology</p>
              <Select value={substrate} onValueChange={setSubstrate}>
                <SelectTrigger className="rounded-xl text-xs h-9 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="silicon" className="text-xs">Silicon</SelectItem>
                  <SelectItem value="sapphire" className="text-xs">Sapphire</SelectItem>
                  <SelectItem value="silicon_nitride" className="text-xs">SiN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Metal Layer</p>
            <Select value={metal} onValueChange={setMetal}>
              <SelectTrigger className="rounded-xl text-xs h-9 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aluminum"  className="text-xs">Aluminum (Al) — Standard</SelectItem>
                <SelectItem value="niobium"   className="text-xs">Niobium (Nb) — High Tc</SelectItem>
                <SelectItem value="tantalum"  className="text-xs">Tantalum (Ta) — Best T₁</SelectItem>
                <SelectItem value="nbtin"     className="text-xs">NbTiN — High KI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl text-sm font-bold h-10">Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-xl bg-accent text-white text-sm font-bold h-10"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Create Project
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, isActive, onActivate, onDelete, onEdit }: {
  project: Project;
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const { setActiveId } = useDesign();

  const openInDesigner = () => {
    onActivate();
    navigate({ to: "/designer" });
  };

  const openInCanvas = () => {
    onActivate();
    navigate({ to: "/quantum-editor" });
  };

  return (
    <Card className={cn(
      "rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all duration-200 group overflow-hidden",
      isActive ? "border-accent ring-1 ring-accent/20" : "border-slate-200"
    )}>
      {/* Active indicator */}
      {isActive && (
        <div className="h-1 bg-gradient-to-r from-accent to-violet-400 w-full" />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl border flex items-center justify-center shrink-0",
              isActive ? "bg-accent-soft border-accent/20" : "bg-slate-50 border-slate-200"
            )}>
              <Cpu className={cn("h-5 w-5", isActive ? "text-accent" : "text-slate-400")} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900 leading-tight">{project.name}</p>
                {isActive && (
                  <Badge variant="outline" className="rounded-full text-[9px] font-bold px-2 py-0.5 bg-accent-soft text-accent border-accent/20">
                    ACTIVE
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                {project.topology.replace("-", " ")} · {project.num_qubits > 0 ? `${project.num_qubits}Q` : "–"}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-44">
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={onActivate}>
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Set as Active
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={openInDesigner}>
                <Sparkles className="mr-2 h-3.5 w-3.5" /> Open in Designer
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={openInCanvas}>
                <CircuitBoard className="mr-2 h-3.5 w-3.5" /> Open in Canvas
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={onEdit}>
                <Edit3 className="mr-2 h-3.5 w-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-rose-600 cursor-pointer" onClick={onDelete}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats row */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Layers className="h-3 w-3 text-slate-300" />
            <span>{project.substrate_material} / {project.metal_layer}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <FlaskConical className="h-3 w-3 text-slate-300" />
            <span>{project.target_frequency_ghz} GHz target</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Calendar className="h-3 w-3 text-slate-300" />
            <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Design indicator */}
        {project.has_design && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1 w-fit">
            <CircuitBoard className="h-3 w-3" />
            <span className="font-bold">Design saved</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
          <Badge
            variant="outline"
            className={cn("rounded-full text-[10px] font-bold px-2.5 py-0.5 border", STATUS_COLORS[project.status] ?? STATUS_COLORS.draft)}
          >
            {project.status.replace("_", " ")}
          </Badge>
          <button
            onClick={openInDesigner}
            className="flex items-center gap-1 text-[10px] font-bold text-accent hover:underline cursor-pointer"
          >
            Open <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ProjectsPage() {
  const { projects, activeProject, setActiveProject, refreshProjects, createAndActivate, backendOnline } = useProject();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const navigate = useNavigate();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await deleteProject(id);
      await refreshProjects();
    } catch {
      alert("Failed to delete. Backend may be offline.");
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateProject(id, { name: editName.trim() } as never);
      await refreshProjects();
    } catch {}
    setEditingId(null);
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.topology.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FB]">
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onClose={() => setShowCreate(false)}
            onCreate={createAndActivate}
          />
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Projects</h1>
              <p className="text-sm text-slate-500 mt-1">
                {projects.length} project{projects.length !== 1 ? "s" : ""}
                {activeProject && <> · Active: <strong className="text-accent">{activeProject.name}</strong></>}
                {!backendOnline && <span className="text-amber-600 ml-2">(offline — backend not running)</span>}
              </p>
            </div>
            <Button
              onClick={() => setShowCreate(true)}
              className="rounded-xl bg-accent hover:bg-accent/90 text-white h-9 text-xs font-bold shadow-sm shadow-accent/20"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Project
            </Button>
          </div>
        </motion.div>

        {/* Search + filter row */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="pl-8 rounded-xl text-xs h-9 border-slate-200"
            />
          </div>
        </div>

        {/* Active project banner */}
        {activeProject && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <Card className="rounded-2xl border border-accent/20 bg-accent-soft p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center">
                    <Cpu className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{activeProject.name}</p>
                    <p className="text-xs text-slate-600">
                      {activeProject.topology} · {activeProject.num_qubits}Q · {activeProject.target_frequency_ghz} GHz
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/designer" })}
                    className="rounded-xl text-xs font-bold h-8 border-accent/20 hover:bg-white"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-accent" /> AI Designer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/schematic-editor" })}
                    className="rounded-xl text-xs font-bold h-8 border-accent/20 hover:bg-white"
                  >
                    <CircuitBoard className="h-3.5 w-3.5 mr-1.5 text-accent" /> QCLang Editor
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/quantum-editor" })}
                    className="rounded-xl text-xs font-bold h-8 border-accent/20 hover:bg-white"
                  >
                    <Network className="h-3.5 w-3.5 mr-1.5 text-accent" /> Canvas
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">
              {projects.length === 0 ? "No projects yet" : "No matches"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {projects.length === 0
                ? "Create a project to start designing quantum chips."
                : `No projects matching "${search}"`}
            </p>
            {projects.length === 0 && (
              <Button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl bg-accent text-white text-xs font-bold">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create your first project
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
              >
                {editingId === p.id ? (
                  <Card className="rounded-2xl border border-accent/20 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-700 mb-2">Rename Project</p>
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="rounded-xl text-xs mb-2"
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter") handleRename(p.id); if (e.key === "Escape") setEditingId(null); }}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleRename(p.id)} className="rounded-lg bg-accent text-white text-xs flex-1">
                        <Check className="h-3 w-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="rounded-lg text-xs">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <ProjectCard
                    project={p}
                    isActive={activeProject?.id === p.id}
                    onActivate={() => setActiveProject(p)}
                    onDelete={() => handleDelete(p.id)}
                    onEdit={() => { setEditingId(p.id); setEditName(p.name); }}
                  />
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
