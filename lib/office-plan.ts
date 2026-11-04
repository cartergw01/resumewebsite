/**
 * An imagined office, as a tile map. All numbers are the art's own pixels, drawn
 * by scripts/office/draw_office.mjs: move furniture there and bounds here together.
 */
export const officeView = { width: 340, height: 272 } as const;
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
  { id: "now", label: "886 Studios", box: [4, 4, 80, 112], floor: [4, 36, 80, 80], point: [44, 80], facing: "up" },
  { id: "accelerator", label: "Building ikigai Launchpad", box: [88, 4, 96, 112], floor: [88, 36, 96, 80], point: [136, 64], facing: "down" },
  { id: "founders", label: "Finding founders", box: [188, 4, 80, 112], floor: [188, 36, 80, 80], point: [208, 88], facing: "up" },
  { id: "community", label: "Community & content", box: [272, 4, 64, 112], floor: [272, 36, 64, 80], point: [304, 96], facing: "up" },
  { id: "research", label: "Contrary Research", box: [4, 152, 80, 112], floor: [4, 184, 80, 80], point: [44, 216], facing: "left" },
  { id: "slug", label: "Slug Fund Investment Group", box: [88, 152, 112, 112], floor: [88, 184, 112, 80], point: [144, 216], facing: "right" },
  { id: "side", label: "On the side", box: [204, 152, 64, 112], floor: [204, 184, 64, 80], point: [252, 204], facing: "left" },
  { id: "about", label: "About me", box: [272, 152, 64, 112], floor: [272, 184, 64, 80], point: [304, 208], facing: "left" },
] as const satisfies readonly Stop[];

export type OfficeStopId = (typeof officeStops)[number]["id"];
export type OfficeStop = (typeof officeStops)[number];

/** Things in a room that are also links in its copy. Standing at `reach` offers them. */
type OfficeObject = { id: string; room: OfficeStopId; label: string; href: string; box: Box; reach: Box };
export const officeObjects: readonly OfficeObject[] = [
  { id: "desk", room: "now", label: "886 Studios", href: "https://886studios.com/", box: [28, 37, 40, 33], reach: [28, 70, 40, 16] },
  { id: "pitch", room: "accelerator", label: "ikigai Launchpad", href: "https://886studios.com/programs", box: [100, 6, 72, 26], reach: [120, 39, 30, 24] },
  { id: "pipeline", room: "founders", label: "Our accelerator", href: "https://withikigai.com", box: [192, 7, 72, 25], reach: [188, 80, 80, 12] },
  { id: "residency", room: "community", label: "Launch Station", href: "https://www.886studios.com/launch-station", box: [278, 62, 38, 22], reach: [272, 85, 44, 14] },
  { id: "newsletter", room: "community", label: "Our newsletter", href: "https://886studios.substack.com/", box: [302, 7, 30, 22], reach: [314, 39, 22, 24] },
  { id: "shield", room: "research", label: "Shield AI", href: "https://research.contrary.com/company/shield-ai", box: [5, 153, 30, 36], reach: [4, 189, 31, 10] },
  { id: "spacex", room: "research", label: "SpaceX", href: "https://research.contrary.com/company/spacex", box: [53, 153, 30, 36], reach: [53, 189, 31, 12] },
  { id: "turo", room: "research", label: "Turo", href: "https://research.contrary.com/company/turo", box: [8, 198, 28, 30], reach: [37, 204, 11, 24] },
  { id: "chime", room: "research", label: "Chime", href: "https://research.contrary.com/company/chime/", box: [56, 214, 20, 20], reach: [50, 235, 30, 12] },
  { id: "hive", room: "research", label: "Hive", href: "https://research.contrary.com/company/hive", box: [8, 232, 24, 14], reach: [4, 247, 34, 17] },
  { id: "code", room: "side", label: "See my coding projects", href: "/projects", box: [208, 179, 34, 33], reach: [243, 186, 15, 30] },
  { id: "notebooks", room: "side", label: "Read my writing", href: "/writing", box: [208, 226, 28, 24], reach: [237, 222, 16, 28] },
];

// Where a person can stand: floors, the corridor, and the doorways between them.
export const officeFloors: readonly Box[] = [
  ...officeStops.map(stop => stop.floor),
  [4, 120, 332, 32],
  [36, 116, 16, 4], [128, 116, 16, 4], [220, 116, 16, 4], [296, 116, 16, 4],
  [36, 152, 16, 32], [136, 152, 16, 32], [244, 152, 16, 32], [296, 152, 16, 32],
];
// The furniture's footprints, as drawn.
export const officeFurniture: readonly Box[] = [
  [8, 34, 16, 32], [28, 48, 40, 22], [68, 44, 12, 10], [112, 40, 14, 18], [169, 46, 12, 10],
  [93, 62, 26, 14], [149, 62, 26, 14], [93, 82, 26, 14], [149, 82, 26, 14],
  [192, 46, 30, 22], [234, 46, 30, 22], [200, 66, 12, 14], [243, 66, 12, 14],
  [274, 38, 38, 22], [278, 62, 38, 22], [320, 40, 12, 10],
  [10, 130, 12, 10], [318, 130, 12, 10],
  [5, 153, 30, 36], [53, 153, 30, 36], [8, 204, 28, 24], [56, 214, 20, 20], [8, 232, 24, 12],
  [92, 196, 42, 22], [158, 196, 42, 22], [92, 222, 42, 22], [158, 222, 42, 22],
  [208, 190, 34, 22], [219, 208, 12, 14], [208, 226, 28, 24], [252, 240, 12, 10],
  [276, 186, 18, 16], [314, 186, 20, 24], [290, 228, 26, 20], [322, 234, 12, 16],
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
