import { textureRepeatForSize } from "./physicalScale";

export type AmbientSample = {
  intensity: number;
  color: string;
};

function ambientTint(color: string, intensity: number): string {
  const hex = color.replace("#", "");
  if (hex.length < 6) return `rgba(255,255,255,${Math.min(1, 0.7 + intensity * 0.3)})`;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const mix = Math.min(1, 0.35 + intensity * 0.65);
  const nr = Math.round(255 * (1 - mix) + r * mix);
  const ng = Math.round(255 * (1 - mix) + g * mix);
  const nb = Math.round(255 * (1 - mix) + b * mix);
  return `rgb(${nr},${ng},${nb})`;
}

export function wallpaperUvCoords(uRepeat: number, vRepeat: number): [number, number, number, number][] {
  return [
    [0, 0, uRepeat, vRepeat],
    [0, 0, uRepeat, vRepeat],
    [0, 0, uRepeat, vRepeat],
    [0, 0, uRepeat, vRepeat],
  ];
}

export function buildWallpaperMaterial(opts: {
  textureUrl: string;
  opacity: number;
  physicalRepeatCm: [number, number];
  tileable?: boolean;
  patchSizeM: [number, number];
  ambient?: AmbientSample | null;
  useLighting?: boolean;
  selected?: boolean;
}): { material: Record<string, unknown>; uvRepeat: [number, number] } {
  const [u, v] = textureRepeatForSize(
    opts.patchSizeM,
    opts.physicalRepeatCm,
    opts.tileable ?? true,
  );
  const lit = opts.useLighting !== false && opts.ambient ? opts.ambient.intensity : 1;
  const diffuseIntensity = Math.min(1.25, (0.5 + lit * 0.5) * opts.opacity);

  return {
    uvRepeat: [u, v],
    material: {
      diffuseTexture: { uri: opts.textureUrl },
      lightingModel: opts.useLighting === false ? "Constant" : "PBR",
      wrapS: "Repeat" as const,
      wrapT: "Repeat" as const,
      mipFilter: "Linear" as const,
      minificationFilter: "Linear" as const,
      magnificationFilter: "Linear" as const,
      metalness: 0.03,
      roughness: 0.9,
      diffuseIntensity,
      diffuseColor: opts.ambient ? ambientTint(opts.ambient.color, lit) : "#ffffff",
      readsFromDepthBuffer: true,
      writesToDepthBuffer: true,
      blendMode: "Alpha" as const,
    },
  };
}

export function materialKeyForPlacement(id: string) {
  return `wp_${id}`;
}
