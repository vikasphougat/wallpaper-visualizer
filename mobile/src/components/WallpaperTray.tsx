import { memo, useCallback } from "react";
import { StyleSheet, Text, Pressable, FlatList, View, Image } from "react-native";
import type { Wallpaper } from "@/types";
import { thumbTexture } from "@/lib/thumbTexture";
import { colors } from "@/theme";

type Props = {
  library: Wallpaper[];
  selectedId: string;
  onSelect: (w: Wallpaper) => void;
  /** Keep mounted but hidden — avoids slow mount when opening the picker. */
  visible?: boolean;
};

const Swatch = memo(function Swatch({
  item,
  active,
  onPress,
}: {
  item: Wallpaper;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.swatch, active && styles.swatchActive]}>
      <Image
        source={{ uri: thumbTexture(item.texture) }}
        style={styles.swatchImg}
        fadeDuration={0}
        resizeMode="cover"
      />
      <Text style={styles.swatchName} numberOfLines={1}>
        {item.name}
      </Text>
    </Pressable>
  );
});

export const WallpaperTray = memo(function WallpaperTray({
  library,
  selectedId,
  onSelect,
  visible = true,
}: Props) {
  const renderItem = useCallback(
    ({ item }: { item: Wallpaper }) => (
      <Swatch item={item} active={item.id === selectedId} onPress={() => onSelect(item)} />
    ),
    [onSelect, selectedId],
  );

  return (
    <View
      style={[styles.wrap, !visible && styles.hidden]}
      pointerEvents={visible ? "auto" : "none"}
      collapsable={false}
    >
      <FlatList
        horizontal
        data={library}
        keyExtractor={(w) => w.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        style={styles.tray}
        contentContainerStyle={styles.trayInner}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        getItemLayout={(_, index) => ({ length: 82, offset: 82 * index, index })}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { maxHeight: 100, overflow: "hidden" },
  hidden: { maxHeight: 0, height: 0, opacity: 0 },
  tray: { maxHeight: 100 },
  trayInner: { gap: 10, paddingHorizontal: 4 },
  swatch: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  swatchActive: { borderColor: colors.accentSoft },
  swatchImg: { width: "100%", height: "100%" },
  swatchName: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    fontSize: 9,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.55)",
    textAlign: "center",
    paddingVertical: 2,
  },
});
