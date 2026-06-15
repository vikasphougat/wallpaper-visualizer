import { Skia, AlphaType, ColorType, type SkImage } from "@shopify/react-native-skia";
import { upscaleMaskToPhoto } from "@/features/ml/maskPostProcess";

/** Build a grayscale Skia image (white = wall, black = occluder) for masking. */
export function maskToSkiaImage(
  mask: Uint8Array,
  maskW: number,
  maskH: number,
  photoW: number,
  photoH: number,
): SkImage | null {
  const full = upscaleMaskToPhoto(mask, maskW, maskH, photoW, photoH);
  const rgba = new Uint8Array(photoW * photoH * 4);
  for (let i = 0; i < full.length; i++) {
    const v = full[i];
    const j = i * 4;
    rgba[j] = v;
    rgba[j + 1] = v;
    rgba[j + 2] = v;
    rgba[j + 3] = 255;
  }
  const data = Skia.Data.fromBytes(rgba);
  return Skia.Image.MakeImage(
    {
      width: photoW,
      height: photoH,
      alphaType: AlphaType.Opaque,
      colorType: ColorType.RGBA_8888,
    },
    data,
    photoW * 4,
  );
}
