export interface WallPlacement {
  id: string;
  wallpaperId: string;
  textureUrl: string;
  /** Plane width in metres (AR) or normalised (fallback). */
  width: number;
  height: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
  /** ARKit/ARCore plane anchor id — locks quad to detected wall. */
  anchorId?: string;
  /** Offset from anchor origin in plane-local space (Y=0 on wall surface). */
  localPosition?: [number, number, number];
  /** World pose snapshot at placement time (for restore / fallback). */
  anchorPosition?: [number, number, number];
  anchorRotation?: [number, number, number];
  /** 4×4 column-major transform — serialised for persistence. */
  anchorTransform?: number[];
  /** Catalog roll / repeat sizes for physically correct tiling. */
  physicalRepeatCm?: [number, number];
  tileable?: boolean;
  createdAt: number;
}

export interface RoomSession {
  id: string;
  placements: WallPlacement[];
  updatedAt: number;
}

export type PlanePlacementPayload = {
  width: number;
  height: number;
  anchorId?: string;
  localPosition?: [number, number, number];
  anchorPosition?: [number, number, number];
  anchorRotation?: [number, number, number];
  anchorTransform?: number[];
};
