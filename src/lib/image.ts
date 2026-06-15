const MAX_PHOTO_PX = 2560;

/** Load a File/Blob into an ImageBitmap with EXIF orientation already applied. */
export async function loadOrientedBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback for engines without imageOrientation support.
    return await createImageBitmap(file);
  }
}

function downscaleBitmap(source: ImageBitmap | CanvasImageSource, maxPx: number): Promise<ImageBitmap> {
  const w = "width" in source ? source.width : (source as HTMLImageElement).naturalWidth;
  const h = "height" in source ? source.height : (source as HTMLImageElement).naturalHeight;
  if (Math.max(w, h) <= maxPx) {
    if (source instanceof ImageBitmap) return Promise.resolve(source);
    return createImageBitmap(source);
  }
  const scale = maxPx / Math.max(w, h);
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, cw, ch);
  if (source instanceof ImageBitmap) source.close();
  return createImageBitmap(canvas);
}

/**
 * Load a camera/gallery pick on mobile: validates size, applies EXIF rotation,
 * downscales huge shots, and falls back to canvas decode when createImageBitmap fails.
 */
export async function preparePhotoBitmap(file: File): Promise<ImageBitmap> {
  if (!file.size) {
    throw new Error("No image received — tap OK after taking the photo, or pick from gallery.");
  }
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error("That file is not a supported image.");
  }

  try {
    const bmp = await loadOrientedBitmap(file);
    return downscaleBitmap(bmp, MAX_PHOTO_PX);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      return downscaleBitmap(img, MAX_PHOTO_PX);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Load any URL (incl. data URIs, e.g. SVG patterns) into an HTMLImageElement. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 64)}…`));
    img.src = src;
  });
}

/**
 * Estimate the mean luminance (0..1) of a bitmap by sampling a downscaled copy.
 * Used to normalise the multiply-blend so the wallpaper keeps the wall's shading
 * without globally darkening or brightening.
 */
export function meanLuminance(bitmap: ImageBitmap): number {
  const w = 64;
  const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  return sum / (data.length / 4);
}
