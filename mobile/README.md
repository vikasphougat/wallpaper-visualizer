# Wallpaper Visualizer — Mobile (React Native)

Native iOS/Android app: **Expo SDK 52**, **expo-router**, Skia photo overlay, r3f 3D room, ViroReact AR (dev build), DeepLab wall detection.

## Quick start

```bash
cd mobile
npm install
npm start
```

`npm start` runs **`expo start --offline`** (plus `EXPO_OFFLINE=1` in `.env`) to avoid `TypeError: fetch failed` when Expo cannot reach `api.expo.dev`.

### If `fetch failed` still appears

```bash
npm run start:clear          # clear Metro cache + offline
npm run start:localhost      # bind to localhost only (DevTools issues)
npm run start:lan            # LAN URL for phone on same Wi‑Fi
```

Other fixes that often work on Windows:

1. Temporarily disable VPN / proxy, or set `HTTP_PROXY` / `HTTPS_PROXY` correctly.
2. Exclude `node_modules` from antivirus real-time scan (NPAV, etc. can corrupt fetches).
3. Use `npx expo start --offline` explicitly (do not combine `--offline` with `--localhost` — Expo rejects that).

## Expo Go vs dev build

| Feature | Expo Go | Dev build (`expo run:android`) |
|---------|---------|--------------------------------|
| Photo + Skia | ✓ | ✓ |
| DeepLab auto-detect | ✓ (slow, CPU) | ✓ |
| 3D Room | ✓ | ✓ |
| AR camera overlay | ✓ | ✓ |
| **ARKit / ARCore planes (ViroReact)** | ✗ | ✓ |

### Full AR (ViroReact)

```bash
npm run prebuild:clean
npx expo run:android
# then in another terminal:
npx expo start --dev-client --offline
```

ViroReact does **not** run in Expo Go — the AR tab automatically falls back to a camera overlay there.

## Tabs

- **Photo** — camera/gallery, corner warp, DeepLab wall auto-detect, export PNG
- **3D Room** — orbit room, wallpaper on selected walls
- **Live AR** — Viro plane detection (dev build) or camera overlay (Expo Go)
- **Browse** — catalog + Marshalls sync

## Assets

Icons are generated on `npm install` via `scripts/generate-assets.mjs`. Regenerate anytime:

```bash
npm run assets
```

## ML note

First auto-detect downloads the DeepLab ADE20K model (~few MB). Runs on **CPU** — expect 10–30s on a phone. Toggle **Object-aware cutouts** in the Adjust panel.
