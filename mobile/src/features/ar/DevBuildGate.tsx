import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "@/theme";

type Props = {
  onDismiss?: () => void;
  emulatorMode?: boolean;
};

/** Shown in Expo Go or emulator — explains dev build / physical device for full AR. */
export function DevBuildGate({ onDismiss, emulatorMode }: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{emulatorMode ? "Emulator preview mode" : "Preview mode (Expo Go)"}</Text>
      <Text style={styles.body}>
        {emulatorMode
          ? "Viro AR needs a physical Android device (ARM + ARCore). The emulator uses camera overlay AR here."
          : "Plane detection, anchors, depth occlusion, and TFLite ML need a dev build on a real device:\nnpx expo prebuild && npx expo run:android"}
      </Text>
      {onDismiss && (
        <Pressable style={styles.btn} onPress={onDismiss}>
          <Text style={styles.btnText}>Got it</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1,
    borderColor: colors.accentSoft,
  },
  title: { color: "#fff", fontWeight: "700", fontSize: 13, marginBottom: 6 },
  body: { color: "rgba(255,255,255,0.85)", fontSize: 11, lineHeight: 16 },
  btn: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
