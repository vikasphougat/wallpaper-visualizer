import { ADE20K_OCCLUDERS, ADE20K_WALL } from "./ade20kClasses";

export interface WallSegmentationResult {
  /** Wall corners in normalised image space [TL, TR, BR, BL]. */
  quad: [number, number][];
  /** Per-pixel mask: 0 = no wallpaper, 255 = wall surface. */
  mask: Uint8Array;
  maskWidth: number;
  maskHeight: number;
  wallPixelRatio: number;
}

let modelPromise: Promise<{
  predict: (input: unknown) => { shape: number[]; data: () => Promise<ArrayLike<number>>; dispose: () => void };
  dispose: () => void;
}> | null = null;

async function loadDeepLab() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, deeplab] = await Promise.all([
        import("@tensorflow/tfjs"),
        import("@tensorflow-models/deeplab"),
      ]);
      await tf.ready();
      try {
        await tf.setBackend("webgl");
        await tf.ready();
      } catch {
        await import("@tensorflow/tfjs-backend-wasm");
        await tf.setBackend("wasm");
        await tf.ready();
      }
      return deeplab.load({ base: "ade20k", quantizationBytes: 2 });
    })();
  }
  return modelPromise;
}

/** Dilate occluder regions so cutouts extend slightly past object edges. */
function dilateOccluders(
  occluder: Uint8Array,
  w: number,
  h: number,
  radius: number,
): Uint8Array {
  const out = occluder.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!occluder[y * w + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}

/** Light box blur on mask for anti-aliased edges. */
function softenMask(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            sum += mask[ny * w + nx];
            n++;
          }
        }
      }
      out[y * w + x] = Math.round(sum / n);
    }
  }
  return out;
}

function quadFromMask(mask: Uint8Array, pw: number, ph: number): [number, number][] {
  let minX = pw,
    minY = ph,
    maxX = 0,
    maxY = 0;
  let count = 0;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (mask[y * pw + x] > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }
  if (count < pw * ph * 0.015) {
    throw new Error("No clear wall detected — drag the blue corners manually.");
  }

  // Inset slightly so wallpaper doesn't bleed over ceiling/floor/adjacent walls.
  const padX = Math.max(1, Math.round((maxX - minX) * 0.01));
  const padY = Math.max(1, Math.round((maxY - minY) * 0.01));
  minX = Math.min(pw - 1, minX + padX);
  maxX = Math.max(0, maxX - padX);
  minY = Math.min(ph - 1, minY + padY);
  maxY = Math.max(0, maxY - padY);

  const nx0 = minX / pw;
  const nx1 = maxX / pw;
  const ny0 = minY / ph;
  const ny1 = maxY / ph;
  return [
    [nx0, ny0],
    [nx1, ny0],
    [nx1, ny1],
    [nx0, ny1],
  ];
}

/**
 * Semantic wall segmentation with object-aware cutouts.
 * Returns a per-pixel mask + perspective quad fitted to the main wall.
 */
export async function segmentWallMask(bitmap: ImageBitmap): Promise<WallSegmentationResult> {
  let model;
  try {
    model = await loadDeepLab();
  } catch (err) {
    console.error("[wall-segment] ML load failed:", err);
    throw new Error(
      "Could not load ML libraries. On the dev PC run:\n" +
        "npm install --legacy-peer-deps\n" +
        "Then restart: npm run dev",
    );
  }

  const tf = await import("@tensorflow/tfjs");
  const maxEdge = 513;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const pw = Math.max(1, Math.round(bitmap.width * scale));
  const ph = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, pw, ph);

  const input = tf.browser.fromPixels(canvas);
  const pred = model.predict(input);
  const [mh, mw] = pred.shape as [number, number];
  const labels = (await pred.data()) as ArrayLike<number>;
  input.dispose();
  pred.dispose();

  const occluder = new Uint8Array(mw * mh);
  const wallRaw = new Uint8Array(mw * mh);

  for (let i = 0; i < labels.length; i++) {
    const cls = labels[i];
    if (ADE20K_OCCLUDERS.has(cls)) occluder[i] = 1;
    if (cls === ADE20K_WALL) wallRaw[i] = 1;
  }

  const occluderDilated = dilateOccluders(occluder, mw, mh, 2);
  const maskBinary = new Uint8Array(mw * mh);
  let wallCount = 0;
  for (let i = 0; i < labels.length; i++) {
    if (wallRaw[i] && !occluderDilated[i]) {
      maskBinary[i] = 255;
      wallCount++;
    }
  }

  const mask = softenMask(maskBinary, mw, mh);
  const quad = quadFromMask(mask, mw, mh);

  return {
    quad,
    mask,
    maskWidth: mw,
    maskHeight: mh,
    wallPixelRatio: wallCount / labels.length,
  };
}

/** Upscale segmentation mask to full photo resolution for GPU sampling. */
export function upscaleMaskToPhoto(
  mask: Uint8Array,
  maskW: number,
  maskH: number,
  photoW: number,
  photoH: number,
): Uint8Array {
  const out = new Uint8Array(photoW * photoH);
  for (let y = 0; y < photoH; y++) {
    for (let x = 0; x < photoW; x++) {
      const sx = Math.min(maskW - 1, Math.round((x / photoW) * maskW));
      const sy = Math.min(maskH - 1, Math.round((y / photoH) * maskH));
      out[y * photoW + x] = mask[sy * maskW + sx];
    }
  }
  return out;
}
