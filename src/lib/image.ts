/** Load a File/Blob into an ImageBitmap with EXIF orientation already applied. */
export async function loadOrientedBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback for engines without imageOrientation support.
    return await createImageBitmap(file);
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
