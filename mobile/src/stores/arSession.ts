import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AmbientLightSample = {
  intensity: number;
  color: string;
};

interface ArSessionState {
  useAnchors: boolean;
  smoothing: number;
  anchorsAvailable: boolean;
  lastRestoredAt: number | null;
  /** Match wallpaper brightness to real room light (ARKit / ARCore). */
  useLightingEstimation: boolean;
  /** Depth-based occlusion — furniture covers wallpaper (dev build). */
  depthOcclusion: boolean;
  ambientLight: AmbientLightSample | null;
  setUseAnchors: (on: boolean) => void;
  setSmoothing: (v: number) => void;
  setAnchorsAvailable: (v: boolean) => void;
  setUseLightingEstimation: (on: boolean) => void;
  setDepthOcclusion: (on: boolean) => void;
  setAmbientLight: (sample: AmbientLightSample | null) => void;
  markRestored: () => void;
}

export const useArSession = create<ArSessionState>()(
  persist(
    (set) => ({
      useAnchors: true,
      smoothing: 0.82,
      anchorsAvailable: false,
      lastRestoredAt: null,
      useLightingEstimation: true,
      depthOcclusion: false,
      ambientLight: null,
      setUseAnchors: (on) => set({ useAnchors: on }),
      setSmoothing: (v) => set({ smoothing: Math.min(1, Math.max(0.1, v)) }),
      setAnchorsAvailable: (v) => set({ anchorsAvailable: v }),
      setUseLightingEstimation: (on) => set({ useLightingEstimation: on }),
      setDepthOcclusion: (on) => set({ depthOcclusion: on }),
      setAmbientLight: (sample) => set({ ambientLight: sample }),
      markRestored: () => set({ lastRestoredAt: Date.now() }),
    }),
    {
      name: "wallviz-ar-session",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        useAnchors: s.useAnchors,
        smoothing: s.smoothing,
        lastRestoredAt: s.lastRestoredAt,
        useLightingEstimation: s.useLightingEstimation,
        depthOcclusion: s.depthOcclusion,
      }),
    },
  ),
);
