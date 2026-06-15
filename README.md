# Wallpaper Visualizer

Preview wallcoverings (wallpaper, paint, murals) on your own walls in three escalating modes,
all in one React app with a tabbed UI:

- **🖼 Photo** — *(working)* overlay a wallpaper texture onto a photo of your wall, warped to the
  wall's perspective and matched to its real lighting.
- **🧊 3D Room** — *(Phase 2 placeholder)* orbit a 3D room with the wallpaper applied.
- **📷 Live AR** — *(Phase 3 placeholder)* real-time camera overlay via WebXR / native AR.

This repo is the **MVP**: the app shell + a fully working **Solution A (2D photo overlay)**.
Solutions B and C are intentionally scaffolded as informative placeholders (the AR tab already
feature-detects WebXR).

## React Native app (iOS / Android)

A full **Expo** mobile app lives in [`mobile/`](mobile/). It mirrors the four tabs (Photo, 3D Room, Live AR, Browse) with native UI:

```bash
cd mobile
npm install
npx expo start
```

See [`mobile/README.md`](mobile/README.md) for the stack (Skia, react-three-fiber, expo-camera) and dev-build notes for camera / 3D / production AR.

The web app (`npm run dev`) remains available for desktop and WebXR on Android Chrome.

## Quick start (web)

```bash
npm install
npm run dev
```

> Phase 2 added `three` + `@types/three`. If you installed before that, run `npm install` again.

## Testing on your phone (same Wi-Fi) — and why AR needs HTTPS

`npm run dev` already binds to your LAN (`host: true`), so Vite prints a `Network:` URL like
`http://192.168.x.x:5173` you can open on your phone. The **Photo** and **3D Room** tabs work fine
over plain HTTP.

**The Live AR tab and the camera will NOT work over `http://<LAN-IP>`** because browsers only expose
WebXR (`immersive-ar`) and the camera in a **secure context** (HTTPS or `localhost`). A bare LAN IP
over HTTP is treated as insecure, so AR reports "not available" even on a capable Android phone.

To get a secure context on your phone, pick one:

1. **Built-in HTTPS dev server (recommended).** Install the optional plugin once:
   ```bash
   npm i -D @vitejs/plugin-basic-ssl
   npm run dev
   ```
   `vite.config.ts` auto-detects the plugin and serves over **https://** (self-signed). Open the
   printed `https://<LAN-IP>:5173` Network URL on the phone and accept the certificate warning.
   If the plugin isn't installed, the server stays on plain HTTP automatically.
2. **Tunnel:** `npx cloudflared tunnel --url http://localhost:5173`, then open the `https://…` URL.
3. **Deploy** to Vercel/Netlify (HTTPS by default) and open that URL on the phone.

Live AR also requires **Android Chrome with Google Play Services for AR (ARCore)**. iOS Safari has
no WebXR AR — that path needs the native React Native + ViroReact build (see `docs/`).

Open the printed local URL. Use the **Photo** tab, add a photo of a wall, drag the four corner
handles onto the wall, then tweak pattern size / rotation / lighting blend / opacity and
**Download PNG**.

> Optional: the **"Auto-detect wall (beta)"** button uses TensorFlow.js DeepLab (ADE20K). These
> packages are **not** installed by default because `@tensorflow-models/deeplab` declares an old
> TensorFlow.js 3.x peer dependency that conflicts with current TF.js 4.x. To enable auto-detect:
>
> ```bash
> npm i @tensorflow/tfjs @tensorflow-models/deeplab --legacy-peer-deps
> ```
>
> Everything else (manual corner placement, warp, lighting, export) works without these packages.

## How Solution A works

1. **Input** — a photo is loaded into an `ImageBitmap` with EXIF orientation applied
   (`src/lib/image.ts`), and its mean luminance is sampled to normalise the lighting blend.
2. **Placement** — the user positions four wall corners (or auto-detects them). Corners are stored
   in normalised image space (`src/features/photo-overlay/CornerHandles.tsx`).
3. **Warp** — a homography maps the unit square to the wall quad (`src/lib/homography.ts`). A
   finely-subdivided grid is rendered through it so tiling stays **perspective-correct**.
4. **Lighting** — a WebGL2 fragment shader multiplies the wallpaper by the wall's luminance
   (normalised around the mean), so real shadows/gradients show through
   (`src/features/photo-overlay/overlayRenderer.ts`).
5. **Export** — the composite canvas is exported to PNG.

## Project structure

```
src/
  app/                     # (App.tsx, routing in App)
  components/              # TabBar, WallpaperStrip
  data/catalog.ts          # tileable SVG wallpaper patterns
  stores/selection.ts      # shared cross-tab state (Zustand, persisted)
  hooks/useXRSupport.ts     # WebXR immersive-ar feature detection
  lib/                     # homography solver, image utils
  features/
    catalog/               # browse + select
    photo-overlay/         # Solution A (WebGL renderer, handles, segmentation)
    room-3d/               # Solution B placeholder
    ar-live/               # Solution C placeholder
```

## Tech

- React 19 + TypeScript + Vite
- React Router (tab routes, lazy-loaded features)
- Zustand (shared, persisted selection state)
- WebGL2 for the perspective-correct, lighting-aware overlay
- *(optional)* TensorFlow.js DeepLab for wall auto-detection

## Live AR (Phase 3 — implemented for Android/WebXR)

On a supported device (Android Chrome + ARCore, served over HTTPS) the **Live AR** tab starts an
`immersive-ar` session (`src/features/ar-live/arSession.ts`, raw Three.js):

1. Aim at a **textured** spot on the wall (a picture frame, switch, skirting, poster edge) and move
   the phone slowly. Hit-test uses both planes and feature points, so textured areas register fast.
2. When the reticle appears, **tap an empty area** to place a wallpaper patch on the surface.
   Placement uses **snap-to-wall** — the last ~12 hit-test poses are averaged so the patch sits
   steady instead of jittering.
3. Blank, untextured walls give AR nothing to track — use the **"Place here"** button, which drops the
   wallpaper ~1.6 m ahead of the camera facing you (works with no detected surface).
4. **Different wallpaper per wall:** open the **Wallpaper** tray (the ▴ arrow), pick a design, then tap
   the wall. Pick another design and tap a second wall. The **＋ Add** tile lets you upload your own
   image and use it immediately. Selecting a design also re-skins the currently selected patch.
5. **Manipulate by touch** (more natural than sliders):
   - **Tap a patch** to select it (it shows a blue outline).
   - **Drag** a selected patch to slide it along the wall.
   - **Pinch** to resize, **twist** with two fingers to rotate.
6. **Fine-tune with sliders** — **Size**, **Rotate** (in-plane), **Transparency** (see the wall through
   the wallpaper). Sliders act on the **selected** patch. **Delete** removes the selected patch,
   **Undo** removes the last, **Clear** removes all, **Snapshot** saves a PNG.
7. **Cover wall** fits the wallpaper **edge-to-edge**: with WebXR `plane-detection` it snaps to the
   detected wall and sizes the sheet to it; otherwise it places a large ≈3×2.4 m sheet.
8. **Save / Restore** — your layout is written to `localStorage` on every change. A **Restore (N)**
   button re-places it next session (poses are relative to where you start, so nudge if needed).

   > Input is driven by a transparent gesture layer + DOM pointer events (not WebXR `select`), and the
   > overlay cancels `beforexrselect`, so touching sliders/buttons/tray never drops a new patch — only
   > taps on empty areas place wallpaper.

> Tip: good, even lighting and some visual texture on the wall dramatically improve tracking. Bare
> white walls in dim light are the hardest case — that's a limitation of phone AR, not the app, which
> is why the "Place here" fallback exists.

Light estimation (`XREstimatedLight`) matches the wallpaper to room lighting when available. On
unsupported devices (desktop, iOS Safari) the tab explains the requirement and points to the Photo/3D
tabs. Full iOS parity needs the native React Native + ViroReact build (see `docs/`).

**Depth occlusion (opt-in, default OFF).** The session can request WebXR `depth-sensing`
(`gpu-optimized`, `luminance-alpha`) so three.js occludes the wallpaper behind real geometry. This is
**disabled by default** because three.js's automatic occlusion path throws on some Android depth
implementations (`getDepthInformation` "gpu-optimized" vs CPU read mismatch), which crashes the render
loop and breaks placement. Enable it per-device via `ARSession.start({ enableOcclusion: true })` only
when you've confirmed the target handles it. The render loop is also wrapped so a transient per-frame
tracking error can't permanently stop AR.

## Roadmap

- **Phase 1 — 2D Photo Overlay:** done.
- **Phase 2 — 3D Room:** done (procedural Three.js room, per-wall texture, lighting presets, paint).
- **Phase 3 — Live AR:** done for Android/WebXR (hit-test on planes+points, "Place here" fallback,
  light estimation). Depth occlusion is opt-in (off by default; crashes some devices).
- **Phase 4 — AR refinement & multi-wall:** done — per-wall wallpapers, in-AR tray with upload,
  tap-to-select, drag-to-move, pinch/twist, snap-to-wall, cover-wall mode, transparency.
- **Phase 5 — Catalog, edge-fit, delete & persistence:** done — plane-detection edge-to-edge "Cover
  wall", delete-selected, save/restore layout, and a remote **Marshalls India** preview catalog
  (Shopify CDN, CORS-safe). _Marshalls images are copyrighted demo content — license your own before
  production._
- **Phase 6 — Anchors, fill, compare, export, scale & catalog sync:** done — XR anchors, auto Fill
  wall on tap, Compare mode (A/B split), Before/After export, physical scale (1.04 m roll), dynamic
  Marshalls Shopify catalog sync.
- **Phase 7 — iOS / Android native:** Expo app in `mobile/` (Photo Skia overlay, r3f room, camera AR shell, catalog sync). Full ARKit/ARCore plane detection via dev build + ViroReact next.

> **See [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) for the full, serial step-by-step
> plan** (every step, in order, with status and the files it touches).

See the full research report (`wallpaper-visualization-research.md`) for the deep dive, library
comparisons, and effort estimates.

## Privacy

Photos are processed entirely **on-device** (WebGL + optional in-browser TF.js). Nothing is
uploaded.
