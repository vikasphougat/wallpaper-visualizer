import { segmentWallMask } from "./wallMask";

let mlReady: Promise<boolean> | null = null;

/** Probe whether TF.js + DeepLab can be loaded (cached after first check). */
export function isMlAvailable(): Promise<boolean> {
  if (!mlReady) {
    mlReady = (async () => {
      try {
        await import("@tensorflow/tfjs");
        await import("@tensorflow-models/deeplab");
        return true;
      } catch {
        return false;
      }
    })();
  }
  return mlReady;
}

/** Legacy: bounding quad only (no pixel mask). */
export async function detectWallQuad(bitmap: ImageBitmap): Promise<[number, number][]> {
  const result = await segmentWallMask(bitmap);
  return result.quad;
}

export { segmentWallMask, upscaleMaskToPhoto } from "./wallMask";
export type { WallSegmentationResult } from "./wallMask";
