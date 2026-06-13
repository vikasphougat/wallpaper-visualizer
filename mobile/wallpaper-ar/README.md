# Wallpaper AR — iOS (React Native + ARKit)

WebXR AR does not run on iOS Safari. This folder is the **native iOS companion** for the
wallpaper visualizer, using ARKit via Expo / React Native.

## Status

**Scaffold / Phase 7** — project shell and architecture. Full ARKit wall placement is the
next implementation step after the web MVP (Android WebXR) is stable.

## Planned stack

| Layer | Choice |
| --- | --- |
| Framework | Expo SDK 52+ (dev build for ARKit) |
| AR | `expo-three` + `expo-gl` or ViroReact (`@reactvision/react-viro`) for ARKit |
| UI | Shared wallpaper catalog from parent `src/data/marshallsSync.ts` logic |
| State | Same layout JSON as web (`wallviz-ar-layout` in AsyncStorage) |

## Setup (when implementing)

```bash
cd mobile/wallpaper-ar
npm install
npx expo prebuild
npx expo run:ios
```

Requires Xcode, Apple Developer account, and a physical iPhone (ARKit does not run in Simulator).

## Feature parity checklist

- [ ] ARKit plane detection + hit-test placement
- [ ] Per-wall wallpaper from Marshalls catalog
- [ ] Compare mode (split wall)
- [ ] Fill wall edge-to-edge
- [ ] Before/after export to camera roll
- [ ] Physical scale (1.04 m roll width)

## Web app

The main web app lives in the repo root (`npm run dev`). Use it on **Android Chrome** for WebXR AR today.
