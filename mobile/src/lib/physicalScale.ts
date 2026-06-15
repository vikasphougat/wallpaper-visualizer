/** Marshalls standard roll width in metres (1.04 m). */
export const MARSHALLS_ROLL_WIDTH_M = 1.04;

/** Convert wallpaper physical repeat [rollWidthCm, patternRepeatCm] to texture tiling. */
export function textureRepeatForSize(
  patchSizeM: [number, number],
  physicalRepeatCm: [number, number],
  tileable = true,
): [number, number] {
  if (!tileable) return [1, 1];
  const rollM = physicalRepeatCm[0] / 100;
  const repeatM = Math.max(physicalRepeatCm[1] / 100, rollM);
  return [
    Math.max(0.5, patchSizeM[0] / rollM),
    Math.max(0.5, patchSizeM[1] / repeatM),
  ];
}

/** Default patch width using real roll width. */
export function defaultPatchWidthM(physicalRepeatCm: [number, number]): number {
  return physicalRepeatCm[0] / 100;
}

/** Default wall height for a full-height patch (2.4 m). */
export const DEFAULT_WALL_HEIGHT_M = 2.4;
