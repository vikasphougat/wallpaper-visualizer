import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Image } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { PatchCornerHandles, resizePatchFromCorner } from "@/components/PatchCornerHandles";

export type ARPatch = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg: number;
  textureUrl: string;
};

type Props = {
  patch: ARPatch;
  selected: boolean;
  opacity: number;
  coverMode: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ARPatch>) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
};

export function ARPatchView({
  patch,
  selected,
  opacity,
  coverMode,
  onSelect,
  onChange,
  onGestureStart,
  onGestureEnd,
}: Props) {
  const x = useSharedValue(patch.x);
  const y = useSharedValue(patch.y);
  const w = useSharedValue(patch.w);
  const h = useSharedValue(patch.h);
  const rot = useSharedValue(patch.rotationDeg);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);
  const startRot = useSharedValue(0);
  const boundsRef = useRef({ x: patch.x, y: patch.y, w: patch.w, h: patch.h });

  useEffect(() => {
    x.value = patch.x;
    y.value = patch.y;
    w.value = patch.w;
    h.value = patch.h;
    rot.value = patch.rotationDeg;
    boundsRef.current = { x: patch.x, y: patch.y, w: patch.w, h: patch.h };
  }, [patch, x, y, w, h, rot]);

  const commit = (next: Partial<ARPatch>) => onChange(next);

  const syncBounds = useCallback(() => {
    boundsRef.current = { x: x.value, y: y.value, w: w.value, h: h.value };
  }, [x, y, w, h]);

  const pan = Gesture.Pan()
    .onStart(() => {
      runOnJS(onGestureStart)();
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(syncBounds)();
      runOnJS(commit)({ x: x.value, y: y.value });
      runOnJS(onGestureEnd)();
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      runOnJS(onGestureStart)();
      startW.value = w.value;
      startH.value = h.value;
    })
    .onUpdate((e) => {
      const f = Math.min(3, Math.max(0.25, e.scale));
      w.value = startW.value * f;
      h.value = startH.value * f;
    })
    .onEnd(() => {
      runOnJS(syncBounds)();
      runOnJS(commit)({ w: w.value, h: h.value });
      runOnJS(onGestureEnd)();
    });

  const rotation = Gesture.Rotation()
    .onStart(() => {
      runOnJS(onGestureStart)();
      startRot.value = rot.value;
    })
    .onUpdate((e) => {
      rot.value = startRot.value + (e.rotation * 180) / Math.PI;
    })
    .onEnd(() => {
      runOnJS(commit)({ rotationDeg: rot.value });
      runOnJS(onGestureEnd)();
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)();
  });

  const handleCornerResize = useCallback(
    (
      corner: "tl" | "tr" | "bl" | "br",
      dx: number,
      dy: number,
      startWv: number,
      startHv: number,
      startXv: number,
      startYv: number,
    ) => {
      const next = resizePatchFromCorner(corner, dx, dy, startWv, startHv, startXv, startYv);
      x.value = next.x;
      y.value = next.y;
      w.value = next.w;
      h.value = next.h;
      boundsRef.current = next;
    },
    [x, y, w, h],
  );

  const commitBounds = useCallback(() => {
    commit(boundsRef.current);
  }, [commit]);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
    opacity,
    transform: [{ rotate: `${rot.value}deg` }],
    borderWidth: selected ? 2 : 1,
    borderColor: selected ? "rgba(77,163,255,0.95)" : "rgba(255,255,255,0.35)",
    overflow: "visible",
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(tap, pan, pinch, rotation)}>
      <Animated.View style={style}>
        <Image
          source={{ uri: patch.textureUrl }}
          style={styles.img}
          resizeMode={coverMode ? "cover" : "repeat"}
        />
        {selected && (
          <PatchCornerHandles
            getBounds={() => boundsRef.current}
            onGestureStart={onGestureStart}
            onGestureEnd={onGestureEnd}
            onResize={handleCornerResize}
            onResizeEnd={commitBounds}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  img: { width: "100%", height: "100%" },
});
