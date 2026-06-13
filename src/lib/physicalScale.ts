/** Marshalls standard roll width in metres (1.04 m). */
export const MARSHALLS_ROLL_WIDTH_M = 1.04;

/** Convert wallpaper physical repeat [rollWidthCm, patternRepeatCm] to texture tiling. */
export function textureRepeatForSize(
  patchSizeM: [number, number],
  physicalRepeatCm: [number, number],
  tileable: boolean,
): [number, number] {
  if (!tileable) return [1, 1];
  const rollM = physicalRepeatCm[0] / 100;
  const repeatM = Math.max(physicalRepeatCm[1] / 100, rollM);
  return [
    Math.max(0.5, patchSizeM[0] / rollM),
    Math.max(0.5, patchSizeM[1] / repeatM),
  ];
}

/** Default patch width using real roll width (Marshalls 1.04 m). */
export function defaultPatchWidthM(physicalRepeatCm: [number, number]): number {
  return physicalRepeatCm[0] / 100;
}
