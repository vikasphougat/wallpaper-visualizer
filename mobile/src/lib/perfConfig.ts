/**
 * Central performance budgets — tune for mid-range Android (30 FPS AR target).
 */
export const PERF = {
  /** Photo homography grid subdivisions (web uses 48; 32 balances quality vs GPU). */
  photoGridDivisions: 32,

  /** Live AR ML inference target FPS (Expo Go camera snapshot path). */
  arMlTargetFps: 2.5,
  /** Drop to this FPS when a gesture or export is active. */
  arMlLowFps: 1.5,

  /** Minimum ms between ML inferences. */
  arMlMinIntervalMs: 350,

  /** Camera snapshot quality for AR ML (0–1). */
  arMlSnapshotQuality: 0.15,

  /** Debounce SQLite placement saves. */
  placementSaveDebounceMs: 400,

  /** Viro depth estimator cap when occlusion enabled. */
  viroDepthTargetFps: 15,
} as const;

export type PerfTier = "low" | "mid" | "high";

/** Heuristic tier from screen scale / platform (no native APIs required). */
export function estimatePerfTier(screenScale: number): PerfTier {
  if (screenScale >= 3) return "high";
  if (screenScale >= 2) return "mid";
  return "low";
}

export function photoGridForTier(tier: PerfTier): number {
  if (tier === "low") return 24;
  if (tier === "high") return 40;
  return PERF.photoGridDivisions;
}

export function arMlFpsForTier(tier: PerfTier, busy = false): number {
  if (busy) return PERF.arMlLowFps;
  if (tier === "low") return 2;
  if (tier === "high") return 3.5;
  return PERF.arMlTargetFps;
}
