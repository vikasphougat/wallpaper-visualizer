# Performance tuning

Targets: **30 FPS AR** on mid-range Android, smooth Photo warp, low battery drain when ML is off.

## Central config

All budgets live in `src/lib/perfConfig.ts`:

| Constant | Default | Purpose |
|----------|---------|---------|
| `photoGridDivisions` | 32 | Homography mesh density (web=48) |
| `arMlTargetFps` | 2.5 | Expo Go live segmentation |
| `arMlMinIntervalMs` | 350 | Hard floor between ML frames |
| `arMlSnapshotQuality` | 0.15 | Camera JPEG quality for ML |
| `placementSaveDebounceMs` | 400 | SQLite write batching |
| `viroDepthTargetFps` | 15 | Depth estimator when occlusion on |

`estimatePerfTier()` adjusts grid + ML FPS from device pixel ratio.

## AR (dev build)

1. Keep **depth occlusion off** unless needed — costs GPU + depth inference.
2. Disable **◎ smart cutout** when not comparing walls.
3. Use **☀ lighting** only in dim rooms (small CPU tint pass).
4. Prefer **TFLite** over tfjs after `npm run prebuild` (native delegate).
5. Limit placements — each adds a textured quad + material.

## Photo

- Homography grid is O(n²) vertices; tier lowers to 24 on low-end devices.
- Run auto-detect once per photo, not on every corner drag.
- Mask cache avoids re-inferring the same frame hash.

## Memory

- Skia images unload when photo is cleared.
- ML mask cache capped at 12 entries (`maskCache.ts`).
- Viro navigator remount only on wallpaper change / session reset (not per placement).

## Profiling checklist

```bash
# Android GPU / frame time
adb shell dumpsys gfxinfo com.wallviz.app

# JS heap (dev menu → Performance monitor)
npm run start:lan
```

## Battery

- Live ML at 2–3 FPS ≈ 5–8% extra drain per 10 min (camera snapshots).
- Full Viro AR with depth ≈ 15–20% per 10 min on mid-range devices.
