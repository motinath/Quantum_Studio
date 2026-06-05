import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Library, Search, Copy, Check, ChevronDown, ChevronUp,
  Cpu, Radio, Zap, Cable, Plug, Box, Info,
} from "lucide-react";
import { LIBRARY, type ComponentDef, type ComponentCategory } from "@/components/quantum-editor/editor-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/component-library")({
  head: () => ({ meta: [{ title: "Component Library — Silicofeller" }] }),
  component: ComponentLibraryPage,
});

const CATEGORY_META: Record<ComponentCategory, { icon: React.ComponentType<{ className?: string }>; color: string; description: string }> = {
  qubits:         { icon: Cpu,   color: "text-amber-600 bg-amber-50 border-amber-200",  description: "Superconducting qubit elements — transmon pockets and cross geometries." },
  resonators:     { icon: Radio, color: "text-accent bg-accent-soft border-accent/20",   description: "Readout and coupling resonators — coil, open-to-ground, and meander styles." },
  couplers:       { icon: Zap,   color: "text-emerald-600 bg-emerald-50 border-emerald-200", description: "CPW coupling elements between qubits." },
  tlines:         { icon: Cable, color: "text-blue-600 bg-blue-50 border-blue-200",      description: "Transmission line segments — straight, meandered, and hybrid variants." },
  terminations:   { icon: Plug,  color: "text-slate-600 bg-slate-100 border-slate-200",  description: "Launchpad wirebonds, open and short terminations." },
  lumped:         { icon: Zap,   color: "text-rose-600 bg-rose-50 border-rose-200",      description: "Lumped-element capacitors and inductors for compact modelling." },
  "sample shapes":{ icon: Box,   color: "text-slate-500 bg-slate-50 border-slate-200",   description: "Rectangular placeholders and chip boundary markers." },
};

const CATEGORY_ORDER: ComponentCategory[] = [
  "qubits", "resonators", "couplers", "tlines", "terminations", "lumped", "sample shapes",
];

function ParamTable({ params }: { params: Record<string, string | number> }) {
  return (
    <table className="w-full text-[10px] mt-2">
      <thead>
        <tr className="text-left text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
          <th className="pb-1 pr-3">Parameter</th>
          <th className="pb-1">Default</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(params).map(([k, v]) => (
          <tr key={k} className="border-b border-slate-50">
            <td className="py-1 pr-3 font-mono text-slate-600">{k}</td>
            <td className="py-1 font-mono text-accent">{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ComponentCard({ def }: { def: ComponentDef }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = CATEGORY_META[def.category];

  const snippetQCLang = `qubit ${def.type.toLowerCase()}_0 type=transmon`;
  const snippetPython = `from qiskit_metal.qlibrary.qubits.${def.type.toLowerCase()} import ${def.type}\n${def.type.toLowerCase().slice(0, 2)} = ${def.type}(design, 'Q0', options=dict(\n${Object.entries(def.defaultParams).map(([k,v]) => `    ${k}='${v}'`).join(",\n")}\n))`;

  const copy = () => {
    navigator.clipboard.writeText(snippetPython);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-xl border flex items-center justify-center shrink-0", meta.color)}>
              <meta.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{def.label}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{def.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="rounded-full text-[9px] font-bold px-2 py-0.5 bg-slate-50 border-slate-200">
              {def.pins.length} pin{def.pins.length !== 1 ? "s" : ""}
            </Badge>
            <button
              onClick={copy}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-accent hover:border-accent/40 transition-all"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
            <button
              onClick={() => setExpanded(v => !v)}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-accent hover:border-accent/40 transition-all"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Pins row */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {def.pins.map(p => (
            <span key={p} className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
              {p}
            </span>
          ))}
        </div>

        {/* Size indicator */}
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
          <Box className="h-3 w-3" />
          <span>Default size: {def.size} mm · Qiskit Metal compatible</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-slate-100 px-4 pb-4"
        >
          <div className="pt-3 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Default Parameters</p>
              <ParamTable params={def.defaultParams} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Qiskit Metal Snippet</p>
              <pre className="text-[10px] bg-slate-900 text-slate-200 rounded-xl p-3 overflow-x-auto font-mono leading-relaxed">
                {snippetPython}
              </pre>
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  );
}

function ComponentLibraryPage() {
  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<ComponentCategory>>(new Set(CATEGORY_ORDER));

  const toggleCat = (cat: ComponentCategory) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const allDefs = CATEGORY_ORDER.flatMap(cat => LIBRARY[cat]);
  const filtered = search.trim()
    ? allDefs.filter(d =>
        d.label.toLowerCase().includes(search.toLowerCase()) ||
        d.category.toLowerCase().includes(search.toLowerCase()) ||
        Object.keys(d.defaultParams).some(k => k.toLowerCase().includes(search.toLowerCase()))
      )
    : null;

  const totalCount = allDefs.length;

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FB]">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent-soft border border-accent/10 flex items-center justify-center">
                <Library className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Component Library</h1>
                <p className="text-sm text-slate-500">{totalCount} Qiskit Metal–compatible components</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search components, parameters…"
            className="pl-8 rounded-xl text-xs h-9 border-slate-200"
          />
        </div>

        {/* Search results */}
        {filtered ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500">{filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{search}"</p>
            {filtered.map(def => <ComponentCard key={`${def.category}-${def.type}`} def={def} />)}
            {filtered.length === 0 && (
              <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-sm font-bold text-slate-700">No components match "{search}"</p>
              </Card>
            )}
          </div>
        ) : (
          /* Categorised view */
          <div className="space-y-4">
            {CATEGORY_ORDER.map(cat => {
              const defs = LIBRARY[cat];
              const meta = CATEGORY_META[cat];
              const isOpen = openCategories.has(cat);
              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center justify-between mb-2 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn("h-7 w-7 rounded-lg border flex items-center justify-center", meta.color)}>
                        <meta.icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 capitalize">{cat}</span>
                      <Badge variant="outline" className="rounded-full text-[9px] font-bold px-2 py-0.5 bg-white border-slate-200">
                        {defs.length}
                      </Badge>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 mb-2">{meta.description}</p>
                      {defs.map(def => <ComponentCard key={`${cat}-${def.type}`} def={def} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
