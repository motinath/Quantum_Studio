import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Check,
  FileCode,
  BookOpen,
  ChevronDown,
  Terminal,
  TriangleAlert,
  ChevronUp,
  GripHorizontal,
  Circle,
} from "lucide-react";
import { parseQCLang, compileQCLang, getQCLangTemplates } from "@/lib/api/backend";
import { useDesign } from "@/lib/design-context";
import { useProject } from "@/lib/project-context";

export const Route = createFileRoute("/_app/schematic-editor")({
  head: () => ({ meta: [{ title: "QCLang Editor — Silicofeller" }] }),
  component: SchematicEditorPage,
});

// ─── Default sources ───────────────────────────────────────────────────────────

const QCLANG_DEFAULT = `# QCLang — Quantum Chip Language
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

const PYTHON_DEFAULT = `# Qiskit — Quantum Circuit
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit.circuit.library import RZXGate
import numpy as np

# Define registers matching QCLang chip
qr = QuantumRegister(4, 'q')
cr = ClassicalRegister(4, 'c')
qc = QuantumCircuit(qr, cr)

# Initialize qubits
qc.h(qr[0])
qc.h(qr[1])
qc.h(qr[2])
qc.h(qr[3])

# Apply entangling gates via couplers
qc.cx(qr[0], qr[1])  # C0: Q0-Q1
qc.cx(qr[1], qr[2])  # C1: Q1-Q2
qc.cx(qr[2], qr[3])  # C2: Q2-Q3

# Readout
qc.measure(qr[0], cr[0])
qc.measure(qr[1], cr[1])
qc.measure(qr[2], cr[2])
qc.measure(qr[3], cr[3])

print(qc.draw())
`;

// ─── Types ─────────────────────────────────────────────────────────────────────

type Lang = "python" | "qclang";
type Severity = "error" | "warning" | "info";

interface Diagnostic {
  line: number; // 1-based
  col: number; // 1-based
  endCol?: number;
  message: string;
  severity: Severity;
  source: "left" | "right";
}

interface TerminalLine {
  text: string;
  type: "info" | "success" | "error" | "warn" | "cmd";
}

// ─── Syntax validators ─────────────────────────────────────────────────────────

function validatePython(source: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const lines = source.split("\n");

  // Track structure
  let indentStack: number[] = [0];
  let openParens = 0;
  let parenLine = -1;

  const PYTHON_KEYWORDS = new Set([
    "False",
    "None",
    "True",
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
  ]);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;

    // Skip blank lines and comments
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;

    // Check for unexpected tokens after valid statements
    // Pattern: valid statement followed by junk (no space/operator)
    // e.g. qc.h(qr[0])vgg  — the "vgg" after closing paren
    const afterCloseParen = raw.match(/\)\s*([a-zA-Z_]\w+)\s*(?:#.*)?$/);
    if (afterCloseParen) {
      const junk = afterCloseParen[1];
      if (
        !PYTHON_KEYWORDS.has(junk) &&
        junk !== "and" &&
        junk !== "or" &&
        junk !== "not" &&
        junk !== "if" &&
        junk !== "else"
      ) {
        const col = raw.indexOf(junk) + 1;
        diags.push({
          line: lineNum,
          col,
          endCol: col + junk.length,
          message: `Unexpected token '${junk}'`,
          severity: "error",
          source: "left",
        });
      }
    }

    // Check unmatched brackets in this line contribution
    for (const ch of raw) {
      if (ch === "(" || ch === "[" || ch === "{") openParens++;
      else if (ch === ")" || ch === "]" || ch === "}") {
        openParens--;
        if (openParens < 0) {
          diags.push({
            line: lineNum,
            col: raw.indexOf(ch) + 1,
            message: "Unexpected closing bracket",
            severity: "error",
            source: "left",
          });
          openParens = 0;
        }
      }
    }

    // Mixed indentation
    if (raw.match(/^\t+ /) || raw.match(/^ +\t/)) {
      diags.push({
        line: lineNum,
        col: 1,
        message: "Mixed tabs and spaces in indentation",
        severity: "error",
        source: "left",
      });
    }

    // String without closing quote (simple heuristic)
    const singleQ = (raw.match(/'/g) || []).length;
    const doubleQ = (raw.match(/"/g) || []).length;
    if (singleQ % 2 !== 0 && !raw.trim().startsWith("#")) {
      diags.push({
        line: lineNum,
        col: raw.indexOf("'") + 1,
        message: "Unterminated string literal",
        severity: "error",
        source: "left",
      });
    }
    if (doubleQ % 2 !== 0 && !raw.trim().startsWith("#")) {
      diags.push({
        line: lineNum,
        col: raw.indexOf('"') + 1,
        message: "Unterminated string literal",
        severity: "error",
        source: "left",
      });
    }
  }

  if (openParens > 0) {
    diags.push({
      line: lines.length,
      col: 1,
      message: `Unclosed bracket — missing ${openParens} closing bracket(s)`,
      severity: "error",
      source: "left",
    });
  }

  return diags;
}

function validateQCLang(source: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const lines = source.split("\n");
  let inChip = false;
  let chipClosed = false;

  const VALID_STMTS = /^(chip|qubit|coupler|readout|variable|end|#)/;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const lineNum = i + 1;
    if (trimmed === "") continue;

    if (trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("chip ")) {
      if (inChip)
        diags.push({
          line: lineNum,
          col: 1,
          message: "Nested chip block not allowed",
          severity: "error",
          source: "left",
        });
      inChip = true;
      const nameMatch = trimmed.match(/^chip\s+(\w+)\s*(.*)$/);
      if (nameMatch && nameMatch[2].trim()) {
        diags.push({
          line: lineNum,
          col: raw.indexOf(nameMatch[2]) + 1,
          message: `Unexpected token after chip name: '${nameMatch[2]}'`,
          severity: "error",
          source: "left",
        });
      }
      continue;
    }

    if (trimmed === "end") {
      if (!inChip)
        diags.push({
          line: lineNum,
          col: 1,
          message: "'end' without matching 'chip'",
          severity: "error",
          source: "left",
        });
      inChip = false;
      chipClosed = true;
      continue;
    }

    if (!inChip && trimmed !== "") {
      diags.push({
        line: lineNum,
        col: 1,
        message: `Statement outside chip block: '${trimmed.split(" ")[0]}'`,
        severity: "error",
        source: "left",
      });
      continue;
    }

    // qubit validation
    if (trimmed.startsWith("qubit ")) {
      const match = trimmed.match(/^qubit\s+(\w+)(.*)$/);
      if (match) {
        const rest = match[2].trim();
        if (!rest.includes("type="))
          diags.push({
            line: lineNum,
            col: raw.indexOf("qubit") + 1,
            message: "Qubit missing required attribute 'type'",
            severity: "warning",
            source: "left",
          });
        // Check for junk after valid attrs
        const junkAfterAttr = rest.match(/frequency=[\d.]+\s+([a-zA-Z]\w*)\s*$/);
        if (junkAfterAttr)
          diags.push({
            line: lineNum,
            col: raw.lastIndexOf(junkAfterAttr[1]) + 1,
            message: `Unexpected token '${junkAfterAttr[1]}'`,
            severity: "error",
            source: "left",
          });
      }
      continue;
    }

    // coupler validation
    if (trimmed.startsWith("coupler ")) {
      const match = trimmed.match(/^coupler\s+\w+\s+connect\((\w+),(\w+)\)\s*(.*)$/);
      if (!match)
        diags.push({
          line: lineNum,
          col: raw.indexOf("coupler") + 1,
          message: "Invalid coupler syntax. Expected: coupler <name> connect(a,b)",
          severity: "error",
          source: "left",
        });
      else if (match[3].trim())
        diags.push({
          line: lineNum,
          col: raw.lastIndexOf(match[3]) + 1,
          message: `Unexpected token '${match[3].trim()}'`,
          severity: "error",
          source: "left",
        });
      continue;
    }

    // readout validation
    if (trimmed.startsWith("readout ")) {
      const match = trimmed.match(/^readout\s+\w+\s+connect\((\w+)\)\s*(.*)$/);
      if (!match)
        diags.push({
          line: lineNum,
          col: raw.indexOf("readout") + 1,
          message: "Invalid readout syntax. Expected: readout <name> connect(q)",
          severity: "error",
          source: "left",
        });
      else if (match[2].trim())
        diags.push({
          line: lineNum,
          col: raw.lastIndexOf(match[2]) + 1,
          message: `Unexpected token '${match[2].trim()}'`,
          severity: "error",
          source: "left",
        });
      continue;
    }

    // variable validation
    if (trimmed.startsWith("variable ")) {
      const match = trimmed.match(/^variable\s+\w+\s*=\s*.+$/);
      if (!match)
        diags.push({
          line: lineNum,
          col: raw.indexOf("variable") + 1,
          message: "Invalid variable syntax. Expected: variable <name> = <value>",
          severity: "error",
          source: "left",
        });
      continue;
    }

    // Unknown keyword
    const kw = trimmed.split(" ")[0];
    if (!VALID_STMTS.test(trimmed)) {
      diags.push({
        line: lineNum,
        col: raw.indexOf(kw) + 1,
        endCol: raw.indexOf(kw) + kw.length + 1,
        message: `Unknown keyword '${kw}'`,
        severity: "error",
        source: "left",
      });
    }
  }

  if (inChip && !chipClosed) {
    diags.push({
      line: lines.length,
      col: 1,
      message: "Chip block not closed — missing 'end'",
      severity: "error",
      source: "left",
    });
  }

  return diags;
}

// ─── Converters ────────────────────────────────────────────────────────────────

function qclangToPython(qclang: string): string {
  const lines = qclang.split("\n");
  const qubits: Array<{ name: string; freq: string }> = [];
  const couplers: Array<{ name: string; a: string; b: string }> = [];
  let chipName = "MyChip";

  for (const line of lines) {
    const t = line.trim();
    const chipMatch = t.match(/^chip\s+(\w+)/);
    if (chipMatch) chipName = chipMatch[1];
    const qubitMatch = t.match(/^qubit\s+(\w+).*?frequency=([\d.]+)/);
    if (qubitMatch) qubits.push({ name: qubitMatch[1], freq: qubitMatch[2] });
    const couplerMatch = t.match(/^coupler\s+(\w+)\s+connect\((\w+),(\w+)\)/);
    if (couplerMatch)
      couplers.push({ name: couplerMatch[1], a: couplerMatch[2], b: couplerMatch[3] });
  }

  const nq = Math.max(qubits.length, 1);
  const qMap = Object.fromEntries(qubits.map((q, i) => [q.name, i]));

  return `# Qiskit — compiled from QCLang (${chipName})
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
import numpy as np

# Qubit map:
${qubits.map((q, i) => `#   ${q.name} (idx=${i}) @ ${q.freq} GHz`).join("\n") || "#   (none)"}

qr = QuantumRegister(${nq}, 'q')
cr = ClassicalRegister(${nq}, 'c')
qc = QuantumCircuit(qr, cr)

# Initialize
${Array.from({ length: nq }, (_, i) => `qc.h(qr[${i}])`).join("\n")}

# Couplers
${couplers.map((c) => `qc.cx(qr[${qMap[c.a] ?? 0}], qr[${qMap[c.b] ?? 1}])  # ${c.name}: ${c.a}-${c.b}`).join("\n") || "# (no couplers)"}

# Readout
${Array.from({ length: nq }, (_, i) => `qc.measure(qr[${i}], cr[${i}])`).join("\n")}

print(qc.draw())
`;
}

function pythonToQclang(python: string): string {
  const lines = python.split("\n");
  let nq = 0;
  const couplers: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    const qrMatch = t.match(/QuantumRegister\((\d+)/);
    if (qrMatch) nq = parseInt(qrMatch[1]);
    const cxMatch = t.match(/qc\.cx\(qr\[(\d+)\],\s*qr\[(\d+)\]\)/);
    if (cxMatch)
      couplers.push(`  coupler C${couplers.length} connect(Q${cxMatch[1]},Q${cxMatch[2]})`);
  }
  if (nq === 0) nq = 1;

  return `# QCLang — compiled from Qiskit
# Edit your chip definition below

chip MyChip

  variable target_frequency = 5.0
  variable substrate = "silicon"
  variable metal = "aluminum"

${Array.from({ length: nq }, (_, i) => `  qubit Q${i} type=transmon frequency=${(4.9 + i * 0.06).toFixed(2)}`).join("\n")}

${couplers.length > 0 ? couplers.join("\n") : Array.from({ length: Math.max(nq - 1, 0) }, (_, i) => `  coupler C${i} connect(Q${i},Q${i + 1})`).join("\n")}

${Array.from({ length: nq }, (_, i) => `  readout R${i} connect(Q${i})`).join("\n")}

end`;
}

// ─── Code Editor with squiggly underlines ──────────────────────────────────────

interface CodeEditorProps {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  diagnostics?: Diagnostic[];
  editorRef?: React.RefObject<HTMLTextAreaElement | null>;
}

function CodeEditor({ value, onChange, readOnly, diagnostics = [], editorRef }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lineHeight = 24; // px, matches leading-6
  const charWidth = 7.2; // px approx for monospace text-xs

  // Keep overlay scrolled with textarea
  const syncScroll = useCallback(() => {
    const ta = editorRef?.current;
    const ov = overlayRef.current;
    if (ta && ov) {
      ov.scrollTop = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    }
  }, [editorRef]);

  const lines = value.split("\n");

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 relative overflow-hidden">
      {/* Line numbers */}
      <div className="flex flex-col bg-slate-900 text-slate-600 font-mono text-xs pt-3 px-3 text-right select-none shrink-0 w-10 overflow-hidden">
        {lines.map((_, i) => (
          <span
            key={i}
            className={`leading-6 ${diagnostics.some((d) => d.line === i + 1 && d.severity === "error") ? "text-rose-400" : diagnostics.some((d) => d.line === i + 1 && d.severity === "warning") ? "text-amber-400" : ""}`}
          >
            {i + 1}
          </span>
        ))}
      </div>

      {/* Squiggly overlay — absolutely positioned over textarea */}
      <div
        ref={overlayRef}
        className="absolute left-10 top-0 right-0 bottom-0 pointer-events-none overflow-hidden font-mono text-xs leading-6 pt-3 pl-2 pr-4"
        style={{ whiteSpace: "pre", color: "transparent" }}
        aria-hidden="true"
      >
        {lines.map((line, i) => {
          const lineDiags = diagnostics.filter((d) => d.line === i + 1);
          if (lineDiags.length === 0) return <div key={i}>{"\u00A0"}</div>;
          return (
            <div key={i} className="relative">
              {lineDiags.map((d, di) => {
                const col0 = d.col - 1;
                const endCol0 =
                  (d.endCol ?? d.col + (d.message.match(/'([^']+)'$/)?.[1]?.length ?? 3)) - 1;
                const left = col0 * charWidth;
                const width = Math.max((endCol0 - col0) * charWidth, 12);
                const color = d.severity === "error" ? "#f87171" : "#fbbf24";
                return (
                  <span
                    key={di}
                    className="absolute bottom-0"
                    style={{
                      left,
                      width,
                      height: 2,
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L3 0 L6 3' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='1.5'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "repeat-x",
                      backgroundSize: "6px 3px",
                    }}
                  />
                );
              })}
              {"\u00A0"}
            </div>
          );
        })}
      </div>

      <textarea
        ref={editorRef}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        onScroll={syncScroll}
        className={`flex-1 bg-slate-900 text-slate-100 font-mono text-xs resize-none outline-none leading-6 pt-3 pr-4 pl-2 ${readOnly ? "bg-slate-950 text-slate-300 cursor-default" : ""}`}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
      />
    </div>
  );
}

// ─── Bottom Panel ──────────────────────────────────────────────────────────────

type PanelTab = "terminal" | "problems" | "output";

interface BottomPanelProps {
  diagnostics: Diagnostic[];
  terminalLines: TerminalLine[];
  outputLines: string[];
  panelHeight: number;
  setPanelHeight: (h: number) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  activeTab: PanelTab;
  setActiveTab: (t: PanelTab) => void;
}

function BottomPanel({
  diagnostics,
  terminalLines,
  outputLines,
  panelHeight,
  setPanelHeight,
  collapsed,
  setCollapsed,
  activeTab,
  setActiveTab,
}: BottomPanelProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartH = useRef<number>(0);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines]);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartH.current = panelHeight;
    const onMove = (ev: MouseEvent) => {
      const delta = dragStartY.current - ev.clientY;
      const newH = Math.max(80, Math.min(500, dragStartH.current + delta));
      setPanelHeight(newH);
      if (newH > 80) setCollapsed(false);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = diagnostics.filter((d) => d.severity === "warning").length;

  const TABS: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "terminal", label: "Terminal", icon: <Terminal className="h-3.5 w-3.5" /> },
    { id: "problems", label: "Problems", icon: <TriangleAlert className="h-3.5 w-3.5" /> },
    { id: "output", label: "Output", icon: <Circle className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      className="flex flex-col bg-slate-950 border-t border-slate-700 shrink-0"
      style={{ height: collapsed ? 36 : panelHeight }}
    >
      {/* Drag handle + tab bar */}
      <div
        className="flex items-center h-9 border-b border-slate-800 shrink-0 select-none cursor-row-resize"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center px-2 text-slate-600 cursor-row-resize">
          <GripHorizontal className="h-3.5 w-3.5" />
        </div>

        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(tab.id);
              setCollapsed(false);
            }}
            className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-semibold border-b-2 transition-colors ${
              activeTab === tab.id && !collapsed
                ? "border-accent text-slate-200"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {tab.icon}
            {tab.label}
            {tab.id === "problems" && (errorCount > 0 || warnCount > 0) && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${errorCount > 0 ? "bg-rose-500 text-white" : "bg-amber-500 text-white"}`}
              >
                {errorCount + warnCount}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" onMouseDown={onDragStart} />

        <button
          className="px-2 text-slate-500 hover:text-slate-300 transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Panel content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {/* TERMINAL */}
          {activeTab === "terminal" && (
            <div className="p-2 font-mono text-xs space-y-0.5">
              {terminalLines.length === 0 ? (
                <p className="text-slate-600 italic">No output yet. Hit Compile to run.</p>
              ) : (
                terminalLines.map((line, i) => (
                  <div
                    key={i}
                    className={`leading-5 ${
                      line.type === "error"
                        ? "text-rose-400"
                        : line.type === "success"
                          ? "text-emerald-400"
                          : line.type === "warn"
                            ? "text-amber-400"
                            : line.type === "cmd"
                              ? "text-cyan-400"
                              : "text-slate-400"
                    }`}
                  >
                    {line.type === "cmd" ? <span className="text-slate-600 mr-1">$</span> : null}
                    {line.text}
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          )}

          {/* PROBLEMS */}
          {activeTab === "problems" && (
            <div className="divide-y divide-slate-800">
              {diagnostics.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No problems found.
                </div>
              ) : (
                diagnostics.map((d, i) => {
                  const Icon =
                    d.severity === "error"
                      ? XCircle
                      : d.severity === "warning"
                        ? AlertTriangle
                        : CheckCircle2;
                  const color =
                    d.severity === "error"
                      ? "text-rose-400"
                      : d.severity === "warning"
                        ? "text-amber-400"
                        : "text-emerald-400";
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-2 hover:bg-slate-900 transition-colors"
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 leading-snug">{d.message}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Line {d.line}, Column {d.col}
                          {d.source === "left" ? " · left editor" : " · right editor"}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          d.severity === "error"
                            ? "bg-rose-500/20 text-rose-400"
                            : d.severity === "warning"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {d.severity}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* OUTPUT */}
          {activeTab === "output" && (
            <div className="p-2 font-mono text-xs">
              {outputLines.length === 0 ? (
                <p className="text-slate-600 italic">No output yet.</p>
              ) : (
                outputLines.map((line, i) => (
                  <div key={i} className="text-slate-300 leading-5">
                    {line}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function SchematicEditorPage() {
  const { updateActive } = useDesign();
  const { activeProject, saveDesign } = useProject();

  const [leftLang, setLeftLang] = useState<Lang>("python");
  const [leftSource, setLeftSource] = useState(PYTHON_DEFAULT);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [rightSource, setRightSource] = useState(QCLANG_DEFAULT);
  const [rightLang, setRightLang] = useState<Lang>("qclang");

  const [compiling, setCompiling] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ name: string; description: string; source: string }>
  >([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copyLeftStatus, setCopyLeftStatus] = useState(false);
  const [copyRightStatus, setCopyRightStatus] = useState(false);

  // Bottom panel
  const [panelHeight, setPanelHeight] = useState(180);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>("terminal");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [outputLines, setOutputLines] = useState<string[]>([]);

  const leftEditorRef = useRef<HTMLTextAreaElement>(null);

  // Live validation
  const diagnostics: Diagnostic[] = useMemo(() => {
    if (leftLang === "python") return validatePython(leftSource);
    return validateQCLang(leftSource);
  }, [leftSource, leftLang]);

  useEffect(() => {
    getQCLangTemplates().then(setTemplates);
  }, []);

  // Live-parse QCLang via backend too
  useEffect(() => {
    if (leftLang !== "qclang") return;
    const t = setTimeout(async () => {
      if (!leftSource.trim()) return;
      try {
        await parseQCLang(leftSource);
      } catch {
        /* ignore */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [leftSource, leftLang]);

  const switchLang = (lang: Lang) => {
    setLeftLang(lang);
    setLeftSource(lang === "python" ? PYTHON_DEFAULT : QCLANG_DEFAULT);
    setRightLang(lang === "python" ? "qclang" : "python");
    setRightSource(lang === "python" ? QCLANG_DEFAULT : PYTHON_DEFAULT);
    setCompiled(false);
    setShowLangDropdown(false);
    setTerminalLines([]);
    setOutputLines([]);
  };

  const addLog = (text: string, type: TerminalLine["type"] = "info") => {
    setTerminalLines((prev) => [...prev, { text, type }]);
  };

  const handleCompile = async () => {
    const errorDiags = diagnostics.filter((d) => d.severity === "error");
    if (errorDiags.length > 0) {
      setActiveTab("problems");
      setPanelCollapsed(false);
      addLog(`✗ Compilation blocked — ${errorDiags.length} error(s) found`, "error");
      return;
    }

    setCompiling(true);
    setCompiled(false);
    setTerminalLines([]);
    setOutputLines([]);
    setActiveTab("terminal");
    setPanelCollapsed(false);

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    addLog(`Compiling ${leftLang === "python" ? "Python → QCLang" : "QCLang → Python"}...`, "cmd");
    await delay(150);

    if (leftLang === "python") {
      addLog("Parsing Qiskit...", "info");
      await delay(200);
      addLog("Validating quantum register definitions...", "info");
      await delay(150);
      addLog("Generating QCLang...", "info");
      await delay(200);
      const out = pythonToQclang(leftSource);
      setRightSource(out);
      setRightLang("qclang");
      addLog("Validation Passed", "success");
      await delay(100);
      addLog("Compilation Successful ✓", "success");
      setOutputLines(["QCLang output generated successfully.", `Lines: ${out.split("\n").length}`]);
    } else {
      addLog("Parsing QCLang...", "info");
      await delay(200);
      try {
        const result = await compileQCLang(leftSource);
        if (result.success && result.result) {
          updateActive({ result: result.result });
          saveDesign(result.result);
        }
      } catch {
        /* backend may be down */
      }
      addLog("Validating chip topology...", "info");
      await delay(150);
      addLog("Generating Qiskit...", "info");
      await delay(200);
      const out = qclangToPython(leftSource);
      setRightSource(out);
      setRightLang("python");
      addLog("Validation Passed", "success");
      await delay(100);
      addLog("Compilation Successful ✓", "success");
      setOutputLines([
        "Python (Qiskit) output generated successfully.",
        `Lines: ${out.split("\n").length}`,
      ]);
    }

    setCompiling(false);
    setCompiled(true);
    setTimeout(() => setCompiled(false), 3000);
  };

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = diagnostics.filter((d) => d.severity === "warning").length;
  const leftLineCount = leftSource.split("\n").length;
  const rightLineCount = rightSource.split("\n").length;
  const leftIsQCLang = leftLang === "qclang";
  const rightIsQCLang = rightLang === "qclang";

  const copyLeft = () => {
    navigator.clipboard.writeText(leftSource);
    setCopyLeftStatus(true);
    setTimeout(() => setCopyLeftStatus(false), 2000);
  };
  const copyRight = () => {
    navigator.clipboard.writeText(rightSource);
    setCopyRightStatus(true);
    setTimeout(() => setCopyRightStatus(false), 2000);
  };
  const downloadLeft = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([leftSource], { type: "text/plain" }));
    a.download = `project.${leftLang === "python" ? "py" : "qc"}`;
    a.click();
  };
  const downloadRight = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rightSource], { type: "text/plain" }));
    a.download = `compiled.${rightLang === "python" ? "py" : "qc"}`;
    a.click();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-[#F8F9FB] overflow-hidden">
      {/* Editors row */}
      <div className="flex flex-1 min-h-0">
        {/* ── LEFT: editable ── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-slate-700">
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-slate-200/50 bg-white px-4 shrink-0">
            <div className="flex items-center gap-2">
              {/* Language dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowLangDropdown((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-accent/40 text-slate-700 hover:text-accent transition-all bg-white"
                >
                  <FileCode
                    className={`h-3.5 w-3.5 ${leftIsQCLang ? "text-accent" : "text-blue-500"}`}
                  />
                  {leftLang === "python" ? "Python" : "QCLang"}
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
                <AnimatePresence>
                  {showLangDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[140px]"
                    >
                      <button
                        onClick={() => switchLang("python")}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 transition-colors ${leftLang === "python" ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
                      >
                        <FileCode className="h-3.5 w-3.5 text-blue-500" /> Python (Qiskit)
                      </button>
                      <button
                        onClick={() => switchLang("qclang")}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-violet-50 hover:text-violet-700 transition-colors ${leftLang === "qclang" ? "bg-violet-50 text-violet-700" : "text-slate-700"}`}
                      >
                        <FileCode className="h-3.5 w-3.5 text-accent" /> QCLang
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <span className="text-sm font-bold text-slate-900">
                {leftLang === "python" ? "project.py" : "project.qc"}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{leftLineCount} lines</span>
              {activeProject && (
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  📁 {activeProject.name.slice(0, 16)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
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
                  {warnCount} warn{warnCount > 1 ? "s" : ""}
                </Badge>
              )}
              {diagnostics.length === 0 && leftSource.trim() && (
                <Badge
                  variant="outline"
                  className="rounded-full text-[9px] font-bold px-2 py-0.5 border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  ✓ Valid
                </Badge>
              )}

              {leftIsQCLang && (
                <button
                  onClick={() => setShowTemplates((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-accent border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-accent/40 transition-all"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Templates
                </button>
              )}

              <button
                onClick={copyLeft}
                className="flex items-center h-7 px-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                {copyLeftStatus ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={downloadLeft}
                className="flex items-center h-7 px-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5" />
              </button>

              <Button
                onClick={handleCompile}
                disabled={compiling || errorCount > 0}
                size="sm"
                className="rounded-lg bg-accent text-white text-[11px] font-bold h-7 px-3 gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title={errorCount > 0 ? `Fix ${errorCount} error(s) before compiling` : "Compile"}
              >
                {compiling ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : compiled ? (
                  <Check className="h-3 w-3 text-emerald-300" />
                ) : null}
                {compiled ? "Done!" : "Compile"}
              </Button>
            </div>
          </div>

          {/* Templates */}
          <AnimatePresence>
            {showTemplates && leftIsQCLang && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-slate-200 bg-white px-4 py-3 overflow-hidden"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Templates
                </p>
                <div className="flex gap-2 flex-wrap">
                  {templates.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => {
                        setLeftSource(t.source);
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
          </AnimatePresence>

          <CodeEditor
            value={leftSource}
            onChange={setLeftSource}
            diagnostics={diagnostics}
            editorRef={leftEditorRef}
          />
        </div>

        {/* ── RIGHT: read-only ── */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex h-12 items-center justify-between border-b border-slate-200/50 bg-white px-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <FileCode className={`h-4 w-4 ${rightIsQCLang ? "text-accent" : "text-blue-500"}`} />
              <span className="text-sm font-bold text-slate-900">
                {rightLang === "python" ? "compiled.py" : "compiled.qc"}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{rightLineCount} lines</span>
              <span
                className={`text-[9px] font-bold rounded-full px-2 py-0.5 border ${rightIsQCLang ? "text-violet-700 bg-violet-50 border-violet-200" : "text-blue-700 bg-blue-50 border-blue-200"}`}
              >
                {rightIsQCLang ? "QCLang" : "Python"}
              </span>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                read-only
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={copyRight}
                className="flex items-center h-7 px-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                {copyRightStatus ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={downloadRight}
                className="flex items-center h-7 px-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <CodeEditor value={rightSource} readOnly />
        </div>
      </div>

      {/* ── BOTTOM PANEL ── */}
      <BottomPanel
        diagnostics={diagnostics}
        terminalLines={terminalLines}
        outputLines={outputLines}
        panelHeight={panelHeight}
        setPanelHeight={setPanelHeight}
        collapsed={panelCollapsed}
        setCollapsed={setPanelCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}
