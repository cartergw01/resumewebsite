import renders from "./blender-islands.json";

export const islandArtwork = {
  work: { ...renders.work, title: "Work", prompt: "learn about my work" },
  writing: { ...renders.writing, title: "Writing", prompt: "read my writing" },
  projects: { ...renders.projects, title: "Projects", prompt: "see what I’ve built" },
} as const;

// Blender uses an orthographic camera, so three projected corners describe
// the exact affine plane of the physical screen or open notebook.
export function artworkPlane(corners: number[][], width: number, height: number) {
  const [origin, right, bottom] = corners;
  return `matrix(${(right[0] - origin[0]) / width} ${(right[1] - origin[1]) / width} ${(bottom[0] - origin[0]) / height} ${(bottom[1] - origin[1]) / height} ${origin[0]} ${origin[1]})`;
}

export function artworkOutline(corners: number[][]) {
  const [a, b, d] = corners;
  const c = [b[0] + d[0] - a[0], b[1] + d[1] - a[1]];
  return `M${a.join(" ")}L${b.join(" ")}L${c.join(" ")}L${d.join(" ")}Z`;
}

export const islandLandmarks = {
  Work: { x: renders.work.landmark[0] / 1200, y: renders.work.landmark[1] / 800, name: "Taipei tower" },
  Writing: { x: renders.writing.landmark[0] / 1200, y: renders.writing.landmark[1] / 800, name: "open book" },
  Projects: { x: renders.projects.landmark[0] / 1200, y: renders.projects.landmark[1] / 800, name: "workshop laptop" },
};
