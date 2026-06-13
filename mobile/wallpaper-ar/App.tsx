import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

/**
 * iOS AR scaffold — replace this screen with ARKit wall placement (ViroReact or expo-three).
 * See README.md for the implementation plan.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wallpaper AR (iOS)</Text>
      <Text style={styles.sub}>
        ARKit native build — scaffold only. Use the web app on Android for WebXR AR today.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { color: "#fff", fontSize: 22, fontWeight: "600", marginBottom: 12 },
  sub: { color: "#aaa", fontSize: 14, textAlign: "center", lineHeight: 20 },
});
