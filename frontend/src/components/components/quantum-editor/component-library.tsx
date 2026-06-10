import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { LIBRARY } from "./editor-types";
import type { ComponentCategory, ComponentKind } from "./editor-types";
import { cn } from "@/lib/utils";

const ORDER: ComponentCategory[] = [
  "qubits",
  "resonators",
  "couplers",
  "tlines",
  "terminations",
  "lumped",
  "sample shapes",
];

export function ComponentLibrary() {
  const [open, setOpen] = useState<Record<string, boolean>>({ qubits: true, resonators: true });

  return (
    <div className="flex flex-col gap-1 text-xs">
      <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Library
      </p>
      {ORDER.map((cat) => {
        const items = LIBRARY[cat];
        const isOpen = open[cat] ?? false;
        return (
          <div key={cat} className="flex flex-col">
            <button
              onClick={() => setOpen((s) => ({ ...s, [cat]: !isOpen }))}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-100"
            >
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {cat}
            </button>
            {isOpen && (
              <div className="ml-4 flex flex-col gap-0.5 border-l border-slate-100 pl-2 py-1">
                {items.map((d) => (
                  <LibraryItem key={`${cat}-${d.type}`} label={d.label} type={d.type} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="mt-2 px-1 text-[10px] text-slate-400">Drag onto the canvas to place.</p>
    </div>
  );
}

function LibraryItem({ label, type }: { label: string; type: ComponentKind }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-quantum-component", type);
        e.dataTransfer.effectAllowed = "copy";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "cursor-grab rounded-md border border-transparent px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-700 active:cursor-grabbing",
        dragging && "opacity-50",
      )}
    >
      {label}
    </div>
  );
}
