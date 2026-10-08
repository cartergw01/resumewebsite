"use client";

import { useId, type ReactNode } from "react";
import { artworkProjection } from "@/lib/artwork-perspective";

// SVG has no portable projective transform. Small clipped triangles follow the
// four-corner camera projection in Chromium and WebKit, without a canvas texture
// or another image download. The original content remains a single SVG symbol.
export default function PerspectiveArtwork({ corners, width, height, children }: {
  corners: number[][]; width: number; height: number; children: ReactNode;
}) {
  const id = useId().replaceAll(":", "");
  const [a, b, c, d, e, f, g, h] = artworkProjection(corners);
  const project = ([x, y]: number[]) => {
    const u = x / width, v = y / height, z = g * u + h * v + 1;
    return [(a * u + b * v + c) / z, (d * u + e * v + f) / z];
  };
  const triangles: { points: string; matrix: string }[] = [];
  const divisions = 4;
  for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions; col++) {
    const x = col * width / divisions, y = row * height / divisions;
    const right = x + width / divisions, bottom = y + height / divisions;
    for (const source of [[[x, y], [right, y], [x, bottom]], [[right, bottom], [x, bottom], [right, y]]]) {
      const [p, q, r] = source.map(project);
      const [s, t, u] = source;
      const sx = t[0] - s[0], sy = t[1] - s[1], tx = u[0] - s[0], ty = u[1] - s[1];
      const det = sx * ty - tx * sy;
      const ax = ((q[0] - p[0]) * ty - (r[0] - p[0]) * sy) / det;
      const bx = ((r[0] - p[0]) * sx - (q[0] - p[0]) * tx) / det;
      const ay = ((q[1] - p[1]) * ty - (r[1] - p[1]) * sy) / det;
      const by = ((r[1] - p[1]) * sx - (q[1] - p[1]) * tx) / det;
      triangles.push({ points: [p, q, r].map(point => point.join(",")).join(" "),
        matrix: `matrix(${ax} ${ay} ${bx} ${by} ${p[0] - ax * s[0] - bx * s[1]} ${p[1] - ay * s[0] - by * s[1]})` });
    }
  }
  return <>
    <defs>
      <g id={`${id}-content`}>{children}</g>
      {triangles.map(({ points }, i) => <clipPath id={`${id}-${i}`} key={i}><polygon points={points} /></clipPath>)}
    </defs>
    {triangles.map(({ matrix }, i) => <g key={i} clipPath={`url(#${id}-${i})`}><use href={`#${id}-content`} transform={matrix} /></g>)}
  </>;
}
