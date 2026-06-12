import { useState, useCallback, useRef, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/sonner";
import { WorkspaceProvider, useWorkspace } from "@/lib/editor/workspace-store";
import { ComponentLibrary } from "@/components/quantum-editor/component-library";
import { PropertyInspector } from "@/components/quantum-editor/property-inspector";
import { EditorCanvas, type EditorCanvasHandle } from "@/components/quantum-editor/editor-canvas";
import { EditorToolbar } from "@/components/quantum-editor/editor-toolbar";
import { CodeIdePanel, type CodePanelMode } from "@/components/quantum-editor/code-ide-panel";
import { CanvasTabs } from "@/components/quantum-editor/canvas-tabs";
import { SaveStatus } from "@/components/quantum-editor/save-status";
import { ChevronRight, Layers } from "lucide-react";

// ── Panel layout persistence (REQ-4) ─────────────────────────────────────────
const LAYOUT_KEY = "silicofeller:panel-layout:v1";

interface PanelLayout {
  libSize:       number;   // Component Library panel width %
  inspectorSize: number;   // Property Inspector panel width %
  codeSize:      number;   // Code IDE panel width %
  libOpen:       boolean;  // Whether the library panel is open
}

const LAYOUT_DEFAULTS: PanelLayout = {
  libSize:       18,
  inspectorSize: 24,
  codeSize:      40,
  libOpen:       false,
};

const PANEL_LIMITS = {
  lib:       { min: 12, max: 35 },
  inspector: { min: 14, max: 42 },
  code:      { min: 24, max: 62 },
} as const;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function loadLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { ...LAYOUT_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PanelLayout>;
    return {
      libSize:       clamp(parsed.libSize       ?? LAYOUT_DEFAULTS.libSize,       PANEL_LIMITS.lib.min,       PANEL_LIMITS.lib.max),
      inspectorSize: clamp(parsed.inspectorSize ?? LAYOUT_DEFAULTS.inspectorSize, PANEL_LIMITS.inspector.min, PANEL_LIMITS.inspector.max),
      codeSize:      clamp(parsed.codeSize      ?? LAYOUT_DEFAULTS.codeSize,      PANEL_LIMITS.code.min,      PANEL_LIMITS.code.max),
      libOpen:       typeof parsed.libOpen === "boolean" ? parsed.libOpen : LAYOUT_DEFAULTS.libOpen,
    };
  } catch {
    return { ...LAYOUT_DEFAULTS };
  }
}

function saveLayout(patch: Partial<PanelLayout>) {
  try {
    const current = loadLayout();
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ ...current, ...patch }));
  } catch { /* quota */ }
}

// ── Route definition ──────────────────────────────────────────────────────────
export const Route = createFileRoute("/_app/schematic-editor")({
  head: () => ({
    meta: [
      { title: "Schematic Editor — Silicofeller" },
      { name: "description", content: "Visual schematic editor for superconducting quantum chip design." },
    ],
  }),
  component: SchematicEditorPage,
});

function SchematicEditorPage() {
  return (
    <WorkspaceProvider>
      <SchematicEditorShell />
      <Toaster position="bottom-right" />
    </WorkspaceProvider>
  );
}

function SchematicEditorShell() {
  // Initialise from localStorage on first render
  const initialLayout = useRef(loadLayout());

  const [libOpen,       setLibOpen]       = useState(initialLayout.current.libOpen);
  const [codeMode,      setCodeMode]      = useState<CodePanelMode | null>(null);
  const [libSize,       setLibSize]       = useState(initialLayout.current.libSize);
  const [inspectorSize, setInspectorSize] = useState(initialLayout.current.inspectorSize);
  const [codeSize,      setCodeSize]      = useState(initialLayout.current.codeSize);

  const canvasRef = useRef<EditorCanvasHandle>(null);
  const { activeTab, saveAll } = useWorkspace();

  // Persist libOpen whenever it changes (REQ-5.2)
  useEffect(() => {
    saveLayout({ libOpen });
  }, [libOpen]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const handleFitView = useCallback(() => { canvasRef.current?.fitToContent(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag     = (document.activeElement as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); saveAll();
      }
      if (!inInput && e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); canvasRef.current?.fitToContent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAll]);

  // ── Layout persistence callbacks (REQ-4.2) ─────────────────────────────────
  // react-resizable-panels v4: onLayoutChanged fires AFTER drag ends.
  // The Layout type is { [panelId: string]: number } — a map of id → %.

  // Outer group: lib | centre | code
  const onOuterLayoutChanged = useCallback(
    (layout: { [id: string]: number }) => {
      if (libOpen) {
        const ls = layout["lib"];
        if (typeof ls === "number") {
          const clamped = clamp(ls, PANEL_LIMITS.lib.min, PANEL_LIMITS.lib.max);
          setLibSize(clamped);
          saveLayout({ libSize: clamped });
        }
      }
      if (codeMode) {
        const cs = layout["code"];
        if (typeof cs === "number") {
          const clamped = clamp(cs, PANEL_LIMITS.code.min, PANEL_LIMITS.code.max);
          setCodeSize(clamped);
          saveLayout({ codeSize: clamped });
        }
      }
    },
    [libOpen, codeMode],
  );

  // Inner group: canvas | inspector
  const onInnerLayoutChanged = useCallback(
    (layout: { [id: string]: number }) => {
      const is = layout["inspector"];
      if (typeof is === "number") {
        const clamped = clamp(is, PANEL_LIMITS.inspector.min, PANEL_LIMITS.inspector.max);
        setInspectorSize(clamped);
        saveLayout({ inspectorSize: clamped });
      }
    },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col overflow-hidden bg-background">

      {/* Toolbar */}
      <EditorToolbar
        libOpen={libOpen}
        onToggleLib={() => setLibOpen((v) => !v)}
        onFitView={handleFitView}
        onShowCode={(mode) => setCodeMode(mode)}
        canvasRef={canvasRef}
      />

      {/* Breadcrumb + save status */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-3 py-1">
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Schematic Editor</span>
        </nav>
        <SaveStatus />
      </div>

      {/* Canvas tabs */}
      <CanvasTabs />

      {/* ── Main workspace ─────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden flex">

        {/* REQ-5.3 — Collapsed library strip (visible when libOpen = false) */}
        {!libOpen && (
          <button
            type="button"
            onClick={() => setLibOpen(true)}
            title="Open Component Library"
            aria-label="Open Component Library"
            className="flex w-4 shrink-0 flex-col items-center justify-center gap-1 border-r border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Layers className="h-3 w-3" />
            <span
              className="text-[9px] font-bold uppercase tracking-widest select-none"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
            >
              Components
            </span>
            <ChevronRight className="h-3 w-3" />
          </button>
        )}

        {/* Resizable panels */}
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full flex-1"
          onLayoutChanged={onOuterLayoutChanged}
        >

          {/* Component Library (REQ-4 / REQ-5) */}
          {libOpen && (
            <>
              <ResizablePanel
                id="lib"
                defaultSize={libSize}
                minSize={PANEL_LIMITS.lib.min}
                maxSize={PANEL_LIMITS.lib.max}
                className="overflow-hidden bg-card"
              >
                <div className="h-full overflow-hidden p-2">
                  <ComponentLibrary />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Centre: Canvas + Property Inspector */}
          <ResizablePanel
            id="centre"
            defaultSize={codeMode ? 56 : 100}
            minSize={30}
            className="overflow-hidden"
          >
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full"
              onLayoutChanged={onInnerLayoutChanged}
            >
              {/* Canvas area */}
              <ResizablePanel
                id="canvas"
                defaultSize={100 - inspectorSize}
                minSize={40}
                className="overflow-hidden"
              >
                {/* key forces independent React tree per canvas tab */}
                <EditorCanvas key={activeTab.id} ref={canvasRef} />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Property Inspector */}
              <ResizablePanel
                id="inspector"
                defaultSize={inspectorSize}
                minSize={PANEL_LIMITS.inspector.min}
                maxSize={PANEL_LIMITS.inspector.max}
                className="overflow-y-auto border-l border-border bg-card p-3"
              >
                <PropertyInspector />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Code IDE panel (conditional) */}
          {codeMode && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="code"
                defaultSize={codeSize}
                minSize={PANEL_LIMITS.code.min}
                maxSize={PANEL_LIMITS.code.max}
                className="overflow-hidden"
              >
                <CodeIdePanel mode={codeMode} onClose={() => setCodeMode(null)} />
              </ResizablePanel>
            </>
          )}

        </ResizablePanelGroup>
      </div>
    </div>
  );
}
