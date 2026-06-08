import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  ShieldCheck,
  RefreshCw,
  Download,
  ChevronDown,
  Copy,
  FileCode2,
  FileJson,
  FileBox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { generateMetalCode } from "@/lib/api/backend";
import type { EditorAction, EditorState } from "./editor-types";
import { exportToGDS, exportToJSON, exportToPython, runDRC } from "./editor-types";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  circuitName: string;
  conversationId: string | null;
}

function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EditorToolbar({ state, dispatch, circuitName, conversationId }: Props) {
  const navigate = useNavigate();
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const qubitCount = state.components.filter(
    (c) => c.type === "TransmonPocket" || c.type === "TransmonCross",
  ).length;

  const runDrcCheck = () => {
    const report = runDRC(state);
    if (report.passed)
      toast.success(
        `DRC passed · ${report.violations.length} warning${report.violations.length === 1 ? "" : "s"}`,
      );
    else
      toast.error(
        `DRC failed · ${report.violations.length} issue${report.violations.length === 1 ? "" : "s"}`,
      );
  };

  const rebuild = () => {
    // Force a rev bump so downstream sync re-runs
    dispatch({ type: "ZOOM", zoom: state.zoom });
    toast.success("Layout rebuilt");
  };

  const generateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const result = await generateMetalCode({
        components: state.components,
        connections: state.connections,
        variables: state.variables as unknown as Record<string, unknown>,
      });
      download(`${circuitName || "circuit"}_metal.py`, result.code, "text/x-python");
      if (result.warnings.length > 0) {
        toast.warning(`Generated with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`);
      } else {
        toast.success("Qiskit Metal code generated");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate code");
    } finally {
      setIsGeneratingCode(false);
    }
  };
  const back = () => {
    navigate({ to: "/designer" });
  };

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={back}
            className="h-8 gap-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Designer
          </Button>
          <span className="h-4 w-px bg-slate-200" />
          <span className="text-xs font-black text-slate-900">
            {circuitName || "Untitled Circuit"}
          </span>
          <Badge
            variant="secondary"
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100"
          >
            {qubitCount} Qubit{qubitCount === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: "UNDO" })}
                disabled={state.past.length === 0}
                className="h-8 w-8 rounded-lg"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: "REDO" })}
                disabled={state.future.length === 0}
                className="h-8 w-8 rounded-lg"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <Button
            variant="outline"
            size="sm"
            onClick={runDrcCheck}
            className="h-8 gap-1.5 rounded-lg text-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Run DRC
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={rebuild}
            className="h-8 gap-1.5 rounded-lg text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Rebuild
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={generateCode}
            disabled={isGeneratingCode || state.components.length === 0}
            className="h-8 gap-1.5 rounded-lg text-xs"
          >
            <FileCode2 className="h-3.5 w-3.5" /> {isGeneratingCode ? "Generating" : "Generate Code"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs text-white hover:bg-indigo-700"
              >
                <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() =>
                  download(`${circuitName || "circuit"}.py`, exportToPython(state), "text/x-python")
                }
              >
                <FileCode2 className="mr-2 h-3.5 w-3.5" /> Download .py
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => download(`${circuitName || "circuit"}.gds`, exportToGDS(state))}
              >
                <FileBox className="mr-2 h-3.5 w-3.5" /> Download .gds
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  download(
                    `${circuitName || "circuit"}.json`,
                    exportToJSON(state),
                    "application/json",
                  )
                }
              >
                <FileJson className="mr-2 h-3.5 w-3.5" /> Download .json
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(exportToPython(state));
                  toast.success("Python copied to clipboard");
                }}
              >
                <Copy className="mr-2 h-3.5 w-3.5" /> Copy Python
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
}
