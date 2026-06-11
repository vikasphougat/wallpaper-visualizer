import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Wallpaper } from "@/types";
import { DEFAULT_WALLPAPER } from "@/data/catalog";

interface SelectionState {
  wallpaper: Wallpaper;
  /** Repeat multiplier applied on top of physical scale (1 = physically accurate). */
  scale: number;
  rotationDeg: number;
  /** Blend strength: how strongly the wall's real shading shows through (0..1). */
  blend: number;
  /** Overall wallpaper opacity (0..1). */
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
    { name: "wallviz-selection" },
  ),
);
