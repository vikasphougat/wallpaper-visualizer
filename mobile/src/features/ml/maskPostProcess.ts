import { ADE20K_OCCLUDERS, ADE20K_WALL } from "@/features/photo/ade20kClasses";

export interface SegmentationMaskResult {
  quad: [number, number][];
  mask: Uint8Array;
  maskWidth: number;
  maskHeight: number;
  wallPixelRatio: number;
}

export function dilateOccluders(occluder: Uint8Array, w: number, h: number, radius: number): Uint8Array {
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

export function softenMask(mask: Uint8Array, w: number, h: number): Uint8Array {
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
    throw new Error("No clear wall detected — drag the corners manually.");
  }
  const padX = Math.max(1, Math.round((maxX - minX) * 0.01));
  const padY = Math.max(1, Math.round((maxY - minY) * 0.01));
  minX = Math.min(pw - 1, minX + padX);
  maxX = Math.max(0, maxX - padX);
  minY = Math.min(ph - 1, minY + padY);
  maxY = Math.max(0, maxY - padY);
  return [
    [minX / pw, minY / ph],
    [maxX / pw, minY / ph],
    [maxX / pw, maxY / ph],
    [minX / pw, maxY / ph],
  ];
}

/** Build wall mask + quad from per-pixel ADE20K class labels. */
export function labelsToWallMask(labels: ArrayLike<number>, mw: number, mh: number): SegmentationMaskResult {
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
