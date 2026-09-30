// Placement of the three islands in the opening and closing views, as a
// percentage of the scene's art box. The opening Work island is the camera's
// first target: the transport zooms into exactly this spot, so it must match
// the rendered layout in IslandOverview.
export type OverviewPlacement = { id: "work" | "writing" | "projects"; x: number; y: number; size: number };

export const introPlacements: OverviewPlacement[] = [
  { id: "writing", x: 75, y: 19, size: 30 },
  { id: "projects", x: 77, y: 79, size: 31 },
  { id: "work", x: 40, y: 50, size: 64 },
];

export const outroPlacements: OverviewPlacement[] = [
  { id: "writing", x: 66, y: 27, size: 32 },
  { id: "projects", x: 72, y: 72, size: 34 },
  { id: "work", x: 34, y: 50, size: 44 },
];

export const introFocus = introPlacements.find((placement) => placement.id === "work")!;
