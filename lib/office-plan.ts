/** An imagined office. The four 886 stations share one open studio. */
export const officeSize = { width: 720, height: 600 } as const;
type Point = readonly [number, number];
type Stop = {
  id: string; label: string; box: readonly [number, number, number, number];
  point: Point; via: readonly Point[]; hall: Point; facing: number;
};

export const officeStops = [
  { id: "now", label: "Venture Associate", box: [40, 72, 174, 148], point: [114, 120], via: [], hall: [230, 120], facing: 0 },
  { id: "accelerator", label: "Accelerator", box: [246, 72, 162, 148], point: [266, 112], via: [], hall: [230, 112], facing: 90 },
  { id: "founders", label: "Finding founders", box: [246, 224, 162, 128], point: [304, 250], via: [[304, 274]], hall: [230, 274], facing: 0 },
  { id: "community", label: "Community", box: [40, 224, 190, 128], point: [112, 262], via: [[112, 294]], hall: [230, 294], facing: 180 },
  { id: "research", label: "Contrary", box: [478, 86, 204, 164], point: [552, 164], via: [], hall: [440, 164], facing: 0 },
  { id: "slug", label: "Slug Fund Investment Group", box: [478, 278, 204, 236], point: [504, 346], via: [], hall: [440, 346], facing: 90 },
  { id: "side", label: "Side work", box: [80, 414, 156, 146], point: [148, 468], via: [[224, 468]], hall: [224, 376], facing: 0 },
  { id: "about", label: "About me", box: [260, 414, 148, 146], point: [328, 468], via: [[328, 420]], hall: [328, 376], facing: 0 },
] as const satisfies readonly Stop[];

export type OfficeStopId = (typeof officeStops)[number]["id"];
export type OfficeStop = (typeof officeStops)[number];

/** Leave the seat, use the studio aisle or corridor, then approach the next seat. */
export function officeRoute(from: OfficeStop, to: OfficeStop): Point[] {
  const points: Point[] = [from.point, ...from.via, from.hall];
  if (from.hall[0] !== to.hall[0]) points.push([from.hall[0], 376], [to.hall[0], 376]);
  points.push(to.hall, ...[...to.via].reverse(), to.point);
  return points.filter((point, index) => !index || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
}
