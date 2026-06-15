import { Suspense, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas } from "@react-three/fiber/native";
import { OrbitControls } from "@react-three/drei/native";
import { useSelection } from "@/stores/selection";
import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import { WallpaperTray } from "@/components/WallpaperTray";
import { RoomScene, type FloorStyle, type LightingPreset, type RoomSizePreset, type WallId } from "./RoomScene";
import { colors } from "@/theme";

const WALLS: { id: WallId; label: string }[] = [
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

export default function RoomScreen() {
  const { wallpaper, scale, rotationDeg, set, select } = useSelection();
  const { library, trayLibrary } = useWallpaperLibrary();

  const [papered, setPapered] = useState<WallId[]>(["back"]);
  const [lighting, setLighting] = useState<LightingPreset>("apartment");
  const [roomSize, setRoomSize] = useState<RoomSizePreset>("standard");
  const [floorStyle, setFloorStyle] = useState<FloorStyle>("wood");
  const [furniture, setFurniture] = useState(false);
  const [shadows, setShadows] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const toggleWall = (id: WallId) => {
    setPapered((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  };

  return (
    <View style={styles.root}>
      <Canvas shadows camera={{ fov: 55, near: 0.1, far: 100 }} style={styles.canvas}>
        <Suspense fallback={null}>
          <RoomScene
            textureUrl={wallpaper.texture}
            papered={papered}
            paintColor="#ece7df"
            scale={scale}
            rotationDeg={rotationDeg}
            roomSize={roomSize}
            floorStyle={floorStyle}
            lighting={lighting}
            furniture={furniture}
            shadows={shadows}
          />
          <OrbitControls enableDamping minDistance={1.2} maxPolarAngle={Math.PI * 0.52} />
        </Suspense>
      </Canvas>

      <SafeAreaView style={styles.hud} pointerEvents="box-none" edges={["top"]}>
        <Text style={styles.title}>3D Room</Text>
        <Text style={styles.sub}>Pinch & drag to orbit · {wallpaper.name}</Text>
      </SafeAreaView>

      <SafeAreaView style={styles.bottom} edges={["bottom"]}>
        {optionsOpen && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Room options</Text>
            <ChipRow
              label="Walls"
              options={WALLS.map((w) => ({ id: w.id, label: w.label }))}
              active={papered}
              multi
              onToggle={(id) => toggleWall(id as WallId)}
            />
            <ChipRow
              label="Size"
              options={[
                { id: "cozy", label: "Cozy" },
                { id: "standard", label: "Standard" },
                { id: "wide", label: "Wide" },
              ]}
              active={[roomSize]}
              onSelect={(id) => setRoomSize(id as RoomSizePreset)}
            />
            <ChipRow
              label="Floor"
              options={[
                { id: "wood", label: "Wood" },
                { id: "tile", label: "Tile" },
                { id: "carpet", label: "Carpet" },
              ]}
              active={[floorStyle]}
              onSelect={(id) => setFloorStyle(id as FloorStyle)}
            />
            <ChipRow
              label="Light"
              options={[
                { id: "apartment", label: "Apartment" },
                { id: "daylight", label: "Day" },
                { id: "evening", label: "Evening" },
              ]}
              active={[lighting]}
              onSelect={(id) => setLighting(id as LightingPreset)}
            />
            <View style={styles.row}>
              <Toggle label="Furniture" on={furniture} onPress={() => setFurniture((f) => !f)} />
              <Toggle label="Shadows" on={shadows} onPress={() => setShadows((s) => !s)} />
            </View>
            <View style={styles.row}>
              <AdjBtn label="Pattern −" onPress={() => set({ scale: Math.max(0.3, scale - 0.1) })} />
              <AdjBtn label="Pattern +" onPress={() => set({ scale: Math.min(3, scale + 0.1) })} />
              <AdjBtn label="Rotate" onPress={() => set({ rotationDeg: (rotationDeg + 15) % 360 })} />
            </View>
          </View>
        )}
        <WallpaperTray
          visible={pickerOpen}
          library={trayLibrary}
          selectedId={wallpaper.id}
          onSelect={(w) => { select(w); setPickerOpen(false); }}
        />
        <View style={styles.dock}>
          <Pressable style={[styles.dockBtn, pickerOpen && styles.dockBtnOn]} onPress={() => { setPickerOpen((o) => !o); setOptionsOpen(false); }}>
            <Text style={styles.dockText}>🎨</Text>
          </Pressable>
          <Pressable style={[styles.dockBtn, optionsOpen && styles.dockBtnOn]} onPress={() => { setOptionsOpen((o) => !o); setPickerOpen(false); }}>
            <Text style={styles.dockText}>⚙</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ChipRow({
  label,
  options,
  active,
  multi,
  onSelect,
  onToggle,
}: {
  label: string;
  options: { id: string; label: string }[];
  active: string[];
  multi?: boolean;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = active.includes(o.id);
          return (
            <Pressable
              key={o.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => (multi ? onToggle?.(o.id) : onSelect?.(o.id))}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, on && styles.toggleOn]} onPress={onPress}>
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

function AdjBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.adjBtn} onPress={onPress}>
      <Text style={styles.adjBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#12151c" },
  canvas: { flex: 1 },
  hud: { position: "absolute", top: 0, left: 16, right: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, gap: 8, paddingHorizontal: 12 },
  panel: {
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  panelTitle: { color: "#fff", fontWeight: "600", fontSize: 14 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chipRow: { gap: 6 },
  chipLabel: { color: colors.textDim, fontSize: 11 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 12 },
  chipTextOn: { color: "#fff" },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  toggleOn: { backgroundColor: colors.accent },
  toggleText: { color: "#fff", fontSize: 12 },
  adjBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  adjBtnText: { color: "#fff", fontSize: 12 },
  dock: { flexDirection: "row", justifyContent: "center", gap: 16, paddingBottom: 8 },
  dockBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  dockBtnOn: { borderColor: colors.accentSoft },
  dockText: { fontSize: 20 },
});
