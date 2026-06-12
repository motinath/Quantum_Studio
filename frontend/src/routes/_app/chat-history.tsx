import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState, useMemo } from "react";
import {
    Search,
    Plus,
    MessageSquare,
    Cpu,
    Clock,
    Trash2,
    Pencil,
    Check,
    X,
    ChevronRight,
} from "lucide-react";
import { useDesign } from "@/lib/design-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/chat-history")({
    head: () => ({ meta: [{ title: "Chat History — Silicofeller" }] }),
    component: ChatHistoryPage,
});

function formatDate(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffDays = Math.floor(diffH / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

function groupByDate(items: { id: string; title: string; updatedAt: number; hasResult: boolean; qubitCount?: number }[]) {
    const groups: { label: string; items: typeof items }[] = [];
    const now = new Date();

    const today: typeof items = [];
    const yesterday: typeof items = [];
    const thisWeek: typeof items = [];
    const older: typeof items = [];

    items.forEach((item) => {
        const d = new Date(item.updatedAt);
        const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
        if (diffDays < 1) today.push(item);
        else if (diffDays < 2) yesterday.push(item);
        else if (diffDays < 7) thisWeek.push(item);
        else older.push(item);
    });

    if (today.length) groups.push({ label: "Today", items: today });
    if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
    if (thisWeek.length) groups.push({ label: "This week", items: thisWeek });
    if (older.length) groups.push({ label: "Older", items: older });

    return groups;
}

function ChatHistoryPage() {
    const navigate = useNavigate();
    const { conversations, handleNew, handleDelete, setActiveId, renameConversation } = useDesign();
    const [search, setSearch] = useState("");
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return conversations
            .map((c) => ({
                id: c.id,
                title: c.title,
                updatedAt: c.updatedAt,
                hasResult: !!c.result,
                qubitCount: c.result?.num_qubits,
            }))
            .filter((c) => !q || c.title.toLowerCase().includes(q))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [conversations, search]);

    const groups = useMemo(() => groupByDate(filtered), [filtered]);

    const openChat = (id: string) => {
        if (selecting) {
            setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
            return;
        }
        setActiveId(id);
        navigate({ to: "/designer" });
    };

    const deleteSelected = () => {
        selected.forEach((id) => handleDelete(id));
        setSelected(new Set());
        setSelecting(false);
    };

    const startNew = () => {
        handleNew();
        navigate({ to: "/designer" });
    };

    return (
        <div className="flex flex-col min-h-full bg-[#F7F8FA]">
            {/* Page header */}
            <div className="sticky top-0 z-10 bg-[#F7F8FA] border-b border-slate-200/60 px-6 md:px-10 py-5">
                <div className="mx-auto max-w-3xl">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Chats</h1>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setSelecting((v) => !v);
                                    setSelected(new Set());
                                }}
                                className={cn(
                                    "h-9 px-4 rounded-full text-sm font-bold transition-all border",
                                    selecting
                                        ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                                )}
                            >
                                {selecting ? "Cancel" : "Select chats"}
                            </button>
                            <button
                                onClick={startNew}
                                className="h-9 px-4 rounded-full text-sm font-bold bg-accent text-white border border-accent hover:bg-accent/90 transition-all flex items-center gap-2"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New chat
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search chats..."
                            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 shadow-sm"
                        />
                    </div>

                    {/* Bulk delete bar */}
                    {selecting && selected.size > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2"
                        >
                            <span className="text-sm font-bold text-rose-700">{selected.size} selected</span>
                            <button
                                onClick={deleteSelected}
                                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete selected
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 md:px-10 py-6">
                <div className="mx-auto max-w-3xl">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                                <MessageSquare className="h-7 w-7 text-slate-400" />
                            </div>
                            <p className="text-base font-bold text-slate-700">
                                {search ? "No chats match your search" : "No chats yet"}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                                {search ? "Try a different keyword" : "Start a new chat to design your first quantum chip"}
                            </p>
                            {!search && (
                                <button
                                    onClick={startNew}
                                    className="mt-5 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    New chat
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {groups.map((group) => (
                                <div key={group.label}>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400 px-1">
                                        {group.label}
                                    </p>
                                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
                                        {group.items.map((item, i) => (
                                            <motion.div
                                                key={item.id}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.18, delay: i * 0.03 }}
                                            >
                                                <div
                                                    onClick={() => openChat(item.id)}
                                                    className={cn(
                                                        "group relative flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-slate-50",
                                                        selected.has(item.id) && "bg-accent-soft hover:bg-accent-soft",
                                                    )}
                                                >
                                                    {/* Select checkbox */}
                                                    {selecting && (
                                                        <div
                                                            className={cn(
                                                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                                                selected.has(item.id)
                                                                    ? "border-accent bg-accent text-white"
                                                                    : "border-slate-300 bg-white",
                                                            )}
                                                        >
                                                            {selected.has(item.id) && <Check className="h-3 w-3" />}
                                                        </div>
                                                    )}

                                                    {/* Icon */}
                                                    <div
                                                        className={cn(
                                                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                                            item.hasResult
                                                                ? "bg-violet-50 text-violet-600"
                                                                : "bg-slate-100 text-slate-400",
                                                        )}
                                                    >
                                                        {item.hasResult ? (
                                                            <Cpu className="h-4 w-4" />
                                                        ) : (
                                                            <MessageSquare className="h-4 w-4" />
                                                        )}
                                                    </div>

                                                    {/* Title + meta */}
                                                    <div className="flex-1 min-w-0">
                                                        {renamingId === item.id ? (
                                                            <input
                                                                autoFocus
                                                                value={renameValue}
                                                                onChange={(e) => setRenameValue(e.target.value)}
                                                                onBlur={() => {
                                                                    renameConversation(item.id, renameValue);
                                                                    setRenamingId(null);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        renameConversation(item.id, renameValue);
                                                                        setRenamingId(null);
                                                                    }
                                                                    if (e.key === "Escape") setRenamingId(null);
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full text-sm font-semibold text-slate-900 bg-white border border-accent/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-accent/30"
                                                            />
                                                        ) : (
                                                            <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-accent transition-colors">
                                                                {item.title}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                                                <Clock className="h-3 w-3" />
                                                                {formatDate(item.updatedAt)}
                                                            </span>
                                                            {item.hasResult && item.qubitCount && (
                                                                <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                                                                    {item.qubitCount}Q chip
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Timestamp right + actions */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {!selecting && (
                                                            <div className="hidden group-hover:flex items-center gap-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setRenamingId(item.id);
                                                                        setRenameValue(item.title);
                                                                    }}
                                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                                                                    title="Rename"
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDelete(item.id);
                                                                    }}
                                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        {!selecting && (
                                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
