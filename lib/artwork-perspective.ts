// Project a unit square onto the four corners exported by Blender's perspective
// camera. Order: top left, top right, bottom left, bottom right.
export function artworkProjection(corners: number[][]) {
  const [a, b, d] = corners;
  const c = corners[3] ?? [b[0] + d[0] - a[0], b[1] + d[1] - a[1]];
  const dx1 = b[0] - c[0], dx2 = d[0] - c[0];
  const dy1 = b[1] - c[1], dy2 = d[1] - c[1];
  const dx3 = a[0] - b[0] + c[0] - d[0];
  const dy3 = a[1] - b[1] + c[1] - d[1];
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  return [b[0] - a[0] + g * b[0], d[0] - a[0] + h * d[0], a[0],
    b[1] - a[1] + g * b[1], d[1] - a[1] + h * d[1], a[1], g, h];
}

export function artworkTransform(corners: number[][], width: number, height: number) {
  const [a, b, c, d, e, f, g, h] = artworkProjection(corners);
  return `matrix3d(${a / width},${d / width},0,${g / width},${b / height},${e / height},0,${h / height},0,0,1,0,${c},${f},0,1)`;
}

export function artworkOutline(corners: number[][]) {
  const [a, b, d] = corners;
  const c = corners[3] ?? [b[0] + d[0] - a[0], b[1] + d[1] - a[1]];
  return `M${a.join(" ")}L${b.join(" ")}L${c.join(" ")}L${d.join(" ")}Z`;
}
