import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useWorkspace } from "@/lib/editor/workspace-store";
import { cn } from "@/lib/utils";

export function SaveStatus() {
  const { workspace } = useWorkspace();
  const { saveStatus } = workspace;
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px] transition-all",
        saveStatus === "saved"   && "text-emerald-600",
        saveStatus === "unsaved" && "text-amber-500",
        saveStatus === "saving"  && "text-muted-foreground",
      )}
    >
      {saveStatus === "saved"   && <CheckCircle2 className="h-3 w-3" />}
      {saveStatus === "unsaved" && <Circle       className="h-3 w-3 fill-amber-500/30" />}
      {saveStatus === "saving"  && <Loader2      className="h-3 w-3 animate-spin" />}
      <span>
        {saveStatus === "saved"   && "All changes saved"}
        {saveStatus === "unsaved" && "Unsaved changes"}
        {saveStatus === "saving"  && "Saving…"}
      </span>
    </div>
  );
}
