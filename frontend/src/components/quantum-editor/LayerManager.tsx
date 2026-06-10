import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { useWorkspaceStore, useActiveDocument } from "@/lib/quantum/model/workspace-store";
import { Slider } from "@/components/ui/slider";

export function LayerManager() {
  const doc = useActiveDocument();
  const setLayer = useWorkspaceStore(s => s.setLayer);
  if (!doc) return null;

  return (
    <div className="space-y-1 p-3">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Layers
      </div>
      {doc.layers.map(l => (
        <div key={l.id} className="rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/40">
          <div className="flex items-center gap-2">
            <button onClick={() => setLayer(l.id, { visible: !l.visible })} title={l.visible ? "Hide" : "Show"}>
              {l.visible
                ? <Eye className="h-3.5 w-3.5 text-foreground" />
                : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            <button onClick={() => setLayer(l.id, { locked: !l.locked })} title={l.locked ? "Unlock" : "Lock"}>
              {l.locked
                ? <Lock className="h-3.5 w-3.5 text-accent" />
                : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            <span className="flex-1 text-xs">{l.label}</span>
          </div>
          <Slider
            className="mt-1.5"
            value={[Math.round(l.opacity * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={([v]) => setLayer(l.id, { opacity: v / 100 })}
          />
        </div>
      ))}
    </div>
  );
}
