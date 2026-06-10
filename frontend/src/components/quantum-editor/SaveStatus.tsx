import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useWorkspaceStore, useActiveDocument } from "@/lib/quantum/model/workspace-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export function SaveStatus() {
  const doc = useActiveDocument();
  const autoSave = useWorkspaceStore(s => s.autoSave);
  const setAutoSave = useWorkspaceStore(s => s.setAutoSave);
  const save = useWorkspaceStore(s => s.save);
  const saveAs = useWorkspaceStore(s => s.saveAs);
  const [, force] = useState(0);

  // Tick to refresh "Saved Xs ago"
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Auto-save debounce
  useEffect(() => {
    if (!autoSave || !doc?.dirty) return;
    const t = setTimeout(() => save(), 1500);
    return () => clearTimeout(t);
  }, [autoSave, doc?.dirty, doc?.components, save]);

  if (!doc) return null;
  const label = doc.dirty
    ? "Unsaved changes"
    : doc.savedAt
      ? `Saved ${timeAgo(doc.savedAt)}`
      : "Not saved";

  return (
    <div className="flex items-center gap-2">
      <span className={`flex items-center gap-1.5 text-xs ${doc.dirty ? "text-amber-600" : "text-muted-foreground"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${doc.dirty ? "bg-amber-500" : "bg-emerald-500"}`} />
        {label}
      </span>
      <Button size="sm" variant="outline" onClick={save} disabled={!doc.dirty}>Save</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="gap-1">
            More <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => {
            const name = prompt("Save as…", doc.name + " copy");
            if (name) saveAs(name);
          }}>Save As…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Auto-save</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setAutoSave(!autoSave)}>
            {autoSave && <Check className="mr-2 h-3.5 w-3.5" />}
            <span className={autoSave ? "" : "ml-5"}>{autoSave ? "Enabled" : "Disabled"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
