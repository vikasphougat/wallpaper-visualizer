import { useRef } from "react";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { colors } from "@/theme";

type Corner = "tl" | "tr" | "bl" | "br";

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

function cornerStyle(corner: Corner) {
  switch (corner) {
    case "tl":
      return { left: -16, top: -16 };
    case "tr":
      return { right: -16, top: -16 };
    case "bl":
      return { left: -16, bottom: -16 };
    case "br":
      return { right: -16, bottom: -16 };
  }
}

type Props = {
  onResize: (corner: Corner, dx: number, dy: number, startW: number, startH: number, startX: number, startY: number) => void;
  onResizeEnd?: () => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  getBounds: () => { x: number; y: number; w: number; h: number };
};

export function PatchCornerHandles({ onResize, onResizeEnd, onGestureStart, onGestureEnd, getBounds }: Props) {
  return (
    <>
      {CORNERS.map((corner) => (
        <CornerDot
          key={corner}
          corner={corner}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
          getBounds={getBounds}
        />
      ))}
    </>
  );
}

function CornerDot({
  corner,
  onResize,
  onResizeEnd,
  onGestureStart,
  onGestureEnd,
  getBounds,
}: {
  corner: Corner;
  onResize: Props["onResize"];
  onResizeEnd?: () => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  getBounds: () => { x: number; y: number; w: number; h: number };
}) {
  const start = useRef({ w: 0, h: 0, x: 0, y: 0 });

  const pan = Gesture.Pan()
    .hitSlop(12)
    .onStart(() => {
      const b = getBounds();
      start.current = { w: b.w, h: b.h, x: b.x, y: b.y };
      runOnJS(onGestureStart)();
    })
    .onUpdate((e) => {
      runOnJS(onResize)(corner, e.translationX, e.translationY, start.current.w, start.current.h, start.current.x, start.current.y);
    })
    .onEnd(() => {
      if (onResizeEnd) runOnJS(onResizeEnd)();
      runOnJS(onGestureEnd)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.dot, cornerStyle(corner)]} />
    </GestureDetector>
  );
}

export function resizePatchFromCorner(
  corner: Corner,
  dx: number,
  dy: number,
  startW: number,
  startH: number,
  startX: number,
  startY: number,
  min = 48,
): { x: number; y: number; w: number; h: number } {
  const minW = min;
  const minH = min;

  switch (corner) {
    case "br":
      return {
        x: startX,
        y: startY,
        w: Math.max(minW, startW + dx),
        h: Math.max(minH, startH + dy),
      };
    case "bl":
      return {
        x: startX + dx,
        y: startY,
        w: Math.max(minW, startW - dx),
        h: Math.max(minH, startH + dy),
      };
    case "tr":
      return {
        x: startX,
        y: startY + dy,
        w: Math.max(minW, startW + dx),
        h: Math.max(minH, startH - dy),
      };
    case "tl":
      return {
        x: startX + dx,
        y: startY + dy,
        w: Math.max(minW, startW - dx),
        h: Math.max(minH, startH - dy),
      };
  }
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 50,
    elevation: 50,
  },
});
