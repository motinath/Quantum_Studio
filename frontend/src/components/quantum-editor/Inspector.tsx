import { useWorkspaceStore, useActiveDocument } from "@/lib/quantum/model/workspace-store";
import { getComponent } from "@/lib/quantum/registry/registry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export function Inspector() {
  const doc = useActiveDocument();
  const selectedId = useWorkspaceStore(s => s.selectedComponentId);
  const updateParams = useWorkspaceStore(s => s.updateComponentParams);
  const updateComponent = useWorkspaceStore(s => s.updateComponent);
  const removeComponent = useWorkspaceStore(s => s.removeComponent);

  if (!doc) return null;
  const inst = doc.components.find(c => c.id === selectedId);
  if (!inst) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Select a component on the canvas to edit its parameters.
      </div>
    );
  }
  const def = getComponent(inst.kind);
  if (!def) return null;

  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{def.label}</div>
        <Input
          className="mt-1 h-8 font-mono"
          value={inst.name}
          onChange={(e) => updateComponent(inst.id, { name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">x (mm)</Label>
          <Input
            type="number" step={0.05}
            className="h-8"
            value={inst.placement.x}
            onChange={(e) => updateComponent(inst.id, { placement: { ...inst.placement, x: Number(e.target.value) } })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">y (mm)</Label>
          <Input
            type="number" step={0.05}
            className="h-8"
            value={inst.placement.y}
            onChange={(e) => updateComponent(inst.id, { placement: { ...inst.placement, y: Number(e.target.value) } })}
          />
        </div>
        <div className="col-span-2">
          <Label className="text-[11px] text-muted-foreground">rotation (deg)</Label>
          <Input
            type="number" step={15}
            className="h-8"
            value={inst.placement.rotation}
            onChange={(e) => updateComponent(inst.id, { placement: { ...inst.placement, rotation: Number(e.target.value) } })}
          />
        </div>
      </div>

      {def.fields.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Parameters
          </div>
          <div className="space-y-2">
            {def.fields.map(f => (
              <div key={f.key}>
                <Label className="text-[11px] text-muted-foreground">
                  {f.label}{"unit" in f && f.unit ? ` (${f.unit})` : ""}
                </Label>
                {f.type === "number" && (() => {
                  const val = Number((inst.params[f.key] as number) ?? 0);
                  const hasRange = typeof f.min === "number" && typeof f.max === "number";
                  return (
                    <div className="space-y-1.5">
                      <Input
                        type="number"
                        step={f.step ?? 0.01}
                        min={f.min}
                        max={f.max}
                        className="h-8"
                        value={val}
                        onChange={(e) => updateParams(inst.id, { [f.key]: Number(e.target.value) })}
                      />
                      {hasRange && (
                        <Slider
                          min={f.min!}
                          max={f.max!}
                          step={f.step ?? 0.01}
                          value={[Math.max(f.min!, Math.min(f.max!, val))]}
                          onValueChange={(v) => updateParams(inst.id, { [f.key]: v[0] })}
                        />
                      )}
                    </div>
                  );
                })()}
                {f.type === "select" && (
                  <Select
                    value={(inst.params[f.key] as string) ?? f.options[0].value}
                    onValueChange={(v) => updateParams(inst.id, { [f.key]: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {f.type === "boolean" && (
                  <input
                    type="checkbox"
                    className="ml-1"
                    checked={Boolean(inst.params[f.key])}
                    onChange={(e) => updateParams(inst.id, { [f.key]: e.target.checked })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full text-destructive hover:text-destructive"
        onClick={() => removeComponent(inst.id)}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        Delete component
      </Button>
    </div>
  );
}
