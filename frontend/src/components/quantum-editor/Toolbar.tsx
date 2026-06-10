import { useState } from "react";
import { Undo2, Redo2, Maximize2, Code2, Download, Loader2, Copy, FileJson, FileBox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useWorkspaceStore, canUndo as canUndoFn, canRedo as canRedoFn, useActiveDocument } from "@/lib/quantum/model/workspace-store";
import { generateQiskitMetal } from "@/lib/quantum/codegen/qiskit-metal";
import { generateMetalCode } from "@/lib/api/backend";

function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EditorToolbar() {
  const undo = useWorkspaceStore(s => s.undo);
  const redo = useWorkspaceStore(s => s.redo);
  const fit = useWorkspaceStore(s => s.fitToScreen);
  const doc = useActiveDocument();
  useWorkspaceStore(s => s.historyTick);
  useWorkspaceStore(s => s.tabs);
  const cu = canUndoFn();
  const cr = canRedoFn();
  const [isGenerating, setIsGenerating] = useState(false);

  const localCode = doc ? generateQiskitMetal(doc) : "";

  // ── Generate Code via backend API (/api/generate/metal-code) ──────────────
  const handleGenerateCode = async () => {
    if (!doc) return;
    setIsGenerating(true);
    try {
      // Build payload from current document — map to the EditorComponent shape
      // the backend expects.
      const components = doc.components.map(inst => ({
        id: inst.id,
        type: inst.kind,
        name: inst.name,
        x: inst.placement.x,
        y: inst.placement.y,
        orientation: inst.placement.rotation,
        params: inst.params,
      }));
      const connections = doc.nets.map(n => ({
        id: n.netId,
        fromComp: n.from.component,
        fromPin: n.from.pin,
        toComp: n.to.component,
        toPin: n.to.pin,
      }));
      const variables = {
        chip_size_x: doc.chipSize.w,
        chip_size_y: doc.chipSize.h,
      };

      const result = await generateMetalCode({ components, connections, variables });
      downloadFile(`${doc.name || "design"}_metal.py`, result.code, "text/x-python");

      if (result.warnings?.length > 0) {
        toast.warning(`Generated with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`);
      } else {
        toast.success("Qiskit Metal code generated");
      }
    } catch (err) {
      // Backend unavailable — fall back to local codegen
      console.warn("Backend generate-metal-code failed, using local codegen:", err);
      downloadFile(`${doc?.name || "design"}_metal.py`, localCode, "text/x-python");
      toast.success("Code generated (local fallback — backend offline)");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 border-b bg-card/95 px-2 py-1">
        {/* Undo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!cu} onClick={undo} aria-label="Undo">
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Undo · Ctrl+Z</TooltipContent>
        </Tooltip>

        {/* Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!cr} onClick={redo} aria-label="Redo">
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Redo · Ctrl+Y / Ctrl+Shift+Z</TooltipContent>
        </Tooltip>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* Fit to screen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" disabled={!fit} onClick={() => fit?.()} aria-label="Fit to screen">
              <Maximize2 className="h-3.5 w-3.5" />
              Fit to Screen
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Fit to Screen · F</TooltipContent>
        </Tooltip>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* Generate Code — calls backend /api/generate/metal-code */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              className="h-7 gap-1.5 px-3 text-xs"
              disabled={isGenerating || !doc || doc.components.length === 0}
              onClick={handleGenerateCode}
            >
              {isGenerating
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Code2 className="h-3.5 w-3.5" />}
              {isGenerating ? "Generating…" : "Generate Code"}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">POST /api/generate/metal-code → downloads .py</TooltipContent>
        </Tooltip>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs" disabled={!doc}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onSelect={() => {
              if (!doc) return;
              downloadFile(`${doc.name}.py`, localCode, "text/x-python");
            }}>
              <Code2 className="mr-2 h-3.5 w-3.5" /> Download .py (local)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => {
              if (!doc) return;
              downloadFile(`${doc.name}.json`, JSON.stringify({ components: doc.components, nets: doc.nets, chipSize: doc.chipSize }, null, 2), "application/json");
            }}>
              <FileJson className="mr-2 h-3.5 w-3.5" /> Download .json
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => {
              if (!doc) return;
              navigator.clipboard.writeText(localCode);
              toast.success("Python code copied to clipboard");
            }}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Copy Python
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-2 text-[11px] text-muted-foreground font-mono">
          Hold Shift to pan · Alt for fine-snap · Scroll to zoom · F to fit
        </div>
      </div>
    </TooltipProvider>
  );
}
