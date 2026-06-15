# Device test matrix

Use before store release. Mark pass/fail in PR or release notes.

## Priority devices

| Tier | Device | OS | AR (Viro) | Photo warp | ML |
|------|--------|-----|-----------|------------|-----|
| Mid | Pixel 6a / 7a | Android 14+ | Required | Required | TFLite |
| Mid | Samsung A54 | Android 14+ | Required | Required | TFLite |
| Low | Moto G Power | Android 13+ | Smoke | Required | tfjs fallback |
| High | iPhone 14/15 | iOS 17+ | Required | Required | TFLite + CoreML |
| High | iPad Air | iPadOS 17+ | Smoke | Required | TFLite |

## Test scenarios

### Photo tab
- [ ] Pick gallery image → auto-detect wall
- [ ] Drag corners → perspective warp updates smoothly
- [ ] Compare mode ⇄ split A/B
- [ ] Object-aware mask ON
- [ ] Export PNG ⤓

### Live AR (dev build)
- [ ] Plane scan + tap auto-fill
- [ ] Pinch / drag / rotate selected patch
- [ ] Anchors 🔒 persist after walk-around
- [ ] Depth occlusion ◐ (furniture covers wallpaper)
- [ ] Lighting ☀ matches room brightness
- [ ] Snapshot ⤓ share sheet

### Live AR (Expo Go)
- [ ] Camera overlay + place patch
- [ ] Gestures on patch
- [ ] ◎ ML wall hint at ~2.5 FPS

### 3D Room + Catalog
- [ ] Orbit room preview
- [ ] Marshalls catalog sync + pick wallpaper

## Performance gates

| Metric | Target |
|--------|--------|
| AR frame rate (no ML) | ≥ 30 FPS mid-range |
| AR frame rate (depth on) | ≥ 24 FPS |
| Photo warp frame time | < 16 ms |
| Cold start | < 4 s |

## Build flavors

```bash
# Internal QA APK
npm run build:preview

# Play Store bundle
npm run build:production
```
