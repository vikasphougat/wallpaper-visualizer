import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import { useSelection } from "@/stores/selection";
import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import { usePlacements } from "@/stores/placements";
import { useArSession } from "@/stores/arSession";
import { WallpaperTray } from "@/components/WallpaperTray";
import { HudRail } from "@/components/HudRail";
import { savePlacementsToDb, loadPlacementsFromDb, getSessionMeta } from "@/data/sqlite/placementsDb";
import { ViroARSceneNavigator, createARScene } from "./ARViroScene";
import type { PlanePlacementPayload } from "@/types/placement";
import { colors } from "@/theme";

/** Full ARKit / ARCore via ViroReact — requires dev build (not Expo Go). */
export default function ARViroScreen() {
  const { wallpaper, scale, opacity, select } = useSelection();
  const { library, trayLibrary } = useWallpaperLibrary();
  const {
    placements,
    add,
    clear,
    undo,
    redo,
    canUndo,
    canRedo,
    hydrate,
    update,
    beginGesture,
    endGesture,
  } = usePlacements();
  const {
    useAnchors,
    anchorsAvailable,
    lastRestoredAt,
    useLightingEstimation,
    depthOcclusion,
    ambientLight,
    setUseAnchors,
    setAnchorsAvailable,
    setUseLightingEstimation,
    setDepthOcclusion,
    setAmbientLight,
    markRestored,
  } = useArSession();

  const [tracking, setTracking] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [viewZoom, setViewZoom] = useState(1);
  const [restoredCount, setRestoredCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<InstanceType<typeof ViroARSceneNavigator>>(null);

  useEffect(() => {
    loadPlacementsFromDb()
      .then(async (saved) => {
        if (saved.length > 0) {
          hydrate(saved);
          setRestoredCount(saved.length);
          markRestored();
        }
        const meta = await getSessionMeta();
        if (meta && meta.placementCount > 0) setRestoredCount(meta.placementCount);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePlacementsToDb(placements).catch(() => {});
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [placements]);

  const compareWall = library.find((w) => w.id === compareId) ?? library.find((w) => w.id !== wallpaper.id);

  const makePlacement = useCallback(
    (payload: PlanePlacementPayload, w: (typeof library)[0], wScale = 1) => ({
      id: `ar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      wallpaperId: w.id,
      textureUrl: w.texture,
      width: payload.width * wScale,
      height: payload.height,
      scale,
      rotationDeg: 0,
      opacity,
      anchorId: useAnchors ? payload.anchorId : undefined,
      localPosition: payload.localPosition,
      anchorPosition: payload.anchorPosition,
      anchorRotation: payload.anchorRotation,
      anchorTransform: payload.anchorTransform,
      physicalRepeatCm: w.physicalRepeatCm,
      tileable: w.tileable ?? true,
      createdAt: Date.now(),
    }),
    [scale, opacity, useAnchors],
  );

  const onPlanePlaced = useCallback(
    (payload: PlanePlacementPayload) => {
      add(makePlacement(payload, wallpaper));
      if (compareOpen && compareWall) {
        const offset: PlanePlacementPayload = {
          ...payload,
          localPosition: payload.localPosition
            ? ([payload.localPosition[0] + 0.35, 0, payload.localPosition[2]] as [number, number, number])
            : ([0.35, 0, 0] as [number, number, number]),
        };
        add(makePlacement(offset, compareWall, 0.48));
      }
    },
    [add, wallpaper, compareOpen, compareWall, makePlacement],
  );

  const onPlacementChange = useCallback(
    (id: string, patch: Partial<typeof placements[0]>) => {
      update(id, patch);
    },
    [update],
  );

  const exportSnapshot = useCallback(async () => {
    try {
      const shot = await navRef.current?.arSceneNavigator?.takeScreenshot?.(`wallviz-${Date.now()}`, false);
      if (shot?.success && shot.url) {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(shot.url);
        else Alert.alert("Saved", shot.url);
      } else {
        Alert.alert("Export failed", shot?.errorCode ?? "Could not capture AR view.");
      }
    } catch {
      Alert.alert("Export failed", "Screenshot requires a dev build with Viro.");
    }
  }, []);

  const sceneProps = useMemo(
    () => ({
      textureUrl: wallpaper.texture,
      wallpaperId: wallpaper.id,
      physicalRepeatCm: wallpaper.physicalRepeatCm,
      tileable: wallpaper.tileable ?? true,
      opacity,
      scale,
      placements,
      selectedId,
      useAnchors,
      useLighting: useLightingEstimation,
      ambientLight,
      onTracking: setTracking,
      onAnchorsAvailable: setAnchorsAvailable,
      onAmbientLight: setAmbientLight,
      onPlanePlaced,
      onSelectPlacement: setSelectedId,
      onPlacementChange,
      onGestureStart: beginGesture,
      onGestureEnd: endGesture,
    }),
    [
      wallpaper,
      opacity,
      scale,
      placements,
      selectedId,
      useAnchors,
      useLightingEstimation,
      ambientLight,
      onPlanePlaced,
      onPlacementChange,
      beginGesture,
      endGesture,
      setAnchorsAvailable,
      setAmbientLight,
    ],
  );

  const toggleAnchors = () => setUseAnchors(!useAnchors);

  const statusLabel = [
    tracking ? "Tracking" : "Scanning…",
    useAnchors && anchorsAvailable ? "anchored" : null,
    useLightingEstimation && ambientLight ? "lit" : null,
    depthOcclusion ? "depth" : null,
    selectedId ? "editing" : `${placements.length} wall${placements.length !== 1 ? "s" : ""}`,
    restoredCount > 0 && lastRestoredAt ? "restored" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.root}>
      <ViroARSceneNavigator
        ref={navRef}
        key={`${wallpaper.id}-${sessionKey}`}
        autofocus
        initialScene={{ scene: createARScene(sceneProps) }}
        style={styles.ar}
        viroAppProps={sceneProps}
        occlusionMode={depthOcclusion ? "depthBased" : "disabled"}
        monocularDepthTargetFPS={depthOcclusion ? 15 : undefined}
      />

      <SafeAreaView style={styles.hudTop} pointerEvents="box-none">
        <Pressable
          style={styles.hudBtn}
          onPress={() => {
            clear();
            setSelectedId(null);
            setRestoredCount(0);
            setSessionKey((k) => k + 1);
          }}
        >
          <Text style={styles.hudBtnText}>⌫</Text>
        </Pressable>
        <Text style={styles.chip} numberOfLines={1}>
          {statusLabel} · {wallpaper.name}
        </Text>
        <Pressable style={styles.hudBtn} onPress={exportSnapshot}>
          <Text style={styles.hudBtnText}>⤓</Text>
        </Pressable>
        <Pressable style={[styles.hudBtn, compareOpen && styles.hudBtnOn]} onPress={() => setCompareOpen((c) => !c)}>
          <Text style={styles.hudBtnText}>⇄</Text>
        </Pressable>
        {anchorsAvailable && (
          <Pressable style={[styles.hudBtn, useAnchors && styles.hudBtnOn]} onPress={toggleAnchors}>
            <Text style={styles.hudBtnText}>{useAnchors ? "🔒" : "🔓"}</Text>
          </Pressable>
        )}
      </SafeAreaView>

      <HudRail
        zoom={viewZoom}
        onZoomIn={() => setViewZoom((z) => Math.min(2.4, z + 0.12))}
        onZoomOut={() => setViewZoom((z) => Math.max(0.6, z - 0.12))}
        extra={[
          { key: "undo", label: "↶", onPress: undo, disabled: !canUndo() },
          { key: "redo", label: "↷", onPress: redo, disabled: !canRedo() },
          {
            key: "light",
            label: "☀",
            onPress: () => setUseLightingEstimation(!useLightingEstimation),
            active: useLightingEstimation,
          },
          {
            key: "depth",
            label: "◐",
            onPress: () => setDepthOcclusion(!depthOcclusion),
            active: depthOcclusion,
          },
        ]}
      />

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
          onSelect={(w) => {
            select(w);
            setPickerOpen(false);
          }}
        />
        <Pressable style={styles.trayBtn} onPress={() => { setPickerOpen((o) => !o); setCompareOpen(false); }}>
          <Text style={styles.trayBtnText}>{pickerOpen ? "Hide" : "Wallpaper"}</Text>
        </Pressable>
        <Text style={styles.hint}>
          Roll {wallpaper.physicalRepeatCm[0]}cm · repeat {wallpaper.physicalRepeatCm[1]}cm
          {selectedId ? " · drag corner dots · pinch · drag · rotate" : ""}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  ar: { flex: 1 },
  hudTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  hudBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  hudBtnOn: { backgroundColor: colors.accent },
  hudBtnText: { color: "#fff", fontSize: 16 },
  chip: {
    flex: 1,
    color: "#fff",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 8,
    borderRadius: 20,
    overflow: "hidden",
    fontSize: 12,
  },
  hudBottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12, gap: 10 },
  trayBtn: {
    alignSelf: "center",
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  trayBtnText: { color: "#fff", fontWeight: "600" },
  hint: { color: "rgba(255,255,255,0.65)", textAlign: "center", fontSize: 11 },
});
