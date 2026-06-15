/**
 * Homography utilities for perspective-correct photo wallpaper warp.
 * Ported from web `src/lib/homography.ts`.
 */

export type Mat3 = number[];

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) {
      throw new Error("Homography is degenerate (collinear points?)");
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const pv = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pv;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

export function computeHomography(
  src: [number, number][],
  dst: [number, number][],
): Mat3 {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error("computeHomography needs exactly 4 source and 4 destination points");
  }
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinearSystem(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyHomography(H: Mat3, x: number, y: number): [number, number] {
  const X = H[0] * x + H[1] * y + H[2];
  const Y = H[3] * x + H[4] * y + H[5];
  const W = H[6] * x + H[7] * y + H[8];
  return [X / W, Y / W];
}

/** Default wall quad in normalised image space [TL, TR, BR, BL]. */
export function defaultQuad(): [number, number][] {
  return [
    [0.2, 0.18],
    [0.8, 0.18],
    [0.8, 0.82],
    [0.2, 0.82],
  ];
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function quadPixelSize(
  quad: [number, number][],
  layoutW: number,
  layoutH: number,
): { widthPx: number; heightPx: number } {
  const px = quad.map(([x, y]) => [x * layoutW, y * layoutH] as [number, number]);
  return {
    widthPx: (dist(px[0], px[1]) + dist(px[3], px[2])) / 2,
    heightPx: (dist(px[0], px[3]) + dist(px[1], px[2])) / 2,
  };
}
