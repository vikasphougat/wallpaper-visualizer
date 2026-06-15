import type { WallPlacement } from "@/types/placement";
import { worldToPlaneLocal } from "@/lib/anchorMath";

export type GestureBaselines = {
  width: number;
  height: number;
  rotationDeg: number;
  localPosition: [number, number, number];
};

export function baselinesFromPlacement(p: WallPlacement): GestureBaselines {
  return {
    width: p.width,
    height: p.height,
    rotationDeg: p.rotationDeg,
    localPosition: p.localPosition ?? [0, 0, 0],
  };
}

export function applyPinch(
  base: GestureBaselines,
  scaleFactor: number,
): Pick<WallPlacement, "width" | "height" | "scale"> {
  const f = Math.min(4, Math.max(0.2, scaleFactor));
  return {
    width: base.width * f,
    height: base.height * f,
    scale: f,
  };
}

export function applyRotate(base: GestureBaselines, rotationFactor: number): Pick<WallPlacement, "rotationDeg"> {
  const deg = base.rotationDeg + rotationFactor;
  return { rotationDeg: ((deg % 360) + 360) % 360 };
}

export function applyCornerResize(
  base: GestureBaselines,
  corner: "tl" | "tr" | "bl" | "br",
  dragLocal: [number, number, number],
): Partial<WallPlacement> {
  const min = 0.15;
  const x = dragLocal[0];
  const z = dragLocal[2];
  const [lx, , lz] = base.localPosition;

  switch (corner) {
    case "br": {
      const width = Math.max(min, x * 2);
      const height = Math.max(min, z * 2);
      return { width, height };
    }
    case "tl": {
      const width = Math.max(min, base.width - x * 2);
      const height = Math.max(min, base.height - z * 2);
      return {
        width,
        height,
        localPosition: [lx + (base.width - width) / 2, 0, lz + (base.height - height) / 2],
      };
    }
    case "tr": {
      const width = Math.max(min, x * 2);
      const height = Math.max(min, base.height - z * 2);
      return {
        width,
        height,
        localPosition: [lx - (base.width - width) / 2, 0, lz + (base.height - height) / 2],
      };
    }
    case "bl": {
      const width = Math.max(min, base.width - x * 2);
      const height = Math.max(min, z * 2);
      return {
        width,
        height,
        localPosition: [lx + (base.width - width) / 2, 0, lz - (base.height - height) / 2],
      };
    }
  }
}

export function applyDrag(
  dragToPos: [number, number, number],
  placement: WallPlacement,
): Pick<WallPlacement, "localPosition"> {
  if (placement.anchorPosition && placement.anchorRotation) {
    const local = worldToPlaneLocal(dragToPos, placement.anchorPosition, placement.anchorRotation);
    return { localPosition: [local[0], 0, local[2]] };
  }
  return { localPosition: [dragToPos[0], 0, dragToPos[2]] };
}
