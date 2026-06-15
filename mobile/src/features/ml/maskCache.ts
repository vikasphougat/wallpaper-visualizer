import type { SegmentationMaskResult } from "./maskPostProcess";

const MAX_ENTRIES = 12;
const cache = new Map<string, { at: number; result: SegmentationMaskResult }>();

/** Simple FNV-1a hash for URI / frame fingerprints. */
export function hashFrameKey(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function getCachedMask(key: string): SegmentationMaskResult | null {
  const hit = cache.get(key);
  return hit?.result ?? null;
}

export function setCachedMask(key: string, result: SegmentationMaskResult): void {
  cache.set(key, { at: Date.now(), result });
  if (cache.size <= MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [k, v] of cache) {
    if (v.at < oldestAt) {
      oldestAt = v.at;
      oldestKey = k;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function clearMaskCache(): void {
  cache.clear();
}
