/**
 * Homography utilities for the 2D overlay.
 *
 * We compute the 3x3 projective transform H that maps a source quadrilateral
 * to a destination quadrilateral, then use it to place a finely-subdivided
 * grid so the GPU renders a perspective-correct, tileable wallpaper.
 */

export type Mat3 = number[]; // length 9, row-major

/** Solve a linear system A x = b (n x n) via Gaussian elimination with partial pivoting. */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Augment
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) {
      throw new Error("Homography is degenerate (collinear points?)");
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    // Normalise pivot row
    const pv = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pv;

    // Eliminate other rows
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Compute the homography mapping four source points to four destination points.
 * Points are [x, y] pairs. Returns a row-major 3x3 matrix (h22 fixed to 1).
 */
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
  const h = solveLinearSystem(A, b); // 8 unknowns
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Apply a homography to a point, returning the de-homogenised [x, y]. */
export function applyHomography(H: Mat3, x: number, y: number): [number, number] {
  const X = H[0] * x + H[1] * y + H[2];
  const Y = H[3] * x + H[4] * y + H[5];
  const W = H[6] * x + H[7] * y + H[8];
  return [X / W, Y / W];
}

/** A sensible default wall quad (centered rectangle) in normalised image space. */
export function defaultQuad(): [number, number][] {
  return [
    [0.2, 0.18],
    [0.8, 0.18],
    [0.8, 0.82],
    [0.2, 0.82],
  ];
}
