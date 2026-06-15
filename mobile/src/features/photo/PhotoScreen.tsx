import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { Canvas, Image as SkImage, useImage, Skia, Group, Mask } from "@shopify/react-native-skia";
import { useSelection } from "@/stores/selection";
import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import { WallpaperTray } from "@/components/WallpaperTray";
import { HudRail } from "@/components/HudRail";
import { defaultQuad } from "@/lib/homography";
import { segmentWallMaskFromUri, type WallSegmentationResult } from "./wallMask";
import { maskToSkiaImage } from "./maskToSkia";
import { WallpaperWarpLayer } from "./WallpaperWarpLayer";
import { colors } from "@/theme";

const { width: SW, height: SH } = Dimensions.get("window");

export default function PhotoScreen() {
  const { wallpaper, scale, rotationDeg, opacity, blend, set, select } = useSelection();
  const { library, trayLibrary } = useWallpaperLibrary();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [quad, setQuad] = useState(defaultQuad());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [viewZoom, setViewZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [segBusy, setSegBusy] = useState(false);
  const [smartMask, setSmartMask] = useState(true);
  const [segResult, setSegResult] = useState<WallSegmentationResult | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const shotRef = useRef<View>(null);
  const viewZoomBase = useRef(1);

  const photo = useImage(photoUri ?? undefined);
  const wallTex = useImage(wallpaper.texture);
  const compareWall = library.find((w) => w.id === compareId) ?? library.find((w) => w.id !== wallpaper.id);
  const compareTex = useImage(compareOpen && compareWall ? compareWall.texture : undefined);

  const layoutW = SW;
  const layoutH = photo ? (SW * 4) / 3 : SH * 0.55;

  const maskImage = useMemo(() => {
    if (!smartMask || !segResult) return null;
    return maskToSkiaImage(segResult.mask, segResult.maskWidth, segResult.maskHeight, layoutW, Math.round(layoutH));
  }, [smartMask, segResult, layoutW, layoutH]);

  const runAutoDetect = useCallback(async (uri?: string) => {
    const target = uri ?? photoUri;
    if (!target) return;
    setSegBusy(true);
    try {
      const result = await segmentWallMaskFromUri(target);
      setQuad(result.quad);
      setSegResult(result);
    } catch (e) {
      Alert.alert(
        "Auto-detect failed",
        e instanceof Error ? e.message : "Could not find a wall. Drag corners manually.",
      );
    } finally {
      setSegBusy(false);
    }
  }, [photoUri]);

  const pickPhoto = useCallback(async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera or photos to continue.");
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.92, exif: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.92, exif: true });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      setQuad(defaultQuad());
      setSegResult(null);
      setViewZoom(1);
      if (smartMask) void runAutoDetect(uri);
    }
  }, [smartMask, runAutoDetect]);

  const exportPng = useCallback(async () => {
    if (!shotRef.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(shotRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Saved", uri);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const clearPhoto = () => {
    setPhotoUri(null);
    setQuad(defaultQuad());
    setSegResult(null);
    setPickerOpen(false);
    setAdjustOpen(false);
  };

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          viewZoomBase.current = viewZoom;
        })
        .onUpdate((e) => {
          const next = Math.min(2.4, Math.max(0.6, viewZoomBase.current * e.scale));
          runOnJS(setViewZoom)(next);
        }),
    [viewZoom],
  );

  if (!photoUri) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.title}>2D Photo Overlay</Text>
        <Text style={styles.sub}>Take or upload a wall photo, drag corners, wallpaper warps to match.</Text>
        <View style={styles.idleHero}>
          <Text style={styles.idleGlyph}>📷</Text>
          <Text style={styles.idleText}>Add a photo of your wall</Text>
        </View>
        <View style={styles.dock}>
          <Pressable style={styles.dockSide} onPress={() => setPickerOpen((o) => !o)}>
            <View style={[styles.dockThumb, { backgroundColor: colors.bgCard }]}>
              <SkiaThumb uri={wallpaper.texture} />
            </View>
          </Pressable>
          <Pressable style={styles.shutter} onPress={() => pickPhoto(true)}>
            <View style={styles.shutterRing} />
          </Pressable>
          <Pressable style={styles.dockSide} onPress={() => pickPhoto(false)}>
            <Text style={styles.dockIcon}>🖼</Text>
          </Pressable>
        </View>
        <WallpaperTray
          visible={pickerOpen}
          library={trayLibrary}
          selectedId={wallpaper.id}
          onSelect={(w) => { select(w); setPickerOpen(false); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.immersive}>
      <View style={styles.stage}>
        <GestureDetector gesture={pinchGesture}>
          <View
            ref={shotRef}
            collapsable={false}
            style={[styles.canvasBox, { width: layoutW, height: layoutH, transform: [{ scale: viewZoom }] }]}
          >
            <View pointerEvents="none" style={{ width: layoutW, height: layoutH }}>
              <Canvas style={{ width: layoutW, height: layoutH }}>
                {photo && <SkImage image={photo} x={0} y={0} width={layoutW} height={layoutH} fit="cover" />}
                {wallTex && photo && (
                  <WallpaperWarpLayer
                    quad={quad}
                    layoutW={layoutW}
                    layoutH={layoutH}
                    wallTex={wallTex}
                    scale={scale}
                    rotationDeg={rotationDeg}
                    physicalRepeatCm={wallpaper.physicalRepeatCm}
                    tileable={wallpaper.tileable ?? true}
                    opacity={opacity}
                    blend={blend}
                    maskImage={maskImage}
                    clipRight={compareOpen ? layoutW * 0.5 : undefined}
                  />
                )}
                {compareOpen && compareTex && photo && (
                  <Group clip={Skia.Path.Make().addRect(Skia.XYWHRect(layoutW * 0.5, 0, layoutW * 0.5, layoutH))}>
                    <WallpaperWarpLayer
                      quad={quad}
                      layoutW={layoutW}
                      layoutH={layoutH}
                      wallTex={compareTex}
                      scale={scale}
                      rotationDeg={rotationDeg}
                      physicalRepeatCm={compareWall?.physicalRepeatCm ?? wallpaper.physicalRepeatCm}
                      tileable={compareWall?.tileable ?? true}
                      opacity={opacity}
                      blend={blend}
                      maskImage={maskImage}
                    />
                  </Group>
                )}
              </Canvas>
            </View>
            <CornerHandles quad={quad} layoutW={layoutW} layoutH={layoutH} onChange={setQuad} />
          </View>
        </GestureDetector>
      </View>

      <SafeAreaView style={styles.hudTop} pointerEvents="box-none">
        <Pressable style={styles.hudBtn} onPress={clearPhoto}><Text style={styles.hudBtnText}>✕</Text></Pressable>
        <Text style={styles.hudChip} numberOfLines={1}>
          {wallpaper.name}{segBusy ? " · detecting…" : segResult && smartMask ? " · smart mask" : ""}{compareOpen ? " · compare" : ""}
        </Text>
        <Pressable style={styles.hudBtn} onPress={exportPng} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.hudBtnText}>⤓</Text>}
        </Pressable>
      </SafeAreaView>

      <HudRail
        zoom={viewZoom}
        onZoomIn={() => setViewZoom((z) => Math.min(2.4, z + 0.12))}
        onZoomOut={() => setViewZoom((z) => Math.max(0.6, z - 0.12))}
        extra={[
          { key: "reset", label: "↺", onPress: () => setQuad(defaultQuad()) },
          { key: "cmp", label: "⇄", onPress: () => setCompareOpen((c) => !c), active: compareOpen },
        ]}
      />

      <Text style={styles.hint}>Drag corners · pinch to zoom</Text>

      <SafeAreaView style={styles.hudBottom} edges={["bottom"]}>
        <WallpaperTray
          visible={compareOpen}
          library={trayLibrary}
          selectedId={compareId ?? compareWall?.id ?? wallpaper.id}
          onSelect={(w) => setCompareId(w.id)}
        />
        <WallpaperTray
          visible={pickerOpen}
          library={trayLibrary}
          selectedId={wallpaper.id}
          onSelect={(w) => { select(w); setPickerOpen(false); }}
        />
        {adjustOpen && (
          <View style={styles.adjust}>
            <Pressable
              style={[styles.segBtn, smartMask && styles.segBtnOn]}
              onPress={() => setSmartMask((v) => !v)}
            >
              <Text style={styles.segBtnText}>Object-aware cutouts {smartMask ? "ON" : "OFF"}</Text>
            </Pressable>
            <Pressable style={styles.segBtn} onPress={() => runAutoDetect()} disabled={segBusy}>
              {segBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.segBtnText}>Auto-detect wall (DeepLab)</Text>
              )}
            </Pressable>
            <AdjRow label="Pattern size" value={scale} min={0.3} max={3} step={0.05} onChange={(v) => set({ scale: v })} />
            <AdjRow label="Rotate" value={rotationDeg} min={0} max={360} step={1} onChange={(v) => set({ rotationDeg: v })} />
            <AdjRow label="Blend" value={blend} min={0} max={1} step={0.02} onChange={(v) => set({ blend: v })} />
            <AdjRow label="Opacity" value={opacity} min={0.1} max={1} step={0.02} onChange={(v) => set({ opacity: v })} />
          </View>
        )}
        <View style={styles.dock}>
          <Pressable style={[styles.dockSide, pickerOpen && styles.dockSideOn]} onPress={() => { setPickerOpen((o) => !o); setAdjustOpen(false); }}>
            <View style={styles.dockThumb}><SkiaThumb uri={wallpaper.texture} /></View>
          </Pressable>
          <Pressable style={styles.shutter} onPress={() => pickPhoto(true)}>
            <View style={styles.shutterRing} />
          </Pressable>
          <Pressable style={[styles.dockSide, adjustOpen && styles.dockSideOn]} onPress={() => { setAdjustOpen((o) => !o); setPickerOpen(false); }}>
            <Text style={styles.dockIcon}>⫶</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function SkiaThumb({ uri }: { uri: string }) {
  const img = useImage(uri);
  if (!img) return null;
  return (
    <Canvas style={{ width: 48, height: 48 }}>
      <SkImage image={img} x={0} y={0} width={48} height={48} fit="cover" />
    </Canvas>
  );
}

function CornerHandles({
  quad,
  layoutW,
  layoutH,
  onChange,
}: {
  quad: [number, number][];
  layoutW: number;
  layoutH: number;
  onChange: (q: [number, number][]) => void;
}) {
  const quadRef = useRef(quad);
  quadRef.current = quad;

  const moveCorner = useCallback(
    (index: number, dx: number, dy: number, startX: number, startY: number) => {
      const nx = Math.min(1, Math.max(0, startX + dx / layoutW));
      const ny = Math.min(1, Math.max(0, startY + dy / layoutH));
      const next = quadRef.current.slice() as [number, number][];
      next[index] = [nx, ny];
      onChange(next);
    },
    [layoutW, layoutH, onChange],
  );

  return (
    <>
      {quad.map(([x, y], i) => (
        <CornerHandle
          key={i}
          x={x}
          y={y}
          layoutW={layoutW}
          layoutH={layoutH}
          onDrag={(dx, dy, startX, startY) => moveCorner(i, dx, dy, startX, startY)}
        />
      ))}
    </>
  );
}

function CornerHandle({
  x,
  y,
  layoutW,
  layoutH,
  onDrag,
}: {
  x: number;
  y: number;
  layoutW: number;
  layoutH: number;
  onDrag: (dx: number, dy: number, startX: number, startY: number) => void;
}) {
  const start = useRef({ x: 0, y: 0 });

  const pan = Gesture.Pan()
    .hitSlop(16)
    .onStart(() => {
      start.current = { x, y };
    })
    .onUpdate((e) => {
      runOnJS(onDrag)(e.translationX, e.translationY, start.current.x, start.current.y);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.handle, { left: x * layoutW - 16, top: y * layoutH - 16 }]} />
    </GestureDetector>
  );
}

function AdjRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.adjRow}>
      <Text style={styles.adjLabel}>{label}</Text>
      <View style={styles.adjBtns}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))} style={styles.adjBtn}><Text style={styles.adjBtnText}>−</Text></Pressable>
        <Text style={styles.adjVal}>{value.toFixed(2)}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + step))} style={styles.adjBtn}><Text style={styles.adjBtnText}>+</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 8 },
  sub: { fontSize: 13, color: colors.textDim, marginBottom: 12 },
  idleHero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  idleGlyph: { fontSize: 48 },
  idleText: { color: colors.textDim, marginTop: 8 },
  immersive: { flex: 1, backgroundColor: "#000" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  canvasBox: { position: "relative" },
  hudTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  hudBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  hudBtnText: { color: "#fff", fontSize: 18 },
  hudChip: { flex: 1, textAlign: "center", color: "#fff", fontSize: 13 },
  hint: {
    position: "absolute",
    bottom: 130,
    alignSelf: "center",
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 12,
    overflow: "hidden",
  },
  hudBottom: { position: "absolute", bottom: 0, left: 0, right: 0, gap: 10, paddingHorizontal: 10 },
  dock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 8 },
  dockSide: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dockSideOn: { borderColor: colors.accentSoft },
  dockThumb: { width: 48, height: 48, borderRadius: 24, overflow: "hidden" },
  dockIcon: { fontSize: 22, color: "#fff" },
  shutter: { padding: 4 },
  shutterRing: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", borderWidth: 4, borderColor: "rgba(255,255,255,0.35)" },
  handle: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 20,
    elevation: 20,
  },
  adjust: {
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  adjRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adjLabel: { color: "#fff", fontSize: 12, flex: 1 },
  adjBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  adjBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  adjBtnText: { color: "#fff", fontSize: 18 },
  adjVal: { color: "#fff", fontSize: 12, minWidth: 44, textAlign: "center" },
  segBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  segBtnOn: { backgroundColor: colors.accent },
  segBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
