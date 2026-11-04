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
  { id: "accelerator", label: "Building ikigai Launchpad", box: [92, 4, 100, 112], floor: [92, 36, 100, 80], point: [140, 76], facing: "up" },
  { id: "founders", label: "Finding founders", box: [196, 4, 84, 112], floor: [196, 36, 84, 80], point: [216, 92], facing: "up" },
  { id: "community", label: "Community & content", box: [284, 4, 84, 112], floor: [284, 36, 84, 80], point: [328, 96], facing: "left" },
  { id: "research", label: "Contrary Research", box: [4, 152, 112, 112], floor: [4, 184, 112, 80], point: [56, 216], facing: "left" },
  { id: "slug", label: "Slug Fund Investment Group", box: [120, 152, 96, 112], floor: [120, 184, 96, 80], point: [172, 216], facing: "left" },
  { id: "side", label: "Korobra Capital & side projects", box: [220, 152, 88, 112], floor: [220, 184, 88, 80], point: [264, 204], facing: "left" },
  { id: "about", label: "About me", box: [312, 152, 56, 112], floor: [312, 184, 56, 80], point: [340, 208], facing: "left" },
] as const satisfies readonly Stop[];

export type OfficeStopId = (typeof officeStops)[number]["id"];
export type OfficeStop = (typeof officeStops)[number];

/** Things in a room that are also links in its copy, and people to talk to. Standing at `reach` offers them. */
export const OFFICE_PORTFOLIO = "https://www.886studios.com/portfolio";
const TEAM = "https://www.886studios.com/team";
type OfficeObject = { id: string; room: OfficeStopId; label: string; href: string; box: Box; reach: Box; person?: boolean };
export const officeObjects: readonly OfficeObject[] = [
  { id: "desk", room: "now", label: "886 Studios", href: "https://www.886studios.com/", box: [30, 37, 40, 33], reach: [30, 70, 40, 16] },
  { id: "patryk", room: "accelerator", label: "Patryk Chojecki", href: `${TEAM}/patryk`, box: [109, 52, 16, 19], reach: [124, 62, 10, 16], person: true },
  { id: "max", room: "accelerator", label: "Max Hsieh", href: `${TEAM}/max`, box: [155, 52, 16, 19], reach: [148, 62, 10, 16], person: true },
  { id: "jimmy", room: "accelerator", label: "Jimmy Huang, PicPet", href: "https://www.886studios.com/portfolio/o3o-labs", box: [155, 72, 16, 19], reach: [148, 80, 10, 16], person: true },
  { id: "kai", room: "accelerator", label: "Kai Huang, Guitar Hero", href: `${TEAM}/kai`, box: [128, 30, 16, 22], reach: [126, 54, 16, 24], person: true },
  { id: "kevin", room: "accelerator", label: "Kevin Lin, Twitch", href: `${TEAM}/kevin-lin`, box: [144, 30, 16, 22], reach: [142, 54, 16, 24], person: true },
  { id: "pitch", room: "accelerator", label: "ikigai Launchpad", href: "https://886studios.com/programs", box: [106, 6, 72, 26], reach: [160, 39, 12, 22] },
  { id: "founder-chat", room: "founders", label: "Founders", href: OFFICE_PORTFOLIO, box: [263, 52, 16, 21], reach: [246, 80, 34, 16], person: true },
  { id: "founder-1", room: "community", label: "Founders", href: OFFICE_PORTFOLIO, box: [336, 39, 16, 19], reach: [330, 70, 14, 10], person: true },
  { id: "founder-2", room: "community", label: "Founders", href: OFFICE_PORTFOLIO, box: [350, 39, 16, 19], reach: [358, 61, 10, 14], person: true },
  { id: "founder-3", room: "community", label: "Founders", href: OFFICE_PORTFOLIO, box: [288, 52, 16, 22], reach: [286, 75, 20, 12], person: true },
  { id: "founder-4", room: "community", label: "Founders", href: OFFICE_PORTFOLIO, box: [304, 60, 16, 22], reach: [306, 83, 22, 14], person: true },
  { id: "founder-5", room: "community", label: "Founders", href: OFFICE_PORTFOLIO, box: [286, 72, 16, 22], reach: [284, 95, 20, 12], person: true },
  { id: "founder-6", room: "community", label: "Founders", href: OFFICE_PORTFOLIO, box: [332, 62, 16, 22], reach: [332, 85, 16, 12], person: true },
  { id: "founder-7", room: "community", label: "Founders", href: OFFICE_PORTFOLIO, box: [350, 62, 16, 22], reach: [349, 85, 19, 12], person: true },
  { id: "residency", room: "community", label: "Launch Station", href: "https://www.886studios.com/launch-station", box: [286, 31, 38, 29], reach: [325, 52, 10, 12] },
  { id: "newsletter", room: "community", label: "Our newsletter", href: "https://886studios.substack.com/", box: [324, 7, 32, 22], reach: [325, 39, 10, 12] },
  { id: "shield", room: "research", label: "Shield AI", href: "https://research.contrary.com/company/shield-ai", box: [5, 162, 45, 27], reach: [4, 189, 47, 12] },
  { id: "spacex", room: "research", label: "SpaceX", href: "https://research.contrary.com/company/spacex", box: [74, 162, 41, 27], reach: [73, 189, 43, 12] },
  { id: "turo", room: "research", label: "Turo", href: "https://research.contrary.com/company/turo", box: [12, 198, 32, 30], reach: [45, 204, 18, 24] },
  { id: "chime", room: "research", label: "Chime", href: "https://research.contrary.com/company/chime/", box: [83, 208, 24, 20], reach: [76, 229, 38, 15] },
  { id: "hive", room: "research", label: "Hive", href: "https://research.contrary.com/company/hive", box: [10, 232, 30, 14], reach: [4, 246, 44, 18] },
  { id: "code", room: "side", label: "See my coding projects", href: "/projects", box: [228, 179, 26, 33], reach: [255, 186, 20, 30] },
  { id: "notebooks", room: "side", label: "Read my writing", href: "/writing", box: [228, 224, 26, 20], reach: [255, 222, 20, 22] },
];

/** Pieces of the art with a second state, shown while he stands within `reach`. */
export const officeScreens: readonly { id: string; box: Box; reach: Box }[] = [
  { id: "desk", box: [43, 38, 14, 11], reach: [30, 70, 40, 16] },
  { id: "scan", box: [211, 56, 10, 6], reach: [196, 80, 46, 14] },
  { id: "book", box: [129, 187, 26, 10], reach: [158, 192, 14, 30] },
  { id: "tape", box: [185, 187, 26, 10], reach: [172, 192, 12, 30] },
  { id: "side", box: [231, 180, 21, 10], reach: [255, 186, 20, 30] },
  { id: "shield", box: [4, 168, 52, 20], reach: [4, 189, 47, 12] },
  { id: "spacex", box: [72, 168, 46, 20], reach: [73, 189, 43, 12] },
  { id: "turo", box: [12, 186, 32, 20], reach: [45, 204, 18, 24] },
  { id: "chime", box: [74, 190, 42, 20], reach: [76, 229, 38, 15] },
  { id: "hive", box: [8, 220, 34, 20], reach: [4, 246, 44, 18] },
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
  [8, 34, 16, 32], [30, 48, 40, 22], [72, 44, 12, 10], [62, 78, 12, 14], [58, 91, 20, 14], [62, 101, 12, 12], [10, 98, 12, 10], [116, 40, 14, 18],
  [97, 62, 26, 14], [157, 62, 26, 14], [97, 82, 26, 14], [157, 82, 26, 14],
  [198, 38, 34, 22], [206, 62, 20, 14], [235, 62, 12, 14], [247, 62, 18, 16], [265, 62, 12, 14], [265, 46, 12, 10], [200, 104, 12, 10],
  [130, 48, 12, 5], [146, 48, 12, 5],
  [286, 38, 38, 22], [336, 40, 30, 20], [344, 60, 14, 9], [288, 60, 8, 10], [302, 60, 8, 10], [316, 60, 8, 10],
  [290, 70, 12, 5], [306, 78, 12, 5], [288, 90, 12, 5], [334, 80, 12, 5], [352, 80, 12, 5],
  [10, 130, 12, 10], [350, 130, 12, 10],
  [5, 153, 45, 36], [70, 153, 45, 36], [12, 204, 32, 24], [83, 208, 24, 20], [10, 234, 30, 10], [46, 232, 24, 16],
  [126, 196, 32, 22], [182, 196, 32, 22], [134, 224, 68, 18],
  [228, 190, 26, 22], [235, 208, 12, 14], [228, 224, 26, 20], [282, 192, 20, 20],
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
export const officeScreenAt = (x: number, y: number) => officeScreens.find(item => within(x, y, item.reach))?.id ?? null;

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

const PAGE_LIMIT = 165;
const seen = (text: string) => text.replace(/\]\([^)]*\)/g, "]"); // Links count as the words you can see.
/** A story split the way a game's text box would be: whole sentences, a few lines at a time. */
export function officeStoryPages(paragraphs: readonly string[]) {
  return paragraphs.flatMap(paragraph => {
    const pages: string[] = [];
    for (const sentence of paragraph.split(/(?<=[.!?])\s+(?=[A-Z[*])/)) {
      const last = pages.at(-1);
      if (last !== undefined && seen(last).length + seen(sentence).length + 1 <= PAGE_LIMIT) pages[pages.length - 1] = `${last} ${sentence}`;
      else pages.push(sentence);
    }
    return pages;
  });
}
