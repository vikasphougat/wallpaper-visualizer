# Mobile AR Wallpaper — Implementation Plan

> Track progress: check boxes as phases complete.  
> Last updated: 2026-06-15

## Current baseline

| Area | Status |
|------|--------|
| Expo SDK 54 + React 19 | Done |
| Photo: Skia overlay, corners, DeepLab | Done |
| Live AR: Viro planes (dev build) | Done |
| Live AR: Expo Go camera fallback | Done |
| 3D Room: r3f v9 | Done |
| Catalog + Marshalls sync | Done |
| Tab icons | Done |
| Persistence (SQLite) | Done |
| TFLite on-device ML | Done (dev build) / tfjs fallback (Expo Go) |

---

## Phase 0 — Foundation (Week 1–2)

- [x] Save this plan
- [x] Tab bar icons (`@expo/vector-icons`)
- [x] `stores/placements.ts` — AR placement state + undo
- [x] `expo-sqlite` schema for placements & sessions
- [x] Dev-build gate UX for AR tab
- [x] Shared types: `WallPlacement`, `WallMask`, `RoomSession`

## Phase 1 — Photo production (Week 2–4)

- [x] Skia object-aware mask shader (port web `uMask`)
- [x] Lighting blend (approx via opacity × blend)
- [x] Homography grid warp (perspective-correct tiles)
- [x] Compare mode (A/B wallpapers)
- [x] Auto-detect on load (improve existing DeepLab path)
- [x] Manual corner adjust after auto-fill

## Phase 2 — Live AR core (Week 4–7)

- [x] Multi-wall plane detection (Viro vertical planes)
- [x] Tap wall → auto-fill to plane bounds
- [x] Pinch scale, drag reposition, in-plane rotate
- [x] Wallpaper tray + Snapchat HUD (improve existing)
- [x] Compare mode in AR (A/B patches)
- [x] Improve Expo Go fallback (undo, compare, auto-fill)

## Phase 3 — AR anchors & persistence (Week 7–10)

- [x] ARKit / ARCore anchors via Viro (`ViroARPlane` + plane selector wiring)
- [x] Anti-drift (native anchor tracking + `anchorMath.smoothPose`)
- [x] Save / restore placements (SQLite + anchor_id columns)
- [x] Undo / redo stack
- [x] Session restore on app reopen
- [ ] Cloud sync API (optional)

## Phase 4 — AI segmentation mobile (Week 10–16)

- [x] Replace tfjs with TFLite (`react-native-fast-tflite` + nitro-modules)
- [x] DeepLab ADE20K quantized model (`assets/models/deeplab_ade20k.tflite`)
- [x] Photo: single-frame inference (`segmentationProvider`)
- [x] AR: throttled live segmentation (2.5 FPS, Expo Go `◎` toggle)
- [x] Object cutouts: doors, windows, switches, etc. (ADE20K post-process)
- [x] Mask cache per frame hash

## Phase 5 — Realistic rendering (Week 16–20)

- [x] AR lighting estimation (`onAmbientLightUpdate` + PBR materials)
- [x] Depth occlusion (opt-in `occlusionMode` on Viro navigator)
- [x] Physical repeat from catalog (`physicalRepeatCm` + UV tiling)
- [x] High-res texture mipmaps (`mipFilter` / linear filtering)
- [x] AR snapshot export (Viro `takeScreenshot` + Expo Go view-shot)

## Phase 6 — Performance & ship (Week 20–24)

- [x] 30 FPS AR on mid-range Android (perf budgets + depth FPS cap)
- [x] Memory / battery profiling (`docs/PERFORMANCE.md`)
- [x] Device test matrix (`docs/DEVICE-MATRIX.md`)
- [x] EAS production builds (`eas.json` + npm scripts)

---

## Architecture

```
Camera → ARCore/ARKit (Viro) → Plane detection → Tap auto-fill
                              ↓
                    AI Segmentation (TFLite → tfjs fallback)
                              ↓
                    Object exclusion masks
                              ↓
                    AR Anchors → Wallpaper projection
                              ↓
                    SQLite persist → Restore session
```

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Expo 54, TypeScript, expo-router |
| AR | ViroReact (dev build) |
| 2D | React Native Skia |
| 3D preview | react-three-fiber v9 |
| ML v1 | tfjs DeepLab (Expo Go fallback) |
| ML v2 | TFLite DeepLab ADE20K (dev build) |
| State | Zustand |
| Storage | AsyncStorage + SQLite |
