import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, X, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { useActiveDocument } from "@/lib/quantum/model/workspace-store";
import { generateQiskitMetal } from "@/lib/quantum/codegen/qiskit-metal";
import { buildNetlist } from "@/lib/quantum/model/netlist";
import { generateMetalCode } from "@/lib/api/backend";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Props {
  state: "open" | "minimized" | "closed";
  setState: (s: "open" | "minimized" | "closed") => void;
}

export function Console({ state, setState }: Props) {
  const doc = useActiveDocument();
  const [copied, setCopied] = useState(false);
  const [backendCode, setBackendCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Local codegen — always available instantly
  const localCode = useMemo(() => (doc ? generateQiskitMetal(doc) : ""), [doc]);
  const netlist = useMemo(() => (doc ? buildNetlist(doc) : []), [doc]);

  // The displayed code: backend result takes priority if available, else local
  const displayCode = backendCode ?? localCode;

  // ── Backend Generate Code call ─────────────────────────────────────────────
  const handleGenerateFromBackend = async () => {
    if (!doc) return;
    setIsGenerating(true);
    try {
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
      setBackendCode(result.code);

      if (result.warnings?.length > 0) {
        toast.warning(`Generated with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`);
      } else {
        toast.success("Code generated via backend");
      }
    } catch (err) {
      console.warn("Backend generate-metal-code failed, showing local codegen:", err);
      setBackendCode(null); // revert to local
      toast.info("Backend offline — showing local code generation");
    } finally {
      setIsGenerating(false);
    }
  };

  if (state === "closed") return null;

  return (
    <div className="flex h-full flex-col border-t bg-card">
      <Tabs defaultValue="log" className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-2">
          <TabsList className="h-9 bg-transparent">
            <TabsTrigger value="log" className="text-xs">Log</TabsTrigger>
            <TabsTrigger value="code" className="text-xs">Qiskit Metal Code</TabsTrigger>
            <TabsTrigger value="netlist" className="text-xs">Netlist</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            {state === "minimized" ? (
              <button onClick={() => setState("open")} className="rounded p-1 hover:bg-muted" title="Expand">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={() => setState("minimized")} className="rounded p-1 hover:bg-muted" title="Minimize">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={() => setState(state === "open" ? "minimized" : "open")} className="rounded p-1 hover:bg-muted">
              {state === "open" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setState("closed")} className="rounded p-1 hover:bg-muted" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {state === "open" && (
          <div className="flex-1 overflow-hidden">
            {/* Log tab */}
            <TabsContent value="log" className="m-0 h-full">
              <ScrollArea className="h-full">
                <pre className="px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {`[editor] Active design: ${doc?.name ?? "—"}
[editor] Components: ${doc?.components.length ?? 0}
[editor] Nets: ${doc?.nets.length ?? 0}
[editor] Layers visible: ${doc?.layers.filter(l => l.visible).map(l => l.id).join(", ") ?? "—"}
[backend] Generate Code → POST /api/generate/metal-code (VITE_BACKEND_URL=${import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000"})
[backend] Status: ${backendCode ? "last call succeeded" : "no backend call made yet — showing local codegen"}`}
                </pre>
              </ScrollArea>
            </TabsContent>

            {/* Code tab — backend call + local fallback */}
            <TabsContent value="code" className="m-0 h-full">
              <div className="relative h-full flex flex-col">
                {/* Action bar */}
                <div className="flex items-center gap-2 border-b px-3 py-1.5 shrink-0">
                  <Button
                    size="sm" variant="default"
                    className="h-7 gap-1.5 text-xs"
                    disabled={isGenerating || !doc || doc.components.length === 0}
                    onClick={handleGenerateFromBackend}
                  >
                    {isGenerating
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RefreshCw className="h-3 w-3" />}
                    {isGenerating ? "Generating…" : "Generate Code"}
                  </Button>
                  {backendCode && (
                    <span className="text-[10px] text-emerald-600 font-medium">via backend</span>
                  )}
                  {!backendCode && (
                    <span className="text-[10px] text-muted-foreground">local preview</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {backendCode && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                        onClick={() => { setBackendCode(null); toast.info("Reverted to local codegen"); }}>
                        Reset
                      </Button>
                    )}
                    <Button
                      size="sm" variant="outline"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(displayCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <pre className="px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">{displayCode}</pre>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Netlist tab */}
            <TabsContent value="netlist" className="m-0 h-full">
              <ScrollArea className="h-full">
                <div className="px-3 py-2 font-mono text-[11px]">
                  {netlist.length === 0
                    ? <div className="text-muted-foreground">No nets defined yet.</div>
                    : netlist.map(n => (
                      <div key={n.netId} className="py-0.5">
                        <span className="text-muted-foreground">{n.netId}:</span> {n.from} → {n.to}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        )}
      </Tabs>
    </div>
  );
}
