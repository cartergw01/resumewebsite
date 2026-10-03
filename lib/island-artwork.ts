import renders from "./blender-islands.json";

export const islandArtwork = {
  work: { ...renders.work, title: "Work", prompt: "learn about my work" },
  writing: { ...renders.writing, title: "Writing", prompt: "read my writing" },
  projects: { ...renders.projects, title: "Projects", prompt: "see what I’ve built" },
} as const;

export type IslandArtworks = typeof islandArtwork;
export type IslandLandmark = { x: number; y: number; name: string };

export const islandLandmarks = {
  Work: { x: renders.work.landmark[0] / 1200, y: renders.work.landmark[1] / 800, name: "Taipei tower" },
  Writing: { x: renders.writing.landmark[0] / 1200, y: renders.writing.landmark[1] / 800, name: "open book" },
  Projects: { x: renders.projects.landmark[0] / 1200, y: renders.projects.landmark[1] / 800, name: "workshop screen" },
};
