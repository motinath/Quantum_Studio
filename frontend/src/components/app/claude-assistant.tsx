/**
 * Claude AI Assistant — floating chat panel available on every page.
 * Context-aware: detects current page and passes relevant data.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, X, Send, Loader2, ChevronDown, RotateCcw, Copy, Check,
} from "lucide-react";
import { askClaude } from "@/lib/api/backend";
import { useDesign } from "@/lib/design-context";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; loading?: boolean };

const CONTEXT_HINTS: Record<string, string> = {
  "/designer":            "designer",
  "/quantum-editor":      "canvas",
  "/schematic-editor":    "canvas",
  "/layout-viewer":       "layout",
  "/architecture-explorer": "designer",
  "/verification":        "verification",
  "/physics-analysis":    "physics",
  "/simulations":         "physics",
};

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/designer":         ["Suggest a heavy-hex topology for 27 qubits", "What substrate gives best T₁?", "Explain transmon vs fluxonium"],
  "/verification":     ["Why did my frequency check fail?", "What causes ZZ crosstalk?", "How do I fix a DRC violation?"],
  "/schematic-editor": ["Generate a 5-qubit ring in QCLang", "What does connect(Q0,Q1) mean?", "Show me a fluxonium example"],
  "/quantum-editor":   ["How do I connect two qubits in the canvas?", "What is a CPW waveguide?", "Explain TransmonPocket parameters"],
  "/physics-analysis": ["What is anharmonicity?", "Explain T1 and T2 times", "How does substrate affect coherence?"],
  "/simulations":      ["What does eigenmode simulation compute?", "Explain Q factor", "What is driven modal simulation?"],
  default:             ["What is SILICOFELLER Quantum Studio?", "How do I start a new chip design?", "Explain the design workflow"],
};

export function ClaudeAssistant() {
  const [open, setOpen]     = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { activeConversation } = useDesign();
  const pathname = useRouterState({ select: r => r.location.pathname });

  const contextType = CONTEXT_HINTS[pathname] ?? "general";
  const suggestions = PAGE_SUGGESTIONS[pathname] ?? PAGE_SUGGESTIONS.default;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: Msg = { role: "user", content: msg };
    const loadingMsg: Msg = { role: "assistant", content: "", loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const contextData = activeConversation?.result ?? undefined;
      const res = await askClaude(msg, contextType, contextData, history);

      setMessages(prev => {
        const without = prev.filter(m => !m.loading);
        return [...without, { role: "assistant" as const, content: res.content }];
      });
    } catch {
      setMessages(prev => {
        const without = prev.filter(m => !m.loading);
        return [...without, { role: "assistant" as const, content: "⚠️ Backend offline. Start the server with `.venv\\Scripts\\python run.py`" }];
      });
    } finally {
      setLoading(false);
    }
  };

  const clear = () => setMessages([]);

  const copyLast = () => {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (last) {
      navigator.clipboard.writeText(last.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl shadow-xl transition-all cursor-pointer",
          open
            ? "bg-slate-800 text-white"
            : "bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-violet-400/30"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-22 right-6 z-50 w-[380px] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            style={{ maxHeight: "min(560px, calc(100vh - 120px))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-violet-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-black text-white leading-tight">Claude Assistant</p>
                  <p className="text-[9px] text-white/70 capitalize">{contextType} context</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={copyLast} className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 cursor-pointer">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
                <button onClick={clear} className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 cursor-pointer">
                  <RotateCcw className="h-3 w-3" />
                </button>
                <button onClick={() => setOpen(false)} className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 cursor-pointer">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggestions</p>
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs text-slate-700 bg-slate-50 hover:bg-accent-soft hover:text-accent border border-slate-200 hover:border-accent/30 rounded-xl px-3 py-2 transition-all cursor-pointer font-medium"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                    m.role === "user"
                      ? "ml-auto bg-accent text-white font-semibold"
                      : "bg-slate-100 text-slate-800 mr-auto"
                  )}
                >
                  {m.loading ? (
                    <span className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 p-3 shrink-0">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask about your design…"
                  className="flex-1 min-h-[36px] max-h-[80px] rounded-xl text-xs resize-none border-slate-200 focus-visible:ring-accent"
                  disabled={loading}
                />
                <Button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  size="sm"
                  className="rounded-xl bg-accent text-white h-9 w-9 p-0 shrink-0"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
