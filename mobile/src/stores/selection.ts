import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Wallpaper } from "@/types";
import { DEFAULT_WALLPAPER } from "@/data/catalog";

interface SelectionState {
  wallpaper: Wallpaper;
  scale: number;
  rotationDeg: number;
  blend: number;
  opacity: number;
  select: (w: Wallpaper) => void;
  set: (patch: Partial<Pick<SelectionState, "scale" | "rotationDeg" | "blend" | "opacity">>) => void;
  reset: () => void;
}

const DEFAULTS = { scale: 1, rotationDeg: 0, blend: 0.65, opacity: 1 };

export const useSelection = create<SelectionState>()(
  persist(
    (set) => ({
      wallpaper: DEFAULT_WALLPAPER,
      ...DEFAULTS,
      select: (wallpaper) => set({ wallpaper }),
      set: (patch) => set(patch),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "wallviz-selection",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
