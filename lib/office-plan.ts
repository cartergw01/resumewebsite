/**
 * An imagined office, as a tile map. All numbers are the art's own pixels, drawn
 * by scripts/office/draw_office.mjs: move furniture there and bounds here together.
 */
export const officeView = { width: 372, height: 272 } as const;
export type Point = readonly [number, number];
type Box = readonly [number, number, number, number];
export type OfficeFacing = "down" | "left" | "right" | "up";
type Stop = {
  id: string;
  /** The room's name, exactly as the copy has it. */
  label: string;
  /** The room as drawn, wall included. */
  box: Box;
  /** The floor the man has to be standing on to be in the room. */
  floor: Box;
  /** Where a click sends him, at his feet, and which way he then faces. */
  point: Point; facing: OfficeFacing;
};

export const officeStops = [
  { id: "now", label: "886 Studios", box: [4, 4, 84, 112], floor: [4, 36, 84, 80], point: [44, 80], facing: "up" },
  { id: "accelerator", label: "Building ikigai Launchpad", box: [92, 4, 100, 112], floor: [92, 36, 100, 80], point: [140, 64], facing: "down" },
  { id: "founders", label: "Finding founders", box: [196, 4, 84, 112], floor: [196, 36, 84, 80], point: [216, 88], facing: "up" },
  { id: "community", label: "Community & content", box: [284, 4, 84, 112], floor: [284, 36, 84, 80], point: [332, 96], facing: "left" },
  { id: "research", label: "Contrary Research", box: [4, 152, 112, 112], floor: [4, 184, 112, 80], point: [56, 216], facing: "left" },
  { id: "slug", label: "Slug Fund Investment Group", box: [120, 152, 96, 112], floor: [120, 184, 96, 80], point: [172, 216], facing: "left" },
  { id: "side", label: "Korobra Capital & side projects", box: [220, 152, 88, 112], floor: [220, 184, 88, 80], point: [264, 204], facing: "left" },
  { id: "about", label: "About me", box: [312, 152, 56, 112], floor: [312, 184, 56, 80], point: [340, 208], facing: "left" },
] as const satisfies readonly Stop[];

export type OfficeStopId = (typeof officeStops)[number]["id"];
export type OfficeStop = (typeof officeStops)[number];

/** Things in a room that are also links in its copy, and people to talk to. Standing at `reach` offers them. */
export const OFFICE_PORTFOLIO = "https://www.886studios.com/portfolio";
type OfficeObject = { id: string; room: OfficeStopId; label: string; href: string; box: Box; reach: Box; person?: boolean };
export const officeObjects: readonly OfficeObject[] = [
  { id: "desk", room: "now", label: "886 Studios", href: "https://886studios.com/", box: [30, 37, 40, 33], reach: [30, 70, 40, 16] },
  { id: "pitch", room: "accelerator", label: "ikigai Launchpad", href: "https://886studios.com/programs", box: [106, 6, 72, 26], reach: [130, 39, 24, 24] },
  { id: "pipeline", room: "founders", label: "Our accelerator", href: "https://withikigai.com", box: [200, 7, 76, 25], reach: [196, 80, 84, 12] },
  { id: "kai", room: "community", label: "Kai, Guitar Hero", href: OFFICE_PORTFOLIO, box: [288, 62, 16, 22], reach: [284, 85, 22, 12], person: true },
  { id: "kevin", room: "community", label: "Kevin, Twitch", href: OFFICE_PORTFOLIO, box: [308, 62, 16, 22], reach: [306, 85, 30, 16], person: true },
  { id: "founder-sofa", room: "community", label: "One of our founders", href: OFFICE_PORTFOLIO, box: [336, 50, 16, 22], reach: [330, 73, 18, 10], person: true },
  { id: "founder-side", room: "community", label: "One of our founders", href: OFFICE_PORTFOLIO, box: [352, 58, 16, 22], reach: [349, 81, 19, 14], person: true },
  { id: "founder-near", room: "community", label: "One of our founders", href: OFFICE_PORTFOLIO, box: [338, 70, 16, 22], reach: [330, 93, 26, 12], person: true },
  { id: "residency", room: "community", label: "Launch Station", href: "https://www.886studios.com/launch-station", box: [336, 40, 30, 20], reach: [349, 61, 19, 12] },
  { id: "newsletter", room: "community", label: "Our newsletter", href: "https://886studios.substack.com/", box: [324, 7, 32, 22], reach: [325, 39, 10, 24] },
  { id: "shield", room: "research", label: "Shield AI", href: "https://research.contrary.com/company/shield-ai", box: [5, 162, 45, 27], reach: [4, 189, 47, 12] },
  { id: "spacex", room: "research", label: "SpaceX", href: "https://research.contrary.com/company/spacex", box: [74, 162, 41, 27], reach: [73, 189, 43, 12] },
  { id: "turo", room: "research", label: "Turo", href: "https://research.contrary.com/company/turo", box: [12, 198, 32, 30], reach: [45, 204, 18, 24] },
  { id: "chime", room: "research", label: "Chime", href: "https://research.contrary.com/company/chime/", box: [83, 208, 24, 20], reach: [76, 229, 38, 15] },
  { id: "hive", room: "research", label: "Hive", href: "https://research.contrary.com/company/hive", box: [10, 232, 30, 14], reach: [4, 246, 44, 18] },
  { id: "code", room: "side", label: "See my coding projects", href: "/projects", box: [228, 179, 26, 33], reach: [255, 186, 20, 30] },
  { id: "notebooks", room: "side", label: "Read my writing", href: "/writing", box: [228, 224, 26, 20], reach: [255, 222, 20, 22] },
];

// Where a person can stand: floors, the corridor, and the doorways between them.
export const officeFloors: readonly Box[] = [
  ...officeStops.map(stop => stop.floor),
  [4, 120, 364, 32],
  [36, 116, 16, 4], [132, 116, 16, 4], [228, 116, 16, 4], [316, 116, 16, 4],
  [52, 152, 16, 32], [164, 152, 16, 32], [252, 152, 16, 32], [332, 152, 16, 32],
];
// The furniture's footprints and the people's feet, as drawn.
export const officeFurniture: readonly Box[] = [
  [8, 34, 16, 32], [30, 48, 40, 22], [72, 44, 12, 10], [116, 40, 14, 18], [174, 46, 12, 10],
  [97, 62, 26, 14], [157, 62, 26, 14], [97, 82, 26, 14], [157, 82, 26, 14],
  [200, 46, 30, 22], [246, 46, 30, 22], [209, 66, 12, 14], [255, 66, 12, 14],
  [286, 38, 38, 22], [336, 40, 30, 20],
  [290, 80, 12, 5], [310, 80, 12, 5], [338, 68, 12, 5], [354, 76, 12, 5], [340, 88, 12, 5],
  [10, 130, 12, 10], [350, 130, 12, 10],
  [5, 153, 45, 36], [70, 153, 45, 36], [12, 204, 32, 24], [83, 208, 24, 20], [10, 234, 30, 10],
  [126, 196, 32, 22], [182, 196, 32, 22], [134, 224, 68, 18],
  [228, 190, 26, 22], [235, 208, 12, 14], [228, 224, 26, 20], [282, 192, 20, 20], [286, 226, 12, 10],
  [314, 186, 16, 16], [350, 186, 16, 24], [324, 224, 24, 20], [352, 232, 12, 14],
];

const within = (x: number, y: number, [left, top, width, height]: Box) => x >= left && x <= left + width && y >= top && y <= top + height;

/** Can he stand with his feet here? His feet take up a small patch of floor. */
export function officeCanStand(x: number, y: number) {
  const corners = [[x - 5, y - 3], [x + 5, y - 3], [x - 5, y], [x + 5, y], [x, y - 3], [x, y]];
  return corners.every(([a, b]) => officeFloors.some(box => within(a, b, box)) && !officeFurniture.some(box => within(a, b, box)));
}

export const officeRoomAt = (x: number, y: number) => officeStops.find(stop => within(x, y, stop.floor))?.id ?? null;
export const officeObjectAt = (x: number, y: number) => officeObjects.find(item => within(x, y, item.reach)) ?? null;

const CELL = 4, TURN = 6;
const COLUMNS = Math.floor(officeView.width / CELL) + 1, ROWS = Math.floor(officeView.height / CELL) + 1;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
let walkable: boolean[] | undefined;

function nearestCell(x: number, y: number) {
  const free = walkable!;
  const column = Math.round(x / CELL), row = Math.round(y / CELL);
  for (let ring = 0; ring < 12; ring++) {
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (free[(row + dy) * COLUMNS + column + dx]) return [column + dx, row + dy] as const;
    }
  }
  return [column, row] as const;
}

/** The way from one spot to another: only straight runs, and as few turns as it can. */
export function officeRoute(from: Point, to: Point): Point[] {
  walkable ??= Array.from({ length: COLUMNS * ROWS }, (_, at) => officeCanStand((at % COLUMNS) * CELL, Math.floor(at / COLUMNS) * CELL));
  const free = walkable;
  const [startColumn, startRow] = nearestCell(from[0], from[1]);
  const [endColumn, endRow] = nearestCell(to[0], to[1]);
  const state = (column: number, row: number, direction: number) => (row * COLUMNS + column) * 4 + direction;
  const costs = new Map<number, number>(), parents = new Map<number, number>();
  const buckets: number[][] = [];
  STEPS.forEach((_, direction) => { const key = state(startColumn, startRow, direction); costs.set(key, 0); (buckets[0] ??= []).push(key); });
  let found = -1;
  for (let cost = 0; cost < buckets.length && found < 0; cost++) {
    for (const key of buckets[cost] ?? []) {
      if (costs.get(key) !== cost) continue;
      const direction = key % 4, cell = Math.floor(key / 4), column = cell % COLUMNS, row = Math.floor(cell / COLUMNS);
      if (column === endColumn && row === endRow) { found = key; break; }
      STEPS.forEach(([dx, dy], turn) => {
        const nextColumn = column + dx, nextRow = row + dy;
        if (nextColumn < 0 || nextColumn >= COLUMNS || nextRow < 0 || nextRow >= ROWS || !free[nextRow * COLUMNS + nextColumn]) return;
        const nextKey = state(nextColumn, nextRow, turn), total = cost + 1 + (turn === direction ? 0 : TURN);
        if (total < (costs.get(nextKey) ?? Infinity)) { costs.set(nextKey, total); parents.set(nextKey, key); (buckets[total] ??= []).push(nextKey); }
      });
    }
  }
  const cells: Point[] = [];
  for (let key: number | undefined = found >= 0 ? found : undefined; key !== undefined; key = parents.get(key)) {
    const cell = Math.floor(key / 4);
    cells.unshift([(cell % COLUMNS) * CELL, Math.floor(cell / COLUMNS) * CELL]);
  }
  // He may start between cells: square up along one axis, then the other.
  const first = cells[0] ?? [startColumn * CELL, startRow * CELL];
  const points: Point[] = [from, [first[0], from[1]], ...cells, [to[0], cells.at(-1)?.[1] ?? to[1]], to];
  const distinct = points.filter((point, index) => !index || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
  return distinct.filter((point, index) => {
    const before = distinct[index - 1], after = distinct[index + 1];
    return !before || !after || !((before[0] === point[0] && point[0] === after[0]) || (before[1] === point[1] && point[1] === after[1]));
  });
}
