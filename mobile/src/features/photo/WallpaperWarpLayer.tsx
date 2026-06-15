import { useMemo } from "react";
import {
  Group,
  Vertices,
  ImageShader,
  Mask,
  Image as SkImage,
  Skia,
} from "@shopify/react-native-skia";
import type { SkImage as SkImageType } from "@shopify/react-native-skia";
import { buildWallpaperMesh } from "./wallpaperGrid";

type Props = {
  quad: [number, number][];
  layoutW: number;
  layoutH: number;
  wallTex: SkImageType;
  scale: number;
  rotationDeg: number;
  physicalRepeatCm: [number, number];
  tileable?: boolean;
  opacity: number;
  blend: number;
  maskImage?: SkImageType | null;
  clipRight?: number;
};

/** Perspective-correct wallpaper layer via homography grid warp. */
export function WallpaperWarpLayer({
  quad,
  layoutW,
  layoutH,
  wallTex,
  scale,
  rotationDeg,
  physicalRepeatCm,
  tileable = true,
  opacity,
  blend,
  maskImage,
  clipRight,
}: Props) {
  const mesh = useMemo(
    () =>
      buildWallpaperMesh(quad, layoutW, layoutH, {
        scale,
        rotationDeg,
        physicalRepeatCm,
        tileable,
      }),
    [quad, layoutW, layoutH, scale, rotationDeg, physicalRepeatCm, tileable],
  );

  const layerOpacity = opacity * (0.65 + blend * 0.35);

  const warp = (
    <Group opacity={layerOpacity}>
      <Vertices vertices={mesh.vertices} textures={mesh.textures} indices={mesh.indices} mode="triangles">
        <ImageShader image={wallTex} tx="repeat" ty="repeat" fit="none" />
      </Vertices>
    </Group>
  );

  const clipped =
    clipRight !== undefined ? (
      <Group clip={Skia.Path.Make().addRect(Skia.XYWHRect(0, 0, clipRight, layoutH))}>{warp}</Group>
    ) : (
      warp
    );

  if (maskImage) {
    return (
      <Mask mode="luminance" mask={<SkImage image={maskImage} x={0} y={0} width={layoutW} height={layoutH} fit="fill" />}>
        {clipped}
      </Mask>
    );
  }
  return clipped;
}
