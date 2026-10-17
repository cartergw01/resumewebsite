import renders from "./blender-islands.json";

export const islandArtwork = {
  work: { ...renders.work, title: "Work", prompt: "click to learn about my work" },
  writing: { ...renders.writing, title: "Writing", prompt: "click to read my writing" },
  projects: { ...renders.projects, title: "Projects", prompt: "click to see what i’ve built" },
} as const;

export type IslandArtworks = typeof islandArtwork;
export type IslandLandmark = { x: number; y: number; name: string };

// Four floors of Taipei 101 around the landmark, top first: the centre of
// each module's front glass (between its eave and the one below) and its
// height, on the 1200x800 render. The Work entry spells "Work" down them, as
// the real tower spells its messages in light.
export const towerFloors = (() => {
  const eaves = renders.work.life.fireworks.tiers;
  const mid = ([[leftX, leftY], [rightX, rightY]]: number[][]) => [(leftX + rightX) / 2, (leftY + rightY) / 2];
  return [7, 6, 5, 4].map(top => {
    const [x, y] = mid(eaves[top]), [, below] = mid(eaves[top - 1]);
    return { x, y: (y + below) / 2, height: below - y };
  });
})();

export const islandLandmarks = {
  Work: { x: renders.work.landmark[0] / 1200, y: renders.work.landmark[1] / 800, name: "Taipei tower" },
  Writing: { x: renders.writing.landmark[0] / 1200, y: renders.writing.landmark[1] / 800, name: "open book" },
  Projects: { x: renders.projects.landmark[0] / 1200, y: renders.projects.landmark[1] / 800, name: "workshop screen" },
};
