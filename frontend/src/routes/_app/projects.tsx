import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  IconLayoutSidebar,
  IconSearch,
  IconBell,
  IconPlus,
  IconLayoutGrid,
  IconList,
  IconCpu,
  IconClock,
  IconVectorTriangle,
  IconSparkles,
  IconStack2,
  IconWaveSquare,
  IconCircleDot,
  IconComponents,
  IconFile,
  IconArrowRight
} from "@tabler/icons-react";
import { useProject } from "@/lib/project-context";
import { Project, fetchRecentActivity } from "@/lib/api/backend";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({ meta: [{ title: "Projects — Silicofeller" }] }),
  component: ProjectsPage,
});

const TEMPLATES = [
  {
    name: "Heavy Hex",
    desc: "IBM-compatible topology",
    svg: (
      <svg width="100%" height="100%" viewBox="0 0 100 56" className="overflow-visible">
        <line x1="20" y1="28" x2="40" y2="28" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
        <line x1="40" y1="28" x2="60" y2="28" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
        <line x1="60" y1="28" x2="80" y2="28" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
        <line x1="30" y1="18" x2="30" y2="38" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" />
        <line x1="50" y1="18" x2="50" y2="38" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" />
        <line x1="70" y1="18" x2="70" y2="38" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" />
        {[20, 40, 60, 80].map(x => <circle key={x} cx={x} cy="28" r="5" fill="#7C3AED" />)}
        {[30, 50, 70].map(x => <circle key={`t-${x}`} cx={x} cy="18" r="5" fill="#7C3AED" />)}
        {[30, 50, 70].map(x => <circle key={`b-${x}`} cx={x} cy="38" r="5" fill="#7C3AED" />)}
      </svg>
    ),
  },
  {
    name: "Surface code",
    desc: "Error correction topology",
    svg: (
      <svg width="100%" height="100%" viewBox="0 0 100 56" className="overflow-visible">
        <line x1="30" y1="20" x2="70" y2="20" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
        <line x1="30" y1="36" x2="70" y2="36" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
        <line x1="30" y1="20" x2="30" y2="36" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
        <line x1="50" y1="20" x2="50" y2="36" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
        <line x1="70" y1="20" x2="70" y2="36" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
        {[30, 50, 70].map(x => (
          <g key={x}>
            <circle cx={x} cy="20" r="5" fill="#6366F1" />
            <circle cx={x} cy="36" r="5" fill="#6366F1" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    name: "Linear chain",
    desc: "Simple qubit chain",
    svg: (
      <svg width="100%" height="100%" viewBox="0 0 100 56" className="overflow-visible">
        <line x1="20" y1="28" x2="80" y2="28" stroke="#7C3AED" strokeWidth="1.5" />
        {[20, 35, 50, 65, 80].map(x => <circle key={x} cx={x} cy="28" r="5" fill="#059669" />)}
        <circle cx="42.5" cy="28" r="4" fill="#7C3AED" />
      </svg>
    ),
  },
  {
    name: "Custom design",
    desc: "Start from scratch",
    svg: (
      <svg width="100%" height="100%" viewBox="0 0 100 56" className="overflow-visible">
        <line x1="50" y1="15" x2="35" y2="38" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.5" />
        <line x1="50" y1="15" x2="65" y2="38" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.5" />
        <line x1="35" y1="38" x2="65" y2="38" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.5" />
        <line x1="50" y1="15" x2="50" y2="28" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.5" />
        <line x1="35" y1="38" x2="50" y2="28" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.5" />
        <line x1="65" y1="38" x2="50" y2="28" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.5" />
        <circle cx="50" cy="15" r="5" fill="#6B7280" />
        <circle cx="35" cy="38" r="5" fill="#6B7280" />
        <circle cx="65" cy="38" r="5" fill="#6B7280" />
        <circle cx="50" cy="28" r="5" fill="#6B7280" />
      </svg>
    ),
  },
];

function ProjectCard({
  project,
  isActive,
  onClick,
}: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusColors = {
    active: "bg-[#D1FAE5] text-[#065F46]",
    draft: "bg-[#F3F4F6] text-[#6B7280]",
    in_progress: "bg-[#EEF2FF] text-[#3730A3]",
    completed: "bg-[#D1FAE5] text-[#065F46]",
    review: "bg-[#FEF3C7] text-[#92400E]",
  };

  const statusLabel = project.status || "draft";
  const sColor = statusColors[statusLabel as keyof typeof statusColors] || statusColors.draft;

  // Real backend has_design info, but we need to derive "components" and "designs" 
  // since the API might not expose them explicitly for this view.
  const statsComponents = project.num_qubits > 0 ? project.num_qubits * 2 + 4 : 0;
  const statsDesigns = project.has_design ? 1 : 0;
  const lastActivity = project.updated_at 
    ? new Date(project.updated_at).toLocaleDateString()
    : "Just now";

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-[#fff] rounded-[12px] p-[16px] cursor-pointer transition-colors duration-150",
        isActive ? "border-[2px] border-[#7C3AED]" : "border border-[#EEEFF2] hover:border-[#C4B5FD]"
      )}
    >
      <div className="flex items-center gap-[10px] mb-[12px]">
        <div className="w-[34px] h-[34px] rounded-[8px] bg-[#EDE9FE] flex items-center justify-center shrink-0">
          <IconCpu size={16} color="#7C3AED" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[6px]">
            <span className="text-[13px] font-[600] text-[#111827] truncate">{project.name}</span>
            <span className={cn("text-[10px] font-[600] px-[7px] py-[2px] rounded-[20px] shrink-0 capitalize", sColor)}>
              {statusLabel.replace("_", " ")}
            </span>
          </div>
          <div className="text-[11px] text-[#9CA3AF] truncate mt-0.5 capitalize">
            {project.topology.replace("-", " ")} · {project.num_qubits}Q
          </div>
        </div>
      </div>

      <div className="w-full h-[60px] bg-[#F8F9FB] rounded-[8px] mb-[10px] flex items-center justify-center overflow-hidden">
        <svg width="100%" height="100%" viewBox="0 0 100 56" className="overflow-visible">
          {isActive ? (
            <g>
              <line x1="20" y1="28" x2="80" y2="28" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
              <line x1="35" y1="15" x2="35" y2="41" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" />
              <line x1="65" y1="15" x2="65" y2="41" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" />
              {[20, 35, 50, 65, 80].map(x => <circle key={x} cx={x} cy="28" r="4" fill="#7C3AED" />)}
              <circle cx="35" cy="15" r="4" fill="#7C3AED" />
              <circle cx="35" cy="41" r="4" fill="#7C3AED" />
              <circle cx="65" cy="15" r="4" fill="#7C3AED" />
              <circle cx="65" cy="41" r="4" fill="#7C3AED" />
            </g>
          ) : (
            <g>
              <line x1="20" y1="28" x2="80" y2="28" stroke="#D1D5DB" strokeWidth="1.5" />
              <line x1="35" y1="15" x2="35" y2="41" stroke="#D1D5DB" strokeWidth="1.5" />
              <line x1="65" y1="15" x2="65" y2="41" stroke="#D1D5DB" strokeWidth="1.5" />
              {[20, 35, 50, 65, 80].map(x => <circle key={x} cx={x} cy="28" r="4" fill="#9CA3AF" />)}
              <circle cx="35" cy="15" r="4" fill="#9CA3AF" />
              <circle cx="35" cy="41" r="4" fill="#9CA3AF" />
              <circle cx="65" cy="15" r="4" fill="#9CA3AF" />
              <circle cx="65" cy="41" r="4" fill="#9CA3AF" />
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-col gap-[4px] mb-[10px]">
        <div className="flex items-center gap-[6px] text-[11px] text-[#6B7280]">
          <IconStack2 size={12} color="#9CA3AF" /> {project.substrate_material || "Silicon"} / {project.metal_layer || "Aluminum"}
        </div>
        <div className="flex items-center gap-[6px] text-[11px] text-[#6B7280]">
          <IconWaveSquare size={12} color="#9CA3AF" /> {project.target_frequency_ghz || 5} GHz target
        </div>
        <div className="flex items-center gap-[6px] text-[11px] text-[#6B7280]">
          <IconClock size={12} color="#9CA3AF" /> {lastActivity}
        </div>
      </div>

      <div className="border-t border-[#F3F4F6] pt-[10px] flex items-center justify-between">
        <div className="flex gap-[10px]">
          <div className="flex items-center gap-[3px] text-[11px] text-[#6B7280]">
            <IconCircleDot size={11} color="#9CA3AF" /> {project.num_qubits}Q
          </div>
          <div className="flex items-center gap-[3px] text-[11px] text-[#6B7280]">
            <IconComponents size={11} color="#9CA3AF" /> {statsComponents}
          </div>
          <div className="flex items-center gap-[3px] text-[11px] text-[#6B7280]">
            <IconFile size={11} color="#9CA3AF" /> {statsDesigns}
          </div>
        </div>
        <div className="flex items-center gap-[3px] text-[11px] text-[#7C3AED] font-[500]">
          <IconArrowRight size={11} /> Open
        </div>
      </div>
    </div>
  );
}

function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, activeProject, setActiveProject, createAndActivate, refreshProjects } = useProject();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [recentActivity, setRecentActivity] = useState<Array<{ title: string; time: string; project_id: string }>>([]);
  
  // New Project Form State
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [npName, setNpName] = useState("");
  const [npTopology, setNpTopology] = useState("heavy-hex");
  const [npQubits, setNpQubits] = useState(5);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    fetchRecentActivity().then(setRecentActivity);
  }, [projects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!npName.trim()) return;
    await createAndActivate({
      name: npName,
      topology: npTopology,
      num_qubits: npQubits,
    });
    setNewProjectOpen(false);
    setNpName("");
  };

  const filteredProjects = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full w-full bg-[#F8F9FB] flex flex-col font-sans text-[#111827]">
      <div className="flex-1 overflow-y-auto pb-[40px]">
        {/* SECTION 2 — PAGE HEADER */}
        <div className="px-[24px] pt-[24px] flex justify-between items-start">
          <div>
            <h1 className="text-[24px] font-[700] text-[#111827] leading-none">Projects</h1>
            <p className="text-[13px] text-[#6B7280] mt-[8px]">
              {projects.length} projects · Active:{" "}
              {activeProject ? (
                <span className="text-[#7C3AED] font-[500]">{activeProject.name}</span>
              ) : (
                "None"
              )}
            </p>
          </div>
          <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-[6px] bg-[#7C3AED] text-[#fff] border-none rounded-[8px] px-[18px] py-[9px] text-[13px] font-[500] cursor-pointer hover:bg-[#6D28D9] transition-colors">
                <IconPlus size={14} /> New project
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] font-sans">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Project Name</label>
                  <input 
                    autoFocus
                    required
                    value={npName}
                    onChange={e => setNpName(e.target.value)}
                    placeholder="e.g. 64Q Heavy Hex processor"
                    className="border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Topology</label>
                  <select 
                    value={npTopology}
                    onChange={e => setNpTopology(e.target.value)}
                    className="border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  >
                    <option value="heavy-hex">Heavy Hex</option>
                    <option value="surface-code">Surface code</option>
                    <option value="linear-chain">Linear chain</option>
                    <option value="custom">Custom design</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">Number of Qubits</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    value={npQubits}
                    onChange={e => setNpQubits(parseInt(e.target.value) || 5)}
                    className="border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => setNewProjectOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm bg-[#7C3AED] text-white rounded-md hover:bg-[#6D28D9] cursor-pointer">
                    Create
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* SECTION 3 — SEARCH + FILTERS + VIEW TOGGLE */}
        <div className="px-[24px] mt-[24px] flex items-center gap-[10px] flex-wrap">
          <div className="bg-[#fff] border border-[#E5E7EB] rounded-[8px] px-[14px] py-[8px] max-w-[320px] flex-1 flex items-center gap-[8px]">
            <IconSearch size={15} color="#9CA3AF" />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="border-none outline-none text-[13px] text-[#111827] bg-transparent w-full"
            />
          </div>

          <div className="flex items-center gap-[8px]">
            <button className="px-[12px] py-[5px] rounded-[20px] text-[12px] font-[500] cursor-pointer transition-colors border bg-[#EDE9FE] text-[#7C3AED] border-[#C4B5FD]">
              All projects
            </button>
          </div>

          <div className="flex border border-[#E5E7EB] rounded-[8px] overflow-hidden ml-auto">
            <button 
              onClick={() => setViewMode("grid")}
              className={cn(
                "px-[10px] py-[6px] border-none cursor-pointer",
                viewMode === "grid" ? "bg-[#EDE9FE] text-[#7C3AED]" : "bg-[#fff] text-[#9CA3AF] hover:text-[#6B7280]"
              )}
            >
              <IconLayoutGrid size={15} />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={cn(
                "px-[10px] py-[6px] border-none cursor-pointer",
                viewMode === "list" ? "bg-[#EDE9FE] text-[#7C3AED]" : "bg-[#fff] text-[#9CA3AF] hover:text-[#6B7280]"
              )}
            >
              <IconList size={15} />
            </button>
          </div>
        </div>

        {/* SECTION 4 — ACTIVE PROJECT WORKSPACE CARD */}
        {activeProject && (
          <div className="mx-[24px] mt-[24px] bg-[#fff] rounded-[12px] border border-[#EEEFF2] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-[20px_24px] flex items-center justify-between gap-[16px] flex-wrap">
            <div className="flex items-center gap-[16px]">
              <div className="w-[44px] h-[44px] rounded-[10px] bg-[#EDE9FE] flex items-center justify-center shrink-0">
                <IconCpu size={20} color="#7C3AED" />
              </div>
              <div>
                <h2 className="text-[16px] font-[600] text-[#111827] leading-none">{activeProject.name}</h2>
                <p className="text-[13px] text-[#6B7280] mt-[5px] capitalize">
                  {activeProject.topology.replace("-", " ")} · {activeProject.num_qubits} Qubits · {activeProject.target_frequency_ghz} GHz · {activeProject.substrate_material} / {activeProject.metal_layer}
                </p>
                <div className="mt-[8px] flex gap-[8px]">
                  {activeProject.has_design && (
                    <span className="bg-[#D1FAE5] text-[#065F46] text-[11px] font-[600] px-[8px] py-[2px] rounded-[20px]">
                      Design Ready
                    </span>
                  )}
                  <span className="flex items-center gap-[4px] text-[11px] text-[#9CA3AF]">
                    <IconClock size={11} /> 
                    Last edited {activeProject.updated_at ? new Date(activeProject.updated_at).toLocaleDateString() : "recently"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-[8px]">
              <button 
                onClick={() => navigate({ to: "/layout-viewer" })}
                className="flex items-center gap-[6px] bg-[#7C3AED] text-[#fff] border-none rounded-[8px] px-[14px] py-[8px] text-[12px] font-[500] cursor-pointer hover:bg-[#6D28D9]"
              >
                <IconLayoutGrid size={14} /> Open designer
              </button>
              <button 
                onClick={() => navigate({ to: "/quantum-editor" })}
                className="flex items-center gap-[6px] bg-[#fff] text-[#111827] border border-[#E5E7EB] rounded-[8px] px-[14px] py-[8px] text-[12px] font-[500] cursor-pointer hover:bg-[#F9FAFB]"
              >
                <IconVectorTriangle size={14} /> Open canvas
              </button>
              <button 
                onClick={() => navigate({ to: "/designer" })}
                className="flex items-center gap-[6px] bg-[#fff] text-[#111827] border border-[#E5E7EB] rounded-[8px] px-[14px] py-[8px] text-[12px] font-[500] cursor-pointer hover:bg-[#F9FAFB]"
              >
                <IconSparkles size={14} /> AI designer
              </button>
            </div>
          </div>
        )}

        {/* SECTION 6 — PROJECT CARDS GRID */}
        <div className="mt-[32px]">
          <h3 className="px-[24px] mb-[10px] text-[11px] font-[600] text-[#9CA3AF] uppercase tracking-[0.07em]">
            All projects
          </h3>
          <div className="px-[24px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
            {filteredProjects.map(p => (
              <ProjectCard 
                key={p.id}
                project={p}
                isActive={activeProject?.id === p.id}
                onClick={() => setActiveProject(p)}
              />
            ))}
          </div>
        </div>

        {/* SECTION 5 — START FROM TEMPLATE */}
        <div className="mt-[32px]">
          <h3 className="px-[24px] mb-[10px] text-[11px] font-[600] text-[#9CA3AF] uppercase tracking-[0.07em]">
            Start from template
          </h3>
          <div className="px-[24px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[12px]">
            {TEMPLATES.map(t => (
              <div 
                key={t.name}
                className="bg-[#fff] rounded-[12px] border border-[#EEEFF2] p-[14px] opacity-50 cursor-not-allowed"
              >
                <div className="w-full h-[56px] bg-[#F8F7FA] rounded-[8px] mb-[10px] flex items-center justify-center overflow-hidden">
                  {t.svg}
                </div>
                <h4 className="text-[12px] font-[600] text-[#111827]">{t.name}</h4>
                <p className="text-[11px] text-[#9CA3AF] mt-[2px] mb-[8px] truncate">{t.desc}</p>
                <button className="flex items-center gap-[3px] text-[11px] text-[#7C3AED] font-[500] border-none bg-transparent p-0 cursor-not-allowed pointer-events-none">
                  <IconPlus size={11} /> Create
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 7 — BOTTOM ROW */}
        <div className="mt-[32px] px-[24px] grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-[14px]">
          {/* Recent Activity */}
          <div className="bg-[#fff] rounded-[12px] border border-[#EEEFF2] p-[16px]">
            <div className="flex items-center gap-[6px] mb-[12px]">
              <IconClock size={15} color="#7C3AED" />
              <span className="text-[13px] font-[600] text-[#111827]">Recent activity</span>
            </div>
            
            <div className="pl-[16px] border-l border-[#E5E7EB] ml-[8px]">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, i, arr) => (
                  <div key={i} className={cn("relative", i !== arr.length - 1 && "pb-[12px]")}>
                    <div className="absolute left-[-22px] top-[3px] w-[10px] h-[10px] rounded-full bg-[#7C3AED] border-[2px] border-[#fff]" />
                    <div className="text-[12px] font-[500] text-[#111827] leading-none">{activity.title}</div>
                    <div className="text-[11px] text-[#9CA3AF] mt-[3px]">
                      {new Date(activity.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-[#9CA3AF] mt-[4px]">No recent activity</div>
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-[#fff] rounded-[12px] border border-[#EEEFF2] p-[16px]">
            <div className="flex items-center gap-[6px] mb-[12px]">
              <IconSparkles size={15} color="#7C3AED" />
              <span className="text-[13px] font-[600] text-[#111827]">AI project insights</span>
            </div>

            <div className="bg-[#EDE9FE] rounded-[8px] p-[12px] mb-[10px]">
              <div className="text-[20px] font-[700] text-[#7C3AED] leading-none">90%</div>
              <div className="text-[11px] text-[#5B21B6] mt-[4px]">Design complete</div>
              <div className="h-[4px] bg-[#C4B5FD] rounded-[4px] mt-[8px] overflow-hidden">
                <div className="h-full bg-[#7C3AED] rounded-[4px] w-[90%]" />
              </div>
            </div>

            <h4 className="text-[11px] font-[600] text-[#6B7280] uppercase tracking-[0.06em] mb-[6px] mt-[16px]">
              Recommendations
            </h4>
            <div className="flex flex-col gap-[6px]">
              <div className="bg-[#F8F9FB] rounded-[6px] p-[8px] text-[11px] text-[#111827] border border-[#EEEFF2] leading-relaxed">
                Check coupler frequency spacing
              </div>
              <div className="bg-[#F8F9FB] rounded-[6px] p-[8px] text-[11px] text-[#111827] border border-[#EEEFF2] leading-relaxed">
                Run full DRC verification
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
