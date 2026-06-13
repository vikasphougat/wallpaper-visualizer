# Wallpaper Visualizer — Step-by-Step Implementation Plan

This is the **single source of truth** for what gets built and in what order. It is
written **serially**: read top to bottom. Each step has a status, the files it
touches, and how to verify it. When a step is done, its checkbox is ticked.

Status legend: ✅ done · 🟡 in progress · ⬜ planned

Related background docs:

- `docs/wallpaper-visualization-research.md` — the deep research report (the "why").
- `docs/deep-research-report.md` — the original supplied report.

---

## Phase 0 — Project foundation ✅

1. ✅ **Scaffold app** (Vite + React + TypeScript). _Files: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`._
2. ✅ **Routing + shell**: tab bar, wallpaper strip, lazy-loaded feature pages. _Files: `src/App.tsx`, `src/components/TabBar.tsx`, `src/components/WallpaperStrip.tsx`._
3. ✅ **Shared state** (Zustand, persisted): selected wallpaper + adjust values. _Files: `src/stores/selection.ts`, `src/types.ts`._
4. ✅ **Mock catalog** as tileable SVG data-URIs. _Files: `src/data/catalog.ts`._
5. ✅ **Global styling**. _Files: `src/index.css`._

**Verify:** `npm install` then `npm run dev`; all three tabs load.

---

## Phase 1 — Solution A: 2D Photo Overlay ✅

6. ✅ **Image load + EXIF orientation**. _Files: `src/lib/image.ts`._
7. ✅ **Homography (perspective warp)** in pure TS. _Files: `src/lib/homography.ts`._
8. ✅ **WebGL2 renderer** with luminance blending + tiling. _Files: `src/features/photo-overlay/overlayRenderer.ts`._
9. ✅ **Draggable corner handles** to mark the wall quad. _Files: `src/features/photo-overlay/CornerHandles.tsx`._
10. ✅ **Page wiring**: upload, controls (scale/rotation/blend/opacity), export. _Files: `src/features/photo-overlay/PhotoOverlayPage.tsx`._
11. ✅ **Optional auto wall-detect** (TensorFlow.js DeepLab), loaded lazily and degrading gracefully if not installed. _Files: `src/features/photo-overlay/segmentation.ts`._

**Verify:** upload a room photo, drag corners onto a wall, see wallpaper warp + blend; export a PNG.

---

## Phase 2 — Solution B: 3D Room Preview ✅

12. ✅ **Procedural room scene** (floor + 3 walls, lights, OrbitControls). _Files: `src/features/room-3d/roomScene.ts`._
13. ✅ **Per-wall texture / paint, pattern size + rotation, lighting presets, snapshot**. _Files: `src/features/room-3d/roomScene.ts`._
14. ✅ **Page wiring** (wall chips, controls, snapshot). _Files: `src/features/room-3d/RoomPage.tsx`._

**Verify:** orbit the room, apply wallpaper to a chosen wall, paint others, change lighting, snapshot.

---

## Phase 3 — Solution C: Live AR (WebXR, Android Chrome) ✅

15. ✅ **XR capability detection**. _Files: `src/hooks/useXRSupport.ts`._
16. ✅ **WebXR session** (`immersive-ar`) with hit-test + DOM overlay + light estimation. _Files: `src/features/ar-live/arSession.ts`._
17. ✅ **Reticle + tap-to-place** a textured quad on the detected surface.
18. ✅ **"Place here" fallback** for blank/untextured walls (places in front of the camera).
19. ✅ **Hit-test on planes + feature points** so textured walls register quickly.
20. ✅ **Stability hardening**: depth-occlusion made opt-in (off by default; it crashes some Android depth stacks); render loop wrapped in try/catch.
21. ✅ **Auto HTTPS for dev** via optional `@vitejs/plugin-basic-ssl`. _Files: `vite.config.ts`, `README.md`._

**Verify:** on Android Chrome over HTTPS, start AR, place wallpaper on a wall.

---

## Phase 4 — AR refinement & multi-wall (current) ✅

> Goal: make AR feel like a real tool — adjust placed wallpaper, use a different
> wallpaper per wall, and manipulate patches naturally by touch.

22. ✅ **Fix "sliders keep adding wallpaper"**: cancel WebXR `beforexrselect` on overlay controls so only empty-area taps place. _Files: `ARPage.tsx`._
23. ✅ **Adjustable placed patch** — Size (resize on wall), Rotate (in-plane), Transparency (see-through). Each value lives on the patch, recomputed as `pose ∘ rotation ∘ scale`. _Files: `arSession.ts`, `ARPage.tsx`._
24. ✅ **Undo / Clear / Snapshot** controls. _Files: `arSession.ts`, `ARPage.tsx`._
25. ✅ **Per-patch wallpaper** so each wall can use a different design (each patch owns its texture). _Files: `arSession.ts`._
26. ✅ **In-AR wallpaper tray** — an arrow opens a glass slider of all wallpapers; selecting one sets the "brush" for the next placement and re-skins the selected patch. _Files: `ARPage.tsx`, `index.css`._
27. ✅ **Add wallpaper from the tray** — upload an image (object URL) and use it immediately. _Files: `ARPage.tsx`._
28. ✅ **Gesture layer + tap-to-select** — a transparent full-screen layer drives input via pointer events (capture-based). Tap a patch to select it (blue outline); sliders/tray then act on it. _Files: `arSession.ts`, `ARPage.tsx`, `index.css`._
29. ✅ **Drag-to-move** — drag a selected patch along its own wall plane (ray ∩ plane). _Files: `arSession.ts`._
30. ✅ **Pinch-to-resize + twist-to-rotate** — two-finger scale and rotation on the selected patch. _Files: `arSession.ts`._
31. ✅ **Snap-to-wall** — average the last ~12 hit-test poses (position + normal) for a steadier placement. _Files: `arSession.ts`._
32. ✅ **Cover-wall mode** — toggle to place a large tiled sheet (3.0×2.4 m) instead of a 1.2×1.6 m patch; texture repeat scales to keep tile density constant. _Files: `arSession.ts`, `ARPage.tsx`._
33. ✅ **Patch counter + per-wall wallpaper readout** in the top chip. _Files: `ARPage.tsx`._

**Verify:** start AR → open tray → pick design A → tap wall 1 → drag/pinch to fit →
open tray → pick design B (or upload) → tap wall 2. Tap any patch to reselect and
tweak. Toggle "Cover wall" before placing for a full-wall sheet.

**Gesture cheat-sheet:**

| Gesture | Action |
| --- | --- |
| Tap empty area | Place wallpaper at the reticle (snapped) |
| Tap a patch | Select it (shows outline) |
| One-finger drag on selected | Move it along the wall |
| Two-finger pinch | Resize selected |
| Two-finger twist | Rotate selected |
| Sliders | Fine-tune size / rotate / transparency of selected |

---

## Phase 5 — Catalog, edge-fit, delete & persistence (current) ✅

34. ✅ **Plane-aware "Cover wall" (edge-to-edge)**: request WebXR `plane-detection`; when placing in cover mode, snap to the nearest detected **vertical** wall and size the sheet to its polygon bounds. Falls back to a wall-sized 3.2×2.6 m sheet (scalable up to 6× via the Size slider) when planes aren't available. _Files: `arSession.ts` (`updateDetectedWalls`, `nearestWall`, `addPatch`), `ARPage.tsx`._
    - ✅ **Upright alignment fix** (`wallPose`): placement poses are now aligned to world-up, so patches render as proper rectangles instead of tilted "diamonds" (the old `setFromUnitVectors` left the roll about the normal arbitrary).
    - ✅ **Collapsible controls**: Size/Rotate/Transparency + actions live in a collapsible **Adjust** tray (mirrors the **Wallpaper** tray) so the camera view stays clear; only one tray opens at a time.
35. ✅ **Delete-selected** control (in addition to Undo last / Clear all). _Files: `arSession.ts` (`removeSelected`), `ARPage.tsx`, `index.css`._
36. ✅ **Save/restore AR layout** to `localStorage`: every change emits a serialized layout (wallpaper + pose + transform per patch); a **Restore (N)** button re-places it. Uploaded wallpapers are stored as data-URLs so they persist too. _Files: `arSession.ts` (`serialize`/`restore`/`onLayoutChange`), `ARPage.tsx`._
    > Caveat: WebXR `local` space re-origins each session, so a restored layout lands relative to where you start — nudge with drag/Clear if alignment is off. True cross-session locking needs persistent anchors (step 38).
37. ✅ **Remote wallpaper catalog (Marshalls India)**: pulled from the public Shopify `/products.json` feed; served from the CORS-enabled Shopify CDN so textures don't taint snapshots. Non-tileable product photos render as a single edge-to-edge image. _Files: `src/data/marshalls.ts`, `src/data/catalog.ts`, `src/types.ts` (`tileable`/`source`)._
    > ⚠️ Licensing: Marshalls images are their copyrighted product photos, bundled only as demo content. Obtain rights or swap in your own licensed/tileable textures before any production use.

## Phase 6 — Anchors, fill, compare, export, scale & catalog sync ✅

38. ✅ **XR anchors**: WebXR `anchors` optional feature; each placement calls `hit.createAnchor()` when available; per-frame `updateAnchoredPatches` locks patch pose to the wall (badge: `· anchored`). _Files: `arSession.ts`._
39. ✅ **Auto Fill wall on tap**: **Fill wall** mode (default ON) snaps to detected vertical plane and sizes edge-to-edge on one tap — no manual corner dragging required when plane-detection works. _Files: `arSession.ts`, `ARPage.tsx`._
40. ✅ **Compare mode**: toggle places **two half-width patches** side-by-side (wallpaper A left, B right). Pick A/B in the wallpaper tray. _Files: `arSession.ts` (`addComparePair`), `ARPage.tsx`._
41. ✅ **Before/After export**: captures a room frame before first placement; **Before/After** button composites side-by-side PNG for customers. _Files: `arExport.ts`, `arSession.ts`, `ARPage.tsx`._
42. ✅ **Physical scale**: texture repeat and default patch width use real `physicalRepeatCm` (Marshalls roll **1.04 m**). _Files: `physicalScale.ts`, `arSession.ts`._
43. ✅ **Catalog sync**: paginated fetch from `marshallsindia.com/products.json`, 12 h cache in `localStorage`; used in Catalog, Strip, and AR tray. _Files: `marshallsSync.ts`, `useMarshallsCatalog.ts`, `useWallpaperLibrary.ts`._

## Phase 7 — iOS native (scaffold) 🟡

44. 🟡 **Expo iOS scaffold** — `mobile/wallpaper-ar/` with README, `app.json`, placeholder `App.tsx`. Full ARKit placement is the next step (ViroReact or expo-three).
45. ⬜ **ARKit wall placement** — plane detection, fill wall, compare, export parity with web.
46. ⬜ **Quality pass**: occlusion via segmentation, brush-to-fix wall mask in Photo tab, visual-regression tests.

---

## How to run

```bash
npm install        # installs three, react, etc.
npm run dev        # http://localhost:5173  (and LAN IP)
npm run typecheck  # tsc -b --noEmit
```

Live AR requires **Android Chrome + ARCore over HTTPS** (see `README.md` for the
HTTPS dev options). iOS Safari does not support WebXR AR.
