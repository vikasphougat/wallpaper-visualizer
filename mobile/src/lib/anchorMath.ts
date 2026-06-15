/** Euler XYZ degrees → 4×4 column-major transform (same order as Viro ARKit). */
export function poseToMatrix4(
  position: [number, number, number],
  rotationDeg: [number, number, number],
): number[] {
  const toRad = Math.PI / 180;
  const [rx, ry, rz] = rotationDeg.map((d) => d * toRad) as [number, number, number];
  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);

  // R = Rx · Ry · Rz (Viro convention)
  const m00 = cy * cz;
  const m01 = sx * sy * cz + cx * sz;
  const m02 = -cx * sy * cz + sx * sz;
  const m10 = -cy * sz;
  const m11 = -sx * sy * sz + cx * cz;
  const m12 = cx * sy * sz + sx * cz;
  const m20 = sy;
  const m21 = -sx * cy;
  const m22 = cx * cy;

  const [tx, ty, tz] = position;
  return [m00, m10, m20, 0, m01, m11, m21, 0, m02, m12, m22, 0, tx, ty, tz, 1];
}

/** Lerp position + slerp-ish rotation for anti-drift display / fallback nodes. */
export function smoothPose(
  prev: { position: [number, number, number]; rotation: [number, number, number] },
  next: { position: [number, number, number]; rotation: [number, number, number] },
  alpha: number,
): { position: [number, number, number]; rotation: [number, number, number] } {
  const t = Math.min(1, Math.max(0, alpha));
  const position: [number, number, number] = [
    prev.position[0] + (next.position[0] - prev.position[0]) * t,
    prev.position[1] + (next.position[1] - prev.position[1]) * t,
    prev.position[2] + (next.position[2] - prev.position[2]) * t,
  ];
  const rotation: [number, number, number] = [
    prev.rotation[0] + (next.rotation[0] - prev.rotation[0]) * t,
    prev.rotation[1] + (next.rotation[1] - prev.rotation[1]) * t,
    prev.rotation[2] + (next.rotation[2] - prev.rotation[2]) * t,
  ];
  return { position, rotation };
}

export function worldToPlaneLocal(
  world: [number, number, number],
  anchorPosition: [number, number, number],
  rotationDeg: [number, number, number],
): [number, number, number] {
  const toRad = Math.PI / 180;
  const c1 = Math.cos(rotationDeg[0] * toRad),
    s1 = Math.sin(rotationDeg[0] * toRad);
  const c2 = Math.cos(rotationDeg[1] * toRad),
    s2 = Math.sin(rotationDeg[1] * toRad);
  const c3 = Math.cos(rotationDeg[2] * toRad),
    s3 = Math.sin(rotationDeg[2] * toRad);

  const dx = world[0] - anchorPosition[0];
  const dy = world[1] - anchorPosition[1];
  const dz = world[2] - anchorPosition[2];

  return [
    c2 * c3 * dx + (s1 * s2 * c3 + c1 * s3) * dy + (-c1 * s2 * c3 + s1 * s3) * dz,
    -c2 * s3 * dx + (-s1 * s2 * s3 + c1 * c3) * dy + (c1 * s2 * s3 + s1 * c3) * dz,
    s2 * dx + -s1 * c2 * dy + c1 * c2 * dz,
  ];
}
