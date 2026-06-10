import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "@/components/quantum-editor/EditorShell";

export const Route = createFileRoute("/_app/quantum-editor")({
  head: () => ({
    meta: [
      { title: "Quantum Editor — Silicofeller" },
      { name: "description", content: "Qiskit Metal-grade quantum chip CAD inside Silicofeller Quantum Studio." },
    ],
  }),
  component: QuantumEditorPage,
});

function QuantumEditorPage() {
  return (
    <div className="h-[calc(100vh-3rem)]">
      <EditorShell />
    </div>
  );
}
