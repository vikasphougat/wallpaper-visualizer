import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

type RailBtn = { key: string; label: string; onPress: () => void; active?: boolean; disabled?: boolean };

type Props = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  extra?: RailBtn[];
};

export function HudRail({ zoom, onZoomIn, onZoomOut, extra = [] }: Props) {
  return (
    <View style={styles.rail}>
      <Pressable style={styles.btn} onPress={onZoomIn} accessibilityLabel="Zoom in">
        <Text style={styles.btnText}>+</Text>
      </Pressable>
      <Text style={styles.val}>{Math.round(zoom * 100)}%</Text>
      <Pressable style={styles.btn} onPress={onZoomOut} accessibilityLabel="Zoom out">
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      {extra.length > 0 && <View style={styles.sep} />}
      {extra.map((b) => (
        <Pressable
          key={b.key}
          style={[styles.btn, b.active && styles.btnOn, b.disabled && styles.btnDisabled]}
          onPress={b.onPress}
          disabled={b.disabled}
        >
          <Text style={styles.btnText}>{b.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: "absolute",
    right: 12,
    top: "40%",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnOn: { backgroundColor: colors.accent },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 20, fontWeight: "600" },
  val: { color: "#fff", fontSize: 11 },
  sep: { width: 22, height: 1, backgroundColor: "rgba(255,255,255,0.35)" },
});
