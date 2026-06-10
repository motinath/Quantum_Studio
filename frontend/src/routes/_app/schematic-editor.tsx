import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "@/components/quantum-editor/EditorShell";

export const Route = createFileRoute("/_app/schematic-editor")({
  head: () => ({
    meta: [
      { title: "Schematic Editor — Silicofeller" },
      { name: "description", content: "Qiskit Metal-grade quantum chip CAD inside Silicofeller Quantum Studio." },
    ],
  }),
  component: SchematicEditorPage,
});

function SchematicEditorPage() {
  return (
    <div className="h-[calc(100vh-3rem)]">
      <EditorShell />
    </div>
  );
}
