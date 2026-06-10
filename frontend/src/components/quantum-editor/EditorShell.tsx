import { useEffect, useState } from "react";
import { bootstrapRegistry } from "@/lib/quantum/registry/builtins";
import { templates } from "@/lib/quantum/templates";
import { useWorkspaceStore } from "@/lib/quantum/model/workspace-store";
import { TabStrip } from "./TabStrip";
import { SaveStatus } from "./SaveStatus";
import { ComponentPalette } from "./ComponentPalette";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { LayerManager } from "./LayerManager";
import { Console } from "./Console";
import { EditorToolbar } from "./Toolbar";
import { ChevronUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

bootstrapRegistry();

export function EditorShell() {
  const tabs = useWorkspaceStore(s => s.tabs);
  const openTab = useWorkspaceStore(s => s.openTab);
  const [consoleState, setConsoleState] = useState<"open" | "minimized" | "closed">("open");

  const undo = useWorkspaceStore(s => s.undo);
  const redo = useWorkspaceStore(s => s.redo);
  const fit = useWorkspaceStore(s => s.fitToScreen);

  // Seed default tabs on first open
  useEffect(() => {
    if (tabs.length === 0) {
      openTab(templates.find(t => t.id === "4q-linear")!.build());
      openTab(templates.find(t => t.id === "5q-heavy-hex")!.build());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global undo/redo + fit-to-screen shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta) {
        if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
        return;
      }
      if (e.key.toLowerCase() === "f" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        fit?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, fit]);

  const consoleHeight = consoleState === "open" ? "h-64" : consoleState === "minimized" ? "h-9" : "h-0";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tab strip + save row */}
      <div className="flex items-center gap-3 border-b bg-card px-3 py-1.5">
        <TabStrip />
        <SaveStatus />
      </div>

      {/* Main work area */}
      <div className="flex min-h-0 flex-1">
        {/* Left palette */}
        <aside className="w-56 shrink-0 border-r bg-card">
          <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Components
          </div>
          <div className="h-[calc(100%-37px)]">
            <ComponentPalette />
          </div>
        </aside>

        {/* Canvas + console */}
        <div className="flex min-w-0 flex-1 flex-col">
          <EditorToolbar />
          <div className="relative min-h-0 flex-1">
            <Canvas />
          </div>
          {consoleState === "closed" ? (
            <button
              onClick={() => setConsoleState("open")}
              className="flex h-7 items-center justify-center gap-2 border-t bg-card text-[11px] text-muted-foreground hover:bg-muted"
            >
              <ChevronUp className="h-3 w-3" />
              Show console
            </button>
          ) : (
            <div className={`${consoleHeight} transition-[height] duration-150`}>
              <Console state={consoleState} setState={setConsoleState} />
            </div>
          )}
        </div>

        {/* Right rail: Inspector / Layers */}
        <aside className="w-72 shrink-0 border-l bg-card">
          <Tabs defaultValue="inspector" className="flex h-full flex-col">
            <TabsList className="m-2 grid grid-cols-2">
              <TabsTrigger value="inspector" className="text-xs">Inspector</TabsTrigger>
              <TabsTrigger value="layers" className="text-xs">Layers</TabsTrigger>
            </TabsList>
            <TabsContent value="inspector" className="m-0 min-h-0 flex-1 overflow-auto">
              <Inspector />
            </TabsContent>
            <TabsContent value="layers" className="m-0 min-h-0 flex-1 overflow-auto">
              <LayerManager />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
