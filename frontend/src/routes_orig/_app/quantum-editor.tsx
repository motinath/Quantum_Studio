import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { z } from "zod";
import { motion } from "motion/react";
import { useDesign } from "@/lib/design-context";
import { EditorCanvas } from "@/components/quantum-editor/editor-canvas";
import { EditorToolbar } from "@/components/quantum-editor/editor-toolbar";
import { ComponentLibrary } from "@/components/quantum-editor/component-library";
import { PropertyInspector } from "@/components/quantum-editor/property-inspector";
import { BottomPanel } from "@/components/quantum-editor/bottom-panel";
import {
  editorReducer,
  emptyEditorState,
  fromGenerateResponse,
  toGenerateResponse,
} from "@/components/quantum-editor/editor-types";

const searchSchema = z.object({ conversationId: z.string().optional() });

export const Route = createFileRoute("/_app/quantum-editor")({
  head: () => ({ meta: [{ title: "Quantum Editor — Silicofeller" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: QuantumEditorPage,
});

function QuantumEditorPage() {
  const { conversationId } = Route.useSearch();
  const navigate = useNavigate();
  const { conversations, activeId, setActiveId, updateConversationResult } = useDesign();

  const targetId = conversationId ?? activeId;
  const conversation = useMemo(
    () => conversations.find((c) => c.id === targetId) ?? null,
    [conversations, targetId],
  );

  // Keep design context's active conversation in sync with the URL
  useEffect(() => {
    if (conversationId && conversationId !== activeId) setActiveId(conversationId);
  }, [conversationId, activeId, setActiveId]);

  const [state, dispatch] = useReducer(editorReducer, undefined, emptyEditorState);

  // Load once when conversation becomes available
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!conversation || loadedFor.current === conversation.id) return;
    const seed = fromGenerateResponse(conversation.result);
    dispatch({
      type: "LOAD",
      state: {
        components: seed.components,
        connections: seed.connections,
        variables: seed.variables,
      },
    });
    // Seed prevResultRef with the original generate result so the first sync
    // has access to placement.edges, frequency_plan, etc.
    prevResultRef.current = conversation.result;
    loadedFor.current = conversation.id;
  }, [conversation]);

  // Two-way sync: push state changes back into design context (debounced via rev)
  const prevResultRef = useRef<import("@/lib/api/backend").GenerateResponse | null>(null);

  useEffect(() => {
    if (!conversation || state.rev === 0) return;
    const t = window.setTimeout(() => {
      // Use the stored prev result (seeded by the load effect) so placement.edges
      // and other backend-generated fields are preserved across editor edits.
      const next = toGenerateResponse(state, prevResultRef.current);
      updateConversationResult(conversation.id, next);
      prevResultRef.current = next;
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rev]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (
          state.selectedId &&
          (e.target as HTMLElement)?.tagName !== "INPUT" &&
          (e.target as HTMLElement)?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          dispatch({ type: "DELETE", id: state.selectedId });
        }
      } else if (e.key === "Escape") {
        dispatch({ type: "SELECT", id: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.selectedId]);

  if (!conversation) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center bg-white">
        <div className="rounded-2xl border border-slate-200 p-6 text-center">
          <p className="text-sm font-bold text-slate-700">No design session selected.</p>
          <button
            onClick={() => navigate({ to: "/designer" })}
            className="mt-3 text-xs font-bold text-indigo-600 hover:underline"
          >
            Open Designer →
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-[calc(100vh-3rem)] w-full flex-col bg-white text-slate-800"
    >
      <EditorToolbar
        state={state}
        dispatch={dispatch}
        circuitName={conversation.title}
        conversationId={conversation.id}
      />

      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1">
          <EditorCanvas state={state} dispatch={dispatch} />
        </div>

        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex w-72 flex-col gap-3 border-l border-slate-200 bg-white p-3 overflow-y-auto"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <ComponentLibrary />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <PropertyInspector state={state} dispatch={dispatch} />
          </div>
        </motion.aside>
      </div>

      <div className="h-56 shrink-0 border-t border-slate-200 bg-white">
        <BottomPanel state={state} dispatch={dispatch} />
      </div>
    </motion.div>
  );
}
