import { getCachedMask, setCachedMask, hashFrameKey } from "./maskCache";
import { segmentWithTfjs } from "./tfjsSegmentation";
import type { SegmentationMaskResult } from "./maskPostProcess";
import { isNativeMlAvailable } from "@/lib/nativeMl";

export type SegmentationBackend = "tflite" | "tfjs";

let preferredBackend: SegmentationBackend = isNativeMlAvailable() ? "tflite" : "tfjs";
let backendResolved: SegmentationBackend | null = null;

async function resolveBackend(): Promise<SegmentationBackend> {
  if (backendResolved) return backendResolved;

  if (isNativeMlAvailable() && preferredBackend === "tflite") {
    try {
      const { isTfliteReady } = await import("./tfliteSegmentation");
      if (await isTfliteReady()) {
        backendResolved = "tflite";
        return "tflite";
      }
    } catch {
      /* fall through to tfjs */
    }
  }

  backendResolved = "tfjs";
  return "tfjs";
}

export async function getSegmentationBackend(): Promise<SegmentationBackend> {
  return resolveBackend();
}

export function setPreferredBackend(backend: SegmentationBackend): void {
  preferredBackend = backend;
  backendResolved = null;
}

/** Segment wall from a still image URI — TFLite in dev build, tfjs in Expo Go. */
export async function segmentWallFromUri(uri: string, cacheKey?: string): Promise<SegmentationMaskResult> {
  const key = cacheKey ?? hashFrameKey(uri);
  const cached = getCachedMask(key);
  if (cached) return cached;

  const backend = await resolveBackend();
  const result =
    backend === "tflite"
      ? await (await import("./tfliteSegmentation")).segmentWithTflite(uri)
      : await segmentWithTfjs(uri);

  setCachedMask(key, result);
  return result;
}

export type { SegmentationMaskResult };
