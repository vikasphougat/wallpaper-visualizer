import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WallPlacement } from "@/types/placement";

const MAX_UNDO = 20;

interface PlacementsState {
  placements: WallPlacement[];
  undoStack: WallPlacement[][];
  redoStack: WallPlacement[][];
  gestureActive: boolean;
  add: (p: WallPlacement) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<WallPlacement>) => void;
  beginGesture: () => void;
  endGesture: () => void;
  clear: () => void;
  hydrate: (list: WallPlacement[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function snapshot(list: WallPlacement[]) {
  return list.map((p) => ({ ...p }));
}

export const usePlacements = create<PlacementsState>()(
  persist(
    (set, get) => ({
      placements: [],
      undoStack: [],
      redoStack: [],
      gestureActive: false,

      beginGesture: () =>
        set((s) => {
          if (s.gestureActive) return s;
          const prev = snapshot(s.placements);
          return {
            gestureActive: true,
            undoStack: [...s.undoStack, prev].slice(-MAX_UNDO),
            redoStack: [],
          };
        }),

      endGesture: () => set({ gestureActive: false }),

      add: (p) =>
        set((s) => {
          const prev = snapshot(s.placements);
          const undoStack = [...s.undoStack, prev].slice(-MAX_UNDO);
          return { placements: [...s.placements, p], undoStack, redoStack: [] };
        }),

      remove: (id) =>
        set((s) => {
          const prev = snapshot(s.placements);
          const undoStack = [...s.undoStack, prev].slice(-MAX_UNDO);
          return {
            placements: s.placements.filter((p) => p.id !== id),
            undoStack,
            redoStack: [],
          };
        }),

      update: (id, patch) =>
        set((s) => ({
          placements: s.placements.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      clear: () =>
        set((s) => {
          const prev = snapshot(s.placements);
          const undoStack = [...s.undoStack, prev].slice(-MAX_UNDO);
          return { placements: [], undoStack, redoStack: [] };
        }),

      hydrate: (list) => set({ placements: snapshot(list), undoStack: [], redoStack: [] }),

      undo: () =>
        set((s) => {
          if (s.undoStack.length === 0) return s;
          const prev = s.undoStack[s.undoStack.length - 1];
          const undoStack = s.undoStack.slice(0, -1);
          const redoStack = [...s.redoStack, snapshot(s.placements)];
          return { placements: prev, undoStack, redoStack };
        }),

      redo: () =>
        set((s) => {
          if (s.redoStack.length === 0) return s;
          const next = s.redoStack[s.redoStack.length - 1];
          const redoStack = s.redoStack.slice(0, -1);
          const undoStack = [...s.undoStack, snapshot(s.placements)];
          return { placements: next, undoStack, redoStack };
        }),

      canUndo: () => get().undoStack.length > 0,
      canRedo: () => get().redoStack.length > 0,
    }),
    {
      name: "wallviz-placements",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ placements: s.placements }),
    },
  ),
);
