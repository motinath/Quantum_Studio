import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EditorAction, EditorComponent, EditorState } from "./editor-types";
import { getDefForType } from "./editor-types";

export function PropertyInspector({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}) {
  const comp = state.components.find((c) => c.id === state.selectedId) ?? null;
  if (!comp) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-3 text-[11px] text-slate-400">
        Select a component on the canvas to edit its properties.
      </div>
    );
  }
  const def = getDefForType(comp.type);
  const update = (patch: Partial<EditorComponent>) =>
    dispatch({ type: "UPDATE_PROPS", id: comp.id, patch });
  const updateParam = (k: string, v: string) => update({ params: { ...comp.params, [k]: v } });

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Edit · {def.label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "DELETE", id: comp.id })}
          className="h-7 gap-1 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
      </div>

      <Field label="Name">
        <Input
          value={comp.name}
          onChange={(e) => update({ name: e.target.value })}
          className="h-7 text-[11px]"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="pos_x (mm)">
          <Input
            type="number"
            step="0.01"
            value={comp.x}
            onChange={(e) => update({ x: parseFloat(e.target.value) || 0 })}
            className="h-7 text-[11px]"
          />
        </Field>
        <Field label="pos_y (mm)">
          <Input
            type="number"
            step="0.01"
            value={comp.y}
            onChange={(e) => update({ y: parseFloat(e.target.value) || 0 })}
            className="h-7 text-[11px]"
          />
        </Field>
      </div>
      <Field label="Orientation">
        <Select
          value={String(comp.orientation)}
          onValueChange={(v) => update({ orientation: parseInt(v, 10) as 0 | 90 | 180 | 270 })}
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 90, 180, 270].map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d}°
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {Object.entries(comp.params).map(([k, v]) => (
        <Field key={k} label={k}>
          <Input
            value={String(v)}
            onChange={(e) => updateParam(k, e.target.value)}
            className="h-7 text-[11px]"
          />
        </Field>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
