import { listByCategory } from "@/lib/quantum/registry/registry";
import { useWorkspaceStore } from "@/lib/quantum/model/workspace-store";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ComponentPalette() {
  const groups = listByCategory();
  const add = useWorkspaceStore(s => s.addComponent);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-3">
        {Object.entries(groups).map(([cat, defs]) => (
          <div key={cat}>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {cat}
            </div>
            <div className="space-y-1">
              {defs.map(def => (
                <button
                  key={def.kind}
                  onClick={() => add(def.kind)}
                  className="block w-full rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:border-border hover:bg-muted/60"
                  title={def.description}
                >
                  <div className="font-medium text-foreground">{def.label}</div>
                  <div className="line-clamp-1 text-[11px] text-muted-foreground">
                    {def.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
