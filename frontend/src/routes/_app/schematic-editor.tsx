import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  Play,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Check,
  RefreshCw,
  FileCode,
  BookOpen,
} from "lucide-react";
import { parseQCLang, compileQCLang, getQCLangTemplates } from "@/lib/api/backend";
import { useDesign } from "@/lib/design-context";
import { useProject } from "@/lib/project-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/schematic-editor")({
  head: () => ({ meta: [{ title: "QCLang Editor — Silicofeller" }] }),
  component: SchematicEditorPage,
});

const PLACEHOLDER = `# QCLang — Quantum Chip Language
# Edit your chip definition below

chip MyChip

  variable target_frequency = 5.0
  variable substrate = "silicon"
  variable metal = "aluminum"

  qubit Q0 type=transmon frequency=4.9
  qubit Q1 type=transmon frequency=5.1
  qubit Q2 type=transmon frequency=4.92
  qubit Q3 type=transmon frequency=5.08

  coupler C0 connect(Q0,Q1)
  coupler C1 connect(Q1,Q2)
  coupler C2 connect(Q2,Q3)

  readout R0 connect(Q0)
  readout R1 connect(Q1)
  readout R2 connect(Q2)
  readout R3 connect(Q3)

end`;

function SchematicEditorPage() {
  const { updateActive, activeConversation } = useDesign();
  const { activeProject, saveDesign } = useProject();
  
  // Initialize with the generated source from the AI, or fallback to placeholder
  const initialSource = activeConversation?.result?.qclang_source || PLACEHOLDER;
  const [source, setSource] = useState(initialSource);

  // Keep in sync if the user generates a new chip via the AI Assistant
  useEffect(() => {
    if (activeConversation?.result?.qclang_source) {
      setSource(activeConversation.result.qclang_source);
    }
  }, [activeConversation?.result?.qclang_source]);

  const [errors, setErrors] = useState<Array<{ severity: string; message: string; line?: number }>>(
    [],
  );
  const [compiling, setParsing] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ name: string; description: string; source: string }>
  >([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getQCLangTemplates().then(setTemplates);
  }, []);

  // Live parse on change (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!source.trim()) return;
      try {
        const result = await parseQCLang(source);
        setErrors(result.errors);
      } catch {
        setErrors([]);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [source]);

  const handleCompile = async () => {
    setParsing(true);
    setCompiled(false);
    try {
      const result = await compileQCLang(source);
      if (result.success && result.result) {
        // Push compiled result into active conversation
        updateActive({ result: result.result });
        // Save to active project
        saveDesign(result.result);
        setErrors(result.errors as Array<{ severity: string; message: string; line?: number }>);
        setCompiled(true);
        setTimeout(() => setCompiled(false), 3000);
      } else {
        setErrors(result.errors as Array<{ severity: string; message: string; line?: number }>);
      }
    } catch {
      setErrors([
        {
          severity: "error",
          message: "Backend unavailable — run `python run.py` in backend folder",
        },
      ]);
    } finally {
      setParsing(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(source);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const downloadQC = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([source], { type: "text/plain" }));
    a.download = "project.qc";
    a.click();
  };

  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warnCount = errors.filter((e) => e.severity === "warning").length;

  const lineCount = source.split("\n").length;

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-[#F8F9FB]">
      {/* Left: editor panel */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header bar */}
        <div className="flex h-12 items-center justify-between border-b border-slate-200/50 bg-white px-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileCode className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold text-slate-900">project.qc</span>
            <span className="text-[10px] text-slate-400 font-mono">{lineCount} lines</span>
            {activeProject && (
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                📁 {activeProject.name.slice(0, 16)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Badge
                variant="outline"
                className="rounded-full text-[9px] font-bold px-2 py-0.5 border-rose-200 bg-rose-50 text-rose-700"
              >
                {errorCount} error{errorCount > 1 ? "s" : ""}
              </Badge>
            )}
            {warnCount > 0 && (
              <Badge
                variant="outline"
                className="rounded-full text-[9px] font-bold px-2 py-0.5 border-amber-200 bg-amber-50 text-amber-700"
              >
                {warnCount} warning{warnCount > 1 ? "s" : ""}
              </Badge>
            )}
            {errors.length === 0 && source.trim() && (
              <Badge
                variant="outline"
                className="rounded-full text-[9px] font-bold px-2 py-0.5 border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                ✓ Valid
              </Badge>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-accent border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-accent/40 transition-all"
              >
                <BookOpen className="h-3.5 w-3.5" /> Templates
              </button>
              <button
                onClick={copyCode}
                className="flex items-center gap-1 h-7 px-2 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px] font-bold"
              >
                {copyStatus ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={downloadQC}
                className="flex items-center gap-1 h-7 px-2 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px] font-bold"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <Button
                onClick={handleCompile}
                disabled={compiling || errorCount > 0}
                size="sm"
                className="rounded-lg bg-accent text-white text-[11px] font-bold h-7 px-3"
              >
                {compiling ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : compiled ? (
                  <Check className="h-3 w-3 mr-1 text-emerald-300" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                {compiled ? "Compiled!" : "Compile"}
              </Button>
            </div>
          </div>
        </div>

        {/* Template picker dropdown */}
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-slate-200 bg-white px-4 py-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Built-in Templates
            </p>
            <div className="flex gap-2 flex-wrap">
              {templates.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setSource(t.source);
                    setShowTemplates(false);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-accent hover:text-accent transition-all cursor-pointer"
                >
                  <Code2 className="h-3 w-3" /> {t.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Code editor (plain textarea — Monaco would go here in a real install) */}
        <div className="flex flex-1 min-h-0">
          {/* Line numbers */}
          <div className="flex flex-col bg-slate-900 text-slate-600 font-mono text-xs pt-3 px-3 text-right select-none shrink-0 overflow-hidden w-10">
            {source.split("\n").map((_, i) => (
              <span key={i} className="leading-6">
                {i + 1}
              </span>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="flex-1 bg-slate-900 text-slate-100 font-mono text-xs resize-none outline-none leading-6 pt-3 pr-4 pl-2"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
          />
        </div>

        {/* Error panel at bottom */}
        {errors.length > 0 && (
          <div className="border-t border-slate-700 bg-slate-900 max-h-32 overflow-y-auto">
            {errors.map((e, i) => {
              const Icon =
                e.severity === "error"
                  ? XCircle
                  : e.severity === "warning"
                    ? AlertTriangle
                    : CheckCircle2;
              const color =
                e.severity === "error"
                  ? "text-rose-400"
                  : e.severity === "warning"
                    ? "text-amber-400"
                    : "text-emerald-400";
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 px-4 py-1.5 text-xs font-mono ${color}`}
                >
                  <Icon className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>
                    {e.line ? `L${e.line}: ` : ""}
                    {e.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: info panel */}
      <div className="w-72 border-l border-slate-200 bg-white flex flex-col overflow-y-auto shrink-0">
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            QCLang — Quick Reference
          </p>
        </div>
        <div className="p-4 space-y-4 text-[11px] font-mono text-slate-600">
          <div>
            <p className="font-bold text-slate-700 mb-1">chip &lt;name&gt;</p>
            <p className="text-slate-500">Top-level chip block</p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">qubit &lt;name&gt; [attrs]</p>
            <p className="text-slate-500">
              type=transmon|fluxonium
              <br />
              frequency=5.0
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">coupler &lt;name&gt; connect(a,b)</p>
            <p className="text-slate-500">CPW coupler between qubits</p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">readout &lt;name&gt; connect(q)</p>
            <p className="text-slate-500">λ/4 readout resonator</p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">variable &lt;name&gt; = &lt;val&gt;</p>
            <p className="text-slate-500">Design-level variable</p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">end</p>
            <p className="text-slate-500">Close chip block</p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 mt-auto">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            QCLang is the source of truth. Compile to sync the canvas, layout viewer, and frequency
            plan.
          </p>
        </div>
      </div>
    </div>
  );
}
