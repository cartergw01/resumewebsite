/** An imagined office. The four 886 stations share one open studio. */
export const officeSize = { width: 720, height: 600 } as const;
/** The drawing the plan is projected into: a cutaway seen from the south-east. */
export const officeView = { width: 1040, height: 830 } as const;
export type Point = readonly [number, number];
type Stop = {
  id: string; label: string; box: readonly [number, number, number, number];
  point: Point; via: readonly Point[]; hall: Point; away: boolean;
  tag: Point; light: Point; reach: number;
};

export const officeStops = [
  { id: "now", label: "Venture Associate", box: [40, 40, 190, 180], point: [114, 120], via: [], hall: [230, 120], away: true, tag: [136, 156], light: [120, 104], reach: 118 },
  { id: "accelerator", label: "Accelerator", box: [246, 40, 162, 180], point: [329, 155], via: [[329, 176]], hall: [230, 176], away: true, tag: [336, 196], light: [326, 112], reach: 116 },
  { id: "founders", label: "Finding founders", box: [246, 224, 162, 128], point: [304, 250], via: [[304, 274]], hall: [230, 274], away: true, tag: [326, 330], light: [336, 258], reach: 96 },
  { id: "community", label: "Community", box: [40, 224, 190, 128], point: [112, 262], via: [[112, 294]], hall: [230, 294], away: false, tag: [118, 322], light: [120, 272], reach: 104 },
  { id: "research", label: "Contrary", box: [478, 86, 204, 164], point: [552, 164], via: [], hall: [440, 164], away: true, tag: [590, 214], light: [572, 136], reach: 124 },
  { id: "slug", label: "Slug Fund Investment Group", box: [478, 278, 204, 236], point: [552, 380], via: [[552, 396], [480, 396], [480, 346]], hall: [440, 346], away: true, tag: [600, 462], light: [580, 340], reach: 138 },
  { id: "side", label: "Side work", box: [80, 414, 156, 146], point: [148, 468], via: [[224, 468]], hall: [224, 376], away: true, tag: [160, 530], light: [136, 462], reach: 104 },
  { id: "about", label: "About me", box: [260, 414, 148, 146], point: [328, 468], via: [[328, 420]], hall: [328, 376], away: false, tag: [336, 534], light: [336, 474], reach: 100 },
] as const satisfies readonly Stop[];

export type OfficeStopId = (typeof officeStops)[number]["id"];
export type OfficeStop = (typeof officeStops)[number];

/** Plan coordinates and a height to their place in the drawing. */
export function officeProject([x, y]: Point, z = 0): Point {
  return [Math.round((470 + (x - y) * .866) * 10) / 10, Math.round((96 + (x + y) * .5 - z) * 10) / 10];
}

/** A station's floor in the drawing, as a box and the polygon inside it. */
export function officeHitArea({ box: [x, y, width, height] }: OfficeStop) {
  const corners: Point[] = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]].map(point => officeProject(point as unknown as Point));
  const xs = corners.map(point => point[0]), ys = corners.map(point => point[1]);
  const left = Math.min(...xs), top = Math.min(...ys);
  const boxWidth = Math.max(...xs) - left, boxHeight = Math.max(...ys) - top;
  return {
    left, top, width: boxWidth, height: boxHeight,
    polygon: corners.map(point => `${(point[0] - left) / boxWidth * 100}% ${(point[1] - top) / boxHeight * 100}%`).join(", "),
  };
}

/** Leave the seat, use the studio aisle or corridor, then approach the next seat. */
export function officeRoute(from: OfficeStop, to: OfficeStop): Point[] {
  const points: Point[] = [from.point, ...from.via, from.hall];
  if (from.hall[0] !== to.hall[0]) points.push([from.hall[0], 376], [to.hall[0], 376]);
  points.push(to.hall, ...[...to.via].reverse(), to.point);
  return points.filter((point, index) => !index || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
}
