import { StyleSheet, Text, View, FlatList, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelection } from "@/stores/selection";
import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import { thumbTexture } from "@/lib/thumbTexture";
import { colors } from "@/theme";

export default function CatalogScreen() {
  const { library, syncing, marshallsCount } = useWallpaperLibrary();
  const wallpaper = useSelection((s) => s.wallpaper);
  const select = useSelection((s) => s.select);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.title}>Wallpaper catalog</Text>
      <Text style={styles.sub}>
        Pick a design — it stays selected across Photo, 3D, and AR.
        {marshallsCount > 0 && ` Marshalls: ${marshallsCount}${syncing ? " (syncing…)" : ""}.`}
      </Text>
      <FlatList
        data={library}
        keyExtractor={(w) => w.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item: w }) => {
          const active = w.id === wallpaper.id;
          return (
            <Pressable style={[styles.card, active && styles.cardActive]} onPress={() => select(w)}>
              <Image source={{ uri: thumbTexture(w.texture, 256) }} style={styles.preview} fadeDuration={0} />
              <Text style={styles.name}>{w.name}</Text>
              {w.source && <Text style={styles.meta}>{w.source}</Text>}
              {active && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 8 },
  sub: { fontSize: 13, color: colors.textDim, marginBottom: 12 },
  list: { paddingBottom: 24, gap: 12 },
  row: { gap: 12 },
  card: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 6,
  },
  cardActive: { borderColor: colors.accentSoft },
  preview: { height: 90, borderRadius: 10 },
  name: { color: colors.text, fontSize: 13, fontWeight: "600" },
  meta: { color: colors.textDim, fontSize: 11 },
  check: { position: "absolute", top: 8, right: 10, color: colors.accentSoft, fontWeight: "700" },
});
