import { computeHomography, applyHomography, quadPixelSize } from "@/lib/homography";
import { textureRepeatForSize } from "@/lib/physicalScale";
import { PERF } from "@/lib/perfConfig";

export type WallpaperMesh = {
  vertices: { x: number; y: number }[];
  textures: { x: number; y: number }[];
  indices: number[];
};

function buildGridIndices(grid: number): number[] {
  const idx: number[] = [];
  const stride = grid + 1;
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  return idx;
}

function tileRepeat(
  quad: [number, number][],
  layoutW: number,
  layoutH: number,
  scale: number,
  physicalRepeatCm: [number, number],
  tileable: boolean,
): [number, number] {
  const { widthPx, heightPx } = quadPixelSize(quad, layoutW, layoutH);
  const baseX = 8 / Math.max(0.2, scale);
  const baseY = baseX * (heightPx / Math.max(1, widthPx));
  if (!tileable) return [1, 1];
  const estW = widthPx / 80;
  const estH = heightPx / 80;
  const [uRep, vRep] = textureRepeatForSize([estW, estH], physicalRepeatCm, true);
  return [baseX * uRep, baseY * vRep];
}

/** Perspective-correct subdivided grid for Skia `Vertices` + `ImageShader`. */
export function buildWallpaperMesh(
  quad: [number, number][],
  layoutW: number,
  layoutH: number,
  opts: {
    scale: number;
    rotationDeg: number;
    physicalRepeatCm: [number, number];
    tileable?: boolean;
    grid?: number;
  },
): WallpaperMesh {
  const grid = opts.grid ?? PERF.photoGridDivisions;
  const dst = quad.map(([x, y]) => [x * layoutW, y * layoutH] as [number, number]);
  const H = computeHomography(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    dst,
  );

  const [tilesX, tilesY] = tileRepeat(
    quad,
    layoutW,
    layoutH,
    opts.scale,
    opts.physicalRepeatCm,
    opts.tileable ?? true,
  );

  const rot = (opts.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const vertices: { x: number; y: number }[] = [];
  const textures: { x: number; y: number }[] = [];

  for (let j = 0; j <= grid; j++) {
    for (let i = 0; i <= grid; i++) {
      const s = i / grid;
      const t = j / grid;
      const [px, py] = applyHomography(H, s, t);
      vertices.push({ x: px, y: py });

      const su = s - 0.5;
      const sv = t - 0.5;
      const rs = cos * su - sin * sv + 0.5;
      const rt = sin * su + cos * sv + 0.5;
      textures.push({ x: rs * tilesX, y: rt * tilesY });
    }
  }

  return { vertices, textures, indices: buildGridIndices(grid) };
}
