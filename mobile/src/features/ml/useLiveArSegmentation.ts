import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelRatio } from "react-native";
import type { CameraView } from "expo-camera";
import { segmentWallFromUri, getSegmentationBackend, type SegmentationMaskResult } from "./segmentationProvider";
import { hashFrameKey } from "./maskCache";
import { PERF, arMlFpsForTier, estimatePerfTier } from "@/lib/perfConfig";

type Options = {
  enabled: boolean;
  fps?: number;
  paused?: boolean;
  cameraRef: React.RefObject<CameraView | null>;
};

export function useLiveArSegmentation({ enabled, fps, paused = false, cameraRef }: Options) {
  const tier = useMemo(() => estimatePerfTier(PixelRatio.get()), []);
  const targetFps = fps ?? arMlFpsForTier(tier, paused);

  const [result, setResult] = useState<SegmentationMaskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [backend, setBackend] = useState<"tflite" | "tfjs" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const lastRun = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    void getSegmentationBackend().then(setBackend);
  }, [enabled]);

  const tick = useCallback(async () => {
    if (!enabled || paused || inflight.current) return;
    const now = Date.now();
    if (now - lastRun.current < PERF.arMlMinIntervalMs) return;

    const cam = cameraRef.current as CameraView & {
      takePictureAsync?: (opts: { quality: number; shutterSound?: boolean }) => Promise<{ uri: string }>;
    };
    if (!cam?.takePictureAsync) return;

    inflight.current = true;
    lastRun.current = now;
    setBusy(true);
    try {
      const frame = await cam.takePictureAsync({
        quality: PERF.arMlSnapshotQuality,
        shutterSound: false,
      });
      if (frame?.uri) {
        const key = hashFrameKey(`${frame.uri}-${now >> 10}`);
        const seg = await segmentWallFromUri(frame.uri, key);
        setResult(seg);
        setError(null);
        if (!backend) setBackend(await getSegmentationBackend());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Segmentation failed");
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, [enabled, paused, cameraRef, backend]);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }
    const ms = Math.round(1000 / Math.min(5, Math.max(1.5, targetFps)));
    const id = setInterval(() => void tick(), ms);
    return () => clearInterval(id);
  }, [enabled, targetFps, tick]);

  return { result, busy, backend, error, targetFps };
}

/** Map normalised wall quad to screen pixels for Expo Go overlay hints. */
export function quadToScreen(
  quad: [number, number][],
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX * width,
    y: minY * height,
    w: (maxX - minX) * width,
    h: (maxY - minY) * height,
  };
}
