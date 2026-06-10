/** Workspace store — multi-tab document state with localStorage persistence. */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChipDocument, ComponentInstance, LayerState } from "./document";
import { newDocument, nextName, DEFAULT_LAYERS } from "./document";
import { getComponent } from "../registry/registry";

interface WorkspaceState {
  tabs: ChipDocument[];
  activeTabId: string | null;
  autoSave: boolean;
  /** id of the selected component on the active tab */
  selectedComponentId: string | null;

  openTab: (doc: ChipDocument) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;
  renameTab: (id: string, name: string) => void;

  addComponent: (kind: string, at?: { x: number; y: number }) => string | null;
  updateComponent: (id: string, patch: Partial<ComponentInstance>) => void;
  updateComponentParams: (id: string, params: Record<string, unknown>) => void;
  removeComponent: (id: string) => void;
  selectComponent: (id: string | null) => void;

  setLayer: (layer: LayerState["id"], patch: Partial<LayerState>) => void;
  setAutoSave: (on: boolean) => void;
  save: () => void;
  saveAs: (name: string) => void;

  undo: () => void;
  redo: () => void;
  /** Bumped on every undo/redo so subscribers can re-render toolbar buttons. */
  historyTick: number;

  /** Transient — registered by the Canvas so toolbar/shortcuts can trigger it. */
  fitToScreen?: () => void;
  setFitToScreen: (fn: (() => void) | undefined) => void;
}

interface HistoryEntry { tabId: string; snapshot: ChipDocument }
const _undoStack: HistoryEntry[] = [];
const _redoStack: HistoryEntry[] = [];
const HISTORY_CAP = 100;

const useWorkspaceStoreImpl = create<WorkspaceState>()(
  persist(
    (set, get) => {
      const pushHistory = () => {
        const id = get().activeTabId;
        if (!id) return;
        const tab = get().tabs.find(t => t.id === id);
        if (!tab) return;
        _undoStack.push({ tabId: id, snapshot: structuredClone(tab) });
        if (_undoStack.length > HISTORY_CAP) _undoStack.shift();
        _redoStack.length = 0;
      };
      const mutateActive = (mut: (d: ChipDocument) => void, markDirty = true, recordHistory = true) => {
        const id = get().activeTabId;
        if (!id) return;
        if (recordHistory) pushHistory();
        set(s => ({
          tabs: s.tabs.map(t => {
            if (t.id !== id) return t;
            const copy = structuredClone(t);
            mut(copy);
            if (markDirty) copy.dirty = true;
            return copy;
          }),
        }));
      };
      return {
        tabs: [],
        activeTabId: null,
        autoSave: true,
        selectedComponentId: null,
        historyTick: 0,
        fitToScreen: undefined,
        setFitToScreen: (fn) => set({ fitToScreen: fn }),

        undo: () => {
          const entry = _undoStack.pop();
          if (!entry) return;
          const cur = get().tabs.find(t => t.id === entry.tabId);
          if (cur) _redoStack.push({ tabId: entry.tabId, snapshot: structuredClone(cur) });
          set(s => ({
            tabs: s.tabs.map(t => t.id === entry.tabId ? structuredClone(entry.snapshot) : t),
            historyTick: s.historyTick + 1,
          }));
        },
        redo: () => {
          const entry = _redoStack.pop();
          if (!entry) return;
          const cur = get().tabs.find(t => t.id === entry.tabId);
          if (cur) _undoStack.push({ tabId: entry.tabId, snapshot: structuredClone(cur) });
          set(s => ({
            tabs: s.tabs.map(t => t.id === entry.tabId ? structuredClone(entry.snapshot) : t),
            historyTick: s.historyTick + 1,
          }));
        },

        openTab: (doc) => set(s => ({
          tabs: [...s.tabs, doc],
          activeTabId: doc.id,
          selectedComponentId: null,
        })),
        closeTab: (id) => set(s => {
          const tabs = s.tabs.filter(t => t.id !== id);
          const activeTabId = s.activeTabId === id
            ? (tabs[tabs.length - 1]?.id ?? null)
            : s.activeTabId;
          return { tabs, activeTabId, selectedComponentId: null };
        }),
        setActive: (id) => set({ activeTabId: id, selectedComponentId: null }),
        reorderTabs: (fromId, toId) => set(s => {
          const tabs = [...s.tabs];
          const fi = tabs.findIndex(t => t.id === fromId);
          const ti = tabs.findIndex(t => t.id === toId);
          if (fi < 0 || ti < 0) return s;
          const [moved] = tabs.splice(fi, 1);
          tabs.splice(ti, 0, moved);
          return { tabs };
        }),
        renameTab: (id, name) => set(s => ({
          tabs: s.tabs.map(t => t.id === id ? { ...t, name, dirty: true } : t),
        })),

        addComponent: (kind, at) => {
          const def = getComponent(kind);
          if (!def) return null;
          const id = crypto.randomUUID();
          let newId: string | null = null;
          mutateActive(doc => {
            const name = nextName(kind, doc.components);
            const inst: ComponentInstance = {
              id,
              kind,
              name,
              placement: { x: at?.x ?? 0, y: at?.y ?? 0, rotation: 0 },
              params: structuredClone(def.defaults),
            };
            doc.components.push(inst);
            newId = id;
          });
          if (newId) get().selectComponent(newId);
          return newId;
        },
        updateComponent: (id, patch) => mutateActive(doc => {
          const c = doc.components.find(c => c.id === id);
          if (c) Object.assign(c, patch);
        }),
        updateComponentParams: (id, params) => mutateActive(doc => {
          const c = doc.components.find(c => c.id === id);
          if (c) c.params = { ...c.params, ...params };
        }),
        removeComponent: (id) => {
          mutateActive(doc => {
            doc.components = doc.components.filter(c => c.id !== id);
            doc.nets = doc.nets.filter(n => n.from.component !== id && n.to.component !== id);
          });
          if (get().selectedComponentId === id) set({ selectedComponentId: null });
        },
        selectComponent: (id) => set({ selectedComponentId: id }),

        setLayer: (layer, patch) => mutateActive(doc => {
          doc.layers = (doc.layers ?? DEFAULT_LAYERS).map(l =>
            l.id === layer ? { ...l, ...patch } : l
          );
        }, false, false),
        setAutoSave: (on) => set({ autoSave: on }),
        save: () => mutateActive(doc => {
          doc.dirty = false;
          doc.savedAt = Date.now();
        }, false, false),
        saveAs: (name) => {
          const id = get().activeTabId;
          if (!id) return;
          const orig = get().tabs.find(t => t.id === id);
          if (!orig) return;
          const copy: ChipDocument = {
            ...structuredClone(orig),
            id: crypto.randomUUID(),
            name,
            dirty: false,
            savedAt: Date.now(),
            createdAt: Date.now(),
          };
          set(s => ({ tabs: [...s.tabs, copy], activeTabId: copy.id }));
        },
      };
    },
    {
      name: "silicofeller.quantum-studio.workspace",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ tabs: s.tabs, activeTabId: s.activeTabId, autoSave: s.autoSave }),
    },
  ),
);

export const useWorkspaceStore = useWorkspaceStoreImpl;

export function useActiveDocument(): ChipDocument | null {
  return useWorkspaceStore(s => s.tabs.find(t => t.id === s.activeTabId) ?? null);
}

/** Snapshot helpers (read module-level history stacks; re-render via historyTick). */
export function canUndo() { return _undoStack.length > 0; }
export function canRedo() { return _redoStack.length > 0; }

