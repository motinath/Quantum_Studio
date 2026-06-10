import { Plus, X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/quantum/model/workspace-store";
import { templates } from "@/lib/quantum/templates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TabStrip() {
  const tabs = useWorkspaceStore(s => s.tabs);
  const activeTabId = useWorkspaceStore(s => s.activeTabId);
  const setActive = useWorkspaceStore(s => s.setActive);
  const closeTab = useWorkspaceStore(s => s.closeTab);
  const openTab = useWorkspaceStore(s => s.openTab);

  return (
    <div className="flex flex-1 items-center overflow-x-auto">
      <div className="flex items-center gap-0.5">
        {tabs.map(t => {
          const active = t.id === activeTabId;
          return (
            <div
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`group flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs transition-colors ${
                active
                  ? "border-border bg-card text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <span className="font-mono">{t.name}</span>
              {t.dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                className="rounded p-0.5 opacity-50 hover:bg-muted hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>New from template</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {templates.map(t => (
              <DropdownMenuItem
                key={t.id}
                onSelect={() => openTab(t.build())}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="font-medium">{t.label}</span>
                <span className="text-[11px] text-muted-foreground">{t.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
