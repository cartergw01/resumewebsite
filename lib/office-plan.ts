/**
 * An imagined office, as a tile map. All numbers are the art's own pixels, drawn
 * by scripts/office/draw_office.mjs: move furniture there and bounds here together.
 */
export const officeView = { width: 340, height: 272 } as const;
/** The row of the corridor the man walks along, measured at his feet. */
export const officeHall = 140;
export type Point = readonly [number, number];
export type OfficeFacing = "down" | "left" | "right" | "up";
type Stop = {
  id: string; label: string;
  /** The room as drawn, wall included. */
  box: readonly [number, number, number, number];
  /** The column of the room's door, and where the man stands, at his feet. */
  door: number; point: Point; facing: OfficeFacing;
};

export const officeStops = [
  { id: "now", label: "Venture Associate", box: [4, 4, 80, 112], door: 44, point: [44, 80], facing: "up" },
  { id: "accelerator", label: "Accelerator", box: [88, 4, 96, 112], door: 136, point: [136, 62], facing: "down" },
  { id: "founders", label: "Finding founders", box: [188, 4, 80, 112], door: 228, point: [206, 88], facing: "up" },
  { id: "community", label: "Community", box: [272, 4, 64, 112], door: 304, point: [304, 96], facing: "up" },
  { id: "research", label: "Contrary", box: [4, 152, 80, 112], door: 44, point: [44, 216], facing: "left" },
  { id: "slug", label: "Slug Fund Investment Group", box: [88, 152, 112, 112], door: 144, point: [144, 216], facing: "right" },
  { id: "side", label: "Side work", box: [204, 152, 64, 112], door: 252, point: [252, 204], facing: "left" },
  { id: "about", label: "About me", box: [272, 152, 64, 112], door: 304, point: [304, 206], facing: "left" },
] as const satisfies readonly Stop[];

export type OfficeStopId = (typeof officeStops)[number]["id"];
export type OfficeStop = (typeof officeStops)[number];

/** Out of the room by its door, along the corridor, and in by the next door. */
export function officeRoute(from: OfficeStop, to: OfficeStop): Point[] {
  const points: Point[] = [from.point, [from.door, from.point[1]], [from.door, officeHall], [to.door, officeHall], [to.door, to.point[1]], to.point];
  return points.filter((point, index) => !index || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
}
