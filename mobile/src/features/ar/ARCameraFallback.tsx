import { useCallback, useRef, useState } from "react";
import { DevBuildGate } from "./DevBuildGate";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLiveArSegmentation, quadToScreen } from "@/features/ml/useLiveArSegmentation";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useSelection } from "@/stores/selection";
import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import { WallpaperTray } from "@/components/WallpaperTray";
import { HudRail } from "@/components/HudRail";
import { ARPatchView, type ARPatch } from "./ARPatchView";
import { colors } from "@/theme";

const { width: SW, height: SH } = Dimensions.get("window");

/** Camera overlay AR — works in Expo Go and on emulators (no native Viro). */
export default function ARCameraFallback({ emulatorMode = false }: { emulatorMode?: boolean }) {
  const { wallpaper, scale, opacity, blend, set, select } = useSelection();
  const { library, trayLibrary } = useWallpaperLibrary();
  const [permission, requestPermission] = useCameraPermissions();

  const [active, setActive] = useState(false);
  const [patches, setPatches] = useState<ARPatch[]>([]);
  const [undoStack, setUndoStack] = useState<ARPatch[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [viewZoom, setViewZoom] = useState(1);
  const [coverMode, setCoverMode] = useState(true);
  const [smartCutout, setSmartCutout] = useState(false);
  const [gateDismissed, setGateDismissed] = useState(false);
  const [gestureBusy, setGestureBusy] = useState(false);
  const shotRef = useRef<View>(null);
  const cameraRef = useRef<CameraView>(null);

  const { result: segResult, busy: segBusy, backend: mlBackend } = useLiveArSegmentation({
    enabled: active && smartCutout,
    cameraRef,
    paused: gestureBusy,
  });

  const wallHint = segResult ? quadToScreen(segResult.quad, SW, SH) : null;
  const compareWall = library.find((w) => w.id === compareId) ?? library.find((w) => w.id !== wallpaper.id);
  const litOpacity = Math.min(1, opacity * (0.75 + blend * 0.25));

  const pushUndo = (prev: ARPatch[]) => setUndoStack((s) => [...s, prev].slice(-20));

  const beginGesture = () => {
    setGestureBusy(true);
    pushUndo(patches);
  };

  const endGesture = () => {
    setGestureBusy(false);
  };

  const updatePatch = useCallback((id: string, patch: Partial<ARPatch>) => {
    setPatches((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const placePatch = useCallback(() => {
    const id = `p-${Date.now()}`;
    setPatches((prev) => {
      pushUndo(prev);
      const next: ARPatch[] = [
        ...prev,
        {
          id,
          x: SW * 0.15,
          y: SH * 0.28,
          w: SW * 0.7,
          h: SH * (coverMode ? 0.42 : 0.28),
          rotationDeg: 0,
          textureUrl: wallpaper.texture,
        },
      ];
      if (compareOpen && compareWall) {
        next.push({
          id: `p-b-${Date.now()}`,
          x: SW * 0.52,
          y: SH * 0.28,
          w: SW * 0.33,
          h: SH * (coverMode ? 0.42 : 0.28),
          rotationDeg: 0,
          textureUrl: compareWall.texture,
        });
      }
      setSelectedId(id);
      return next;
    });
  }, [coverMode, wallpaper.texture, compareOpen, compareWall]);

  const undo = () => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setPatches(prev);
      setSelectedId(null);
      return stack.slice(0, -1);
    });
  };

  const clearPatches = () => {
    pushUndo(patches);
    setPatches([]);
    setSelectedId(null);
  };

  const exportShot = async () => {
    if (!shotRef.current) return;
    try {
      const uri = await captureRef(shotRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else Alert.alert("Saved", uri);
    } catch {
      Alert.alert("Export failed", "Could not capture the preview.");
    }
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Live AR (Expo Go)</Text>
        <Text style={styles.sub}>
          Expo Go uses a camera overlay preview. For real ARKit / ARCore wall planes, build a dev build:
          {"\n"}npx expo prebuild && npx expo run:android
        </Text>
        <Pressable style={styles.cta} onPress={requestPermission}>
          <Text style={styles.ctaText}>Allow camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!active) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Live AR (Expo Go)</Text>
        <Text style={styles.sub}>
          Point at a wall, tap Place, then pinch/drag/rotate patches. Roll {wallpaper.physicalRepeatCm[0]}cm.
        </Text>
        <Pressable style={styles.cta} onPress={() => setActive(true)}>
          <Text style={styles.ctaText}>Start camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.immersive} ref={shotRef} collapsable={false}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {smartCutout && wallHint && (
        <View
          pointerEvents="none"
          style={[
            styles.wallHint,
            { left: wallHint.x, top: wallHint.y, width: wallHint.w, height: wallHint.h },
          ]}
        />
      )}

      <View style={[styles.overlayLayer, { transform: [{ scale: viewZoom }] }]} pointerEvents="box-none">
        {patches.map((p) => (
          <ARPatchView
            key={p.id}
            patch={p}
            selected={p.id === selectedId}
            opacity={litOpacity}
            coverMode={coverMode}
            onSelect={() => setSelectedId(p.id)}
            onChange={(next) => updatePatch(p.id, next)}
            onGestureStart={beginGesture}
            onGestureEnd={endGesture}
          />
        ))}
      </View>

      <SafeAreaView style={styles.hudTop} pointerEvents="box-none">
        <Pressable style={styles.hudBtn} onPress={() => { setActive(false); clearPatches(); }}>
          <Text style={styles.hudBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.hudChip} numberOfLines={1}>
          {wallpaper.name} · {patches.length} placed
          {selectedId ? " · editing" : ""}
          {smartCutout && mlBackend ? ` · ${mlBackend}${segBusy ? "…" : ""}` : ""}
        </Text>
        <Pressable style={styles.hudBtn} onPress={exportShot}>
          <Text style={styles.hudBtnText}>⤓</Text>
        </Pressable>
      </SafeAreaView>

      <HudRail
        zoom={viewZoom}
        onZoomIn={() => setViewZoom((z) => Math.min(2.4, z + 0.12))}
        onZoomOut={() => setViewZoom((z) => Math.max(0.6, z - 0.12))}
        extra={[
          { key: "place", label: "＋", onPress: placePatch },
          { key: "undo", label: "↶", onPress: undo, disabled: undoStack.length === 0 },
          { key: "cmp", label: "⇄", onPress: () => setCompareOpen((c) => !c), active: compareOpen },
          { key: "cover", label: coverMode ? "▣" : "▢", onPress: () => setCoverMode((c) => !c), active: coverMode },
          { key: "ml", label: "◎", onPress: () => setSmartCutout((c) => !c), active: smartCutout },
          { key: "clear", label: "⌫", onPress: clearPatches, disabled: patches.length === 0 },
        ]}
      />

      <SafeAreaView style={styles.hudBottom} edges={["bottom"]}>
        {!gateDismissed && <DevBuildGate emulatorMode={emulatorMode} onDismiss={() => setGateDismissed(true)} />}
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
            <Adj label="Pattern" value={scale} onDec={() => set({ scale: Math.max(0.3, scale - 0.1) })} onInc={() => set({ scale: Math.min(3, scale + 0.1) })} />
            <Adj label="Blend" value={blend} onDec={() => set({ blend: Math.max(0, blend - 0.1) })} onInc={() => set({ blend: Math.min(1, blend + 0.1) })} />
            <Adj label="Opacity" value={opacity} onDec={() => set({ opacity: Math.max(0.1, opacity - 0.1) })} onInc={() => set({ opacity: Math.min(1, opacity + 0.1) })} />
          </View>
        )}
        <View style={styles.dock}>
          <Pressable style={[styles.dockSide, pickerOpen && styles.dockSideOn]} onPress={() => { setPickerOpen((o) => !o); setAdjustOpen(false); }}>
            <Text style={styles.dockIcon}>🖼</Text>
          </Pressable>
          <Pressable style={styles.shutter} onPress={placePatch}>
            <View style={styles.shutterRing} />
          </Pressable>
          <Pressable style={[styles.dockSide, adjustOpen && styles.dockSideOn]} onPress={() => { setAdjustOpen((o) => !o); setPickerOpen(false); }}>
            <Text style={styles.dockIcon}>⫶</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Roll {wallpaper.physicalRepeatCm[0]}cm · repeat {wallpaper.physicalRepeatCm[1]}cm
          {selectedId ? " · drag corner dots · pinch · drag · rotate" : ""}
        </Text>
      </SafeAreaView>
    </View>
  );
}

function Adj({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) {
  return (
    <View style={styles.adjRow}>
      <Text style={styles.adjLabel}>{label}</Text>
      <Pressable onPress={onDec} style={styles.adjBtn}><Text style={styles.adjBtnText}>−</Text></Pressable>
      <Text style={styles.adjVal}>{value.toFixed(2)}</Text>
      <Pressable onPress={onInc} style={styles.adjBtn}><Text style={styles.adjBtnText}>+</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 8 },
  sub: { fontSize: 13, color: colors.textDim, marginVertical: 12, lineHeight: 20 },
  cta: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  ctaText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  immersive: { flex: 1, backgroundColor: "#000" },
  overlayLayer: { ...StyleSheet.absoluteFillObject },
  wallHint: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(80,220,120,0.85)",
    backgroundColor: "rgba(80,220,120,0.08)",
  },
  hudTop: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 },
  hudBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  hudBtnText: { color: "#fff", fontSize: 18 },
  hudChip: { flex: 1, textAlign: "center", color: "#fff", fontSize: 13 },
  hudBottom: { position: "absolute", bottom: 0, left: 0, right: 0, gap: 10, paddingHorizontal: 10 },
  hint: { color: "rgba(255,255,255,0.65)", textAlign: "center", fontSize: 11 },
  dock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 8 },
  dockSide: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dockSideOn: { borderColor: colors.accentSoft },
  dockIcon: { fontSize: 22, color: "#fff" },
  shutter: { padding: 4 },
  shutterRing: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", borderWidth: 4, borderColor: "rgba(255,255,255,0.35)" },
  adjust: { backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 14, padding: 12, gap: 8 },
  adjRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  adjLabel: { color: "#fff", fontSize: 12, flex: 1 },
  adjBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  adjBtnText: { color: "#fff", fontSize: 18 },
  adjVal: { color: "#fff", fontSize: 12, minWidth: 40, textAlign: "center" },
});
