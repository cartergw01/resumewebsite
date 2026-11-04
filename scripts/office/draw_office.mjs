// Draws the Work page's office as pixel art, one rectangle at a time: no image
// models, no source art. Run `node scripts/office/draw_office.mjs` after editing.
// Seats, doors and collision bounds live in lib/office-plan.ts and must match.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const WIDTH = 340, HEIGHT = 272;
const LINE = "#2a2233";

function canvas(width, height) {
  const data = new Uint8Array(width * height * 4);
  const parse = color => {
    const h = color.slice(1);
    return [0, 2, 4, 6].map(i => i < h.length ? parseInt(h.slice(i, i + 2), 16) : 255);
  };
  const dot = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const [r, g, b, a] = parse(color), at = (y * width + x) * 4, keep = 255 - a;
    const under = data[at + 3];
    data[at] = (r * a + data[at] * keep) / 255;
    data[at + 1] = (g * a + data[at + 1] * keep) / 255;
    data[at + 2] = (b * a + data[at + 2] * keep) / 255;
    data[at + 3] = under + a * (255 - under) / 255;
  };
  const rect = (x, y, w, h, color) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) dot(i, j, color); };
  return { width, height, data, dot, rect };
}

function png({ width, height, data }) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buffer => { let c = ~0; for (const byte of buffer) c = table[(c ^ byte) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (type, body) => {
    const head = Buffer.alloc(4); head.writeUInt32BE(body.length);
    const named = Buffer.concat([Buffer.from(type), body]);
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(named));
    return Buffer.concat([head, named, tail]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const glyphs = {
  A: "01110 10001 10001 11111 10001 10001 10001", B: "11110 10001 10001 11110 10001 10001 11110", C: "01111 10000 10000 10000 10000 10000 01111",
  F: "11111 10000 10000 11110 10000 10000 10000", G: "01111 10000 10000 10011 10001 10001 01111", I: "11111 00100 00100 00100 00100 00100 11111",
  L: "10000 10000 10000 10000 10000 10000 11111", O: "01110 10001 10001 10001 10001 10001 01110", R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110", T: "11111 00100 00100 00100 00100 00100 00100",
  a: "00000 00000 01110 00001 01111 10001 01111", b: "10000 10000 11110 10001 10001 10001 11110", c: "00000 00000 01111 10000 10000 10000 01111",
  d: "00001 00001 01111 10001 10001 10001 01111", e: "00000 00000 01110 10001 11111 10000 01111", f: "00110 01000 11110 01000 01000 01000 01000",
  g: "00000 00000 01111 10001 10001 10001 01111 00001 01110", h: "10000 10000 11110 10001 10001 10001 10001", i: "00100 00000 01100 00100 00100 00100 01110",
  k: "10000 10000 10010 10100 11000 10100 10010", l: "01100 00100 00100 00100 00100 00100 01110", m: "00000 00000 11010 10101 10101 10101 10101", n: "00000 00000 11110 10001 10001 10001 10001",
  o: "00000 00000 01110 10001 10001 10001 01110", p: "00000 00000 11110 10001 10001 10001 11110 10000 10000", r: "00000 00000 10110 11000 10000 10000 10000",
  s: "00000 00000 01111 10000 01110 00001 11110", t: "01000 01000 11110 01000 01000 01000 00110", u: "00000 00000 10001 10001 10001 10001 01111",
  v: "00000 00000 10001 10001 01010 01010 00100", w: "00000 00000 10001 10001 10101 10101 01010", y: "00000 00000 10001 10001 10001 10001 01111 00001 01110",
  6: "01110 10000 10000 11110 10001 10001 01110", 8: "01110 10001 10001 01110 10001 10001 01110", "&": "01100 10010 10100 01000 10101 10010 01101",
};
const GAP = 4;
// Each letter takes only the width it uses, plus `space` between letters.
const measure = letter => {
  const rows = glyphs[letter].split(" ");
  const left = Math.min(...rows.map(row => row.indexOf("1")).filter(at => at >= 0));
  const right = Math.max(...rows.map(row => row.lastIndexOf("1")));
  return { rows, left, width: right - left + 1 };
};
function text(c, words, x, y, color, scale = 1, space = 1) {
  for (const letter of words) {
    if (letter === " ") { x += GAP * scale; continue; }
    if (!glyphs[letter]) throw new Error(`No pixel letter for "${letter}"`);
    const { rows, left, width } = measure(letter);
    rows.forEach((row, j) => [...row].forEach((on, i) => { if (on === "1") c.rect(x + (i - left) * scale, y + j * scale, scale, scale, color); }));
    x += (width + space) * scale;
  }
}
const wide = (words, scale = 1, space = 1) => [...words].reduce((sum, letter) => sum + (letter === " " ? GAP : measure(letter).width + space) * scale, 0) - space * scale;

const scene = canvas(WIDTH, HEIGHT);
const { rect, dot } = scene;

// Floors
const checker = (x, y, w, h, a, b, size = 8) => { for (let j = 0; j < h; j += size) for (let i = 0; i < w; i += size) rect(x + i, y + j, Math.min(size, w - i), Math.min(size, h - j), ((i + j) / size) % 2 ? a : b); };
function planks(x, y, w, h, base, seam, tall = 8) {
  rect(x, y, w, h, base);
  for (let j = 0, row = 0; j < h; j += tall, row++) {
    rect(x, y + j, w, 1, seam);
    for (let i = row % 2 ? 12 : 0; i < w; i += 24) rect(x + i, y + j, 1, tall, seam);
  }
}
function carpet(x, y, w, h, base, fleck) {
  rect(x, y, w, h, base);
  for (let j = 0; j < h; j += 2) for (let i = (j / 2) % 2 ? 1 : 3; i < w; i += 4) dot(x + i, y + j, fleck);
}

// Walls: the north wall of a room stands up, every other wall is seen from above.
function wallFace(x, y, w, h, base, stripe, band, bandDark) {
  rect(x, y, w, h, base);
  for (let i = 3; i < w; i += 8) rect(x + i, y + 2, 1, h - 10, stripe);
  rect(x, y, w, 2, LINE);
  rect(x, y + h - 8, w, 6, band); rect(x, y + h - 8, w, 1, bandDark);
  rect(x, y + h - 2, w, 2, bandDark);
  rect(x, y + h, w, 3, "#2a223340");
}
const cap = (x, y, w, h) => { rect(x, y, w, h, "#3b3346"); rect(x, y, w, 1, "#5a5068"); };

// Furniture
function box(x, y, w, d, h, top, front, line = LINE) {
  rect(x + 1, y + d + h, w, 2, "#2a223340");
  rect(x, y, w, d + h, line);
  rect(x + 1, y + 1, w - 2, d - 1, top);
  rect(x + 1, y + 1, w - 2, 1, shade(top, 26));
  rect(x + 1, y + d, w - 2, h - 1, front);
  rect(x + 1, y + d, w - 2, 1, shade(front, 18));
}
function shade(color, by) {
  const n = parseInt(color.slice(1, 7), 16);
  const f = v => Math.max(0, Math.min(255, v + by)).toString(16).padStart(2, "0");
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
const WOOD = ["#d29a60", "#a06c3c"], DARKWOOD = ["#8c5a36", "#64402a"];
const desk = (x, y, w, d = 12, tone = WOOD) => box(x, y, w, d, 8, tone[0], tone[1]);
function chair(x, y, color = "#4b6f8a") {
  rect(x + 1, y + 12, 10, 2, "#2a223340");
  rect(x, y, 12, 9, LINE); rect(x + 1, y + 1, 10, 7, color); rect(x + 1, y + 1, 10, 1, shade(color, 30));
  rect(x + 1, y + 9, 10, 3, LINE); rect(x + 2, y + 9, 8, 2, shade(color, -28));
}
function monitor(x, y, w, h, paint) {
  rect(x, y, w, h, LINE); rect(x + 1, y + 1, w - 2, h - 2, "#16202c");
  paint?.(x + 1, y + 1, w - 2, h - 2);
  rect(x + Math.floor(w / 2) - 1, y + h, 3, 2, LINE);
}
const codeLines = (x, y, w, h) => { const c = ["#7bd88f", "#7cc4ff", "#ffcf6e", "#f58a8a"]; for (let j = 1, n = 0; j < h - 1; j += 2, n++) rect(x + 1 + n % 3, y + j, Math.max(2, w - 3 - (n * 5) % 7), 1, c[n % 4]); };
const climbing = color => (x, y, w, h) => { for (let i = 0; i < w; i++) rect(x + i, y + h - 1 - Math.floor((i / w) * (h - 1)) + (i % 3 === 1 ? 1 : 0), 1, 1, color); };
const docLines = (x, y, w, h) => { rect(x, y, w, h, "#e8f0f4"); for (let j = 1; j < h - 1; j += 2) rect(x + 1, y + j, w - 3 - (j % 3), 1, "#7b8794"); };
const LEAVES = ["......kkkk......", "....kkGGGGkk....", "...kGGgGGgGGk...", "..kGgGGGGGGgGk..", "..kGGGgGGgGGGk..", ".kGgGGGGGGGGgGk.", ".kGGGgGGGGgGGGk.", ".kdGGGGgGGGGGdk.", "..kdGgGGGGgGdk..", "...kddGGGGddk...", "....kkdddkk.....", ".....kRRRRk.....", "....kRrRRRRk....", "....kRRRRRRk....", ".....kRRRRk.....", "......kkkk......"];
const LEAF_COLORS = { k: LINE, G: "#3f9b5e", g: "#62c282", d: "#2f7a4a", R: "#c0683c", r: "#e39a68" };
function plant(x, y) {
  rect(x + 3, y + 21, 10, 2, "#2a223340");
  LEAVES.forEach((row, j) => [...row].forEach((c, i) => { if (c !== ".") dot(x + i, y + 6 + j, LEAF_COLORS[c]); }));
}
function lamp(x, y) { // A floor lamp, foot at (x, y).
  rect(x - 3, y - 1, 7, 2, LINE); rect(x, y - 16, 1, 16, LINE);
  rect(x - 4, y - 23, 9, 8, LINE); rect(x - 3, y - 22, 7, 6, "#ffe6a0"); rect(x - 3, y - 22, 7, 1, "#fff5d0");
}
function frame(x, y, w, h, paint, border = "#6d4a2c") {
  rect(x, y, w, h, LINE); rect(x + 1, y + 1, w - 2, h - 2, border); rect(x + 2, y + 2, w - 4, h - 4, "#f4efe0");
  paint?.(x + 2, y + 2, w - 4, h - 4);
}
function windowPane(x, y, w, h) {
  rect(x, y, w, h, LINE); rect(x + 1, y + 1, w - 2, h - 2, "#e8e0cc");
  rect(x + 2, y + 2, w - 4, h - 4, "#1c2a52");
  for (const [i, j] of [[3, 3], [w - 6, 5], [6, h - 6], [w - 9, h - 8]]) if (i > 2 && j > 2) dot(x + i, y + j, "#ffe9a8");
  rect(x + Math.floor(w / 2), y + 2, 1, h - 4, "#e8e0cc");
}
function sofa(x, y, w, color) {
  rect(x + 1, y + 20, w, 2, "#2a223340");
  rect(x, y, w, 20, LINE);
  rect(x + 1, y + 1, w - 2, 8, color); rect(x + 1, y + 1, w - 2, 1, shade(color, 34));
  rect(x + 1, y + 9, w - 2, 1, shade(color, -40));
  rect(x + 1, y + 10, w - 2, 5, shade(color, 14));
  rect(x + 1, y + 15, w - 2, 4, shade(color, -30));
  for (let i = Math.floor(w / 2); i < w - 2; i += 99) rect(x + i, y + 10, 1, 5, shade(color, -30));
  rect(x + 1, y + 3, 3, 16, shade(color, -14)); rect(x + w - 4, y + 3, 3, 16, shade(color, -14));
}
function rug(x, y, w, h, color, edge) {
  rect(x, y, w, h, edge); rect(x + 2, y + 2, w - 4, h - 4, color);
  for (let i = 2; i < w; i += 2) { dot(x + i, y, "#00000030"); dot(x + i, y + h - 1, "#00000030"); }
}
function books(x, y, w, h, seed = 1) {
  const spines = ["#b5473c", "#2f6f8f", "#d9a441", "#3f7d57", "#7a4f9a", "#d9d2bf", "#c9683e", "#26415f"];
  let i = 0, n = seed;
  while (i < w - 1) {
    n = (n * 31 + 7) % 97;
    const wide = 2 + n % 2, tall = h - n % 3;
    if (n % 11) rect(x + i, y + h - tall, wide, tall, spines[n % spines.length]);
    if (n % 11) rect(x + i, y + h - tall, 1, tall, "#ffffff22");
    i += wide + (n % 7 === 0 ? 1 : 0);
  }
}
function bookcase(x, y, w, h, seed) {
  rect(x + 1, y + h, w, 2, "#2a223340");
  rect(x, y, w, h, LINE); rect(x + 1, y + 1, w - 2, h - 2, DARKWOOD[0]);
  const shelves = Math.floor((h - 3) / 10);
  for (let s = 0; s < shelves; s++) {
    const sy = y + 2 + s * 10;
    rect(x + 2, sy, w - 4, 8, "#3a2418");
    books(x + 2, sy, w - 4, 8, seed + s * 13);
    rect(x + 1, sy + 8, w - 2, 2, DARKWOOD[0]); rect(x + 1, sy + 9, w - 2, 1, DARKWOOD[1]);
  }
}
function paperStack(x, y, n) { for (let i = 0; i < n; i++) { rect(x, y - i * 2, 10, 3, LINE); rect(x + 1, y - i * 2 + 1, 8, 1, i % 3 ? "#f4efe0" : "#d9cfb2"); } }

// ---- Floors and walls ----
const NORTH_TOP = 4, FLOOR_TOP = 36, FRONT_TOP = 116, HALL_TOP = 120, HALL_BOTTOM = 152, FLOOR_BOTTOM = 184, FRONT_BOTTOM = 264;

const top = [[4, 80], [88, 96], [188, 80], [272, 64]];
const topDoors = [36, 128, 220, 296], bottomDoors = [36, 136, 244, 296];

// 886 Studios: the wing is the logo's purple, with its own lilacs on the floors.
const PURPLE = "#6d35d8", PURPLE_STRIPE = "#6229c6", DEEP = "#3b0764", VIOLET = "#7c3aed";
const LILAC = ["#ece6fb", "#a78bfa"], AMETHYST = ["#8b5cf6", "#5b21b6"];
const FLOORS_886 = ["#cbbdf2", "#e4dcfa", "#a78bfa", "#9d86e6"];
planks(4, FLOOR_TOP, 80, 80, FLOORS_886[0], "#b5a4e8");
checker(88, FLOOR_TOP, 96, 80, FLOORS_886[1], "#d3c6f6");
carpet(188, FLOOR_TOP, 80, 80, FLOORS_886[2], "#9575f0");
planks(272, FLOOR_TOP, 64, 80, FLOORS_886[3], "#866ed4", 6);
for (const [x, w] of top) wallFace(x, NORTH_TOP, w, 32, PURPLE, PURPLE_STRIPE, DEEP, "#2a0548");

// The corridor between the wings.
checker(4, HALL_TOP, 332, 32, "#b0aab8", "#a39dac", 8);
rect(4, HALL_TOP + 2, 332, 3, "#2a223320");

// Contrary: a dark green library. Slug Fund: a navy trading floor.
planks(4, FLOOR_BOTTOM, 80, 80, "#a8743f", "#8d5e30");
carpet(88, FLOOR_BOTTOM, 112, 80, "#2c4170", "#263a65");
checker(204, FLOOR_BOTTOM, 64, 80, "#dcd2c0", "#cdc2ae");
planks(272, FLOOR_BOTTOM, 64, 80, "#dcb483", "#c49c6c", 6);
wallFace(4, HALL_BOTTOM, 80, 32, "#2f5a48", "#29503f", "#6d4a2c", "#4f3520");
wallFace(88, HALL_BOTTOM, 112, 32, "#1c2c50", "#182746", "#3b4f80", "#2a3a62");
wallFace(204, HALL_BOTTOM, 64, 32, "#e7d9b8", "#dccca8", "#8a6a48", "#6d5238");
wallFace(272, HALL_BOTTOM, 64, 32, "#e9c9a0", "#e0bc90", "#b0683f", "#8a4f2e");

// ---- 886 Studios: the sign, the desk, and a cabinet of term sheets. ----
{
  text(scene, "886", 44 - Math.floor(wide("886", 2) / 2), 6, "#f7f5ff", 2);
  text(scene, "Studios", 44 - Math.floor(wide("Studios") / 2), 21, "#f7f5ff");
  windowPane(7, 8, 14, 18); windowPane(67, 8, 14, 18);
  box(8, 34, 16, 10, 22, ...LILAC);
  rect(10, 47, 12, 1, "#7a5fd0"); rect(10, 54, 12, 1, "#7a5fd0"); rect(14, 49, 4, 1, "#7a5fd0"); rect(14, 56, 4, 1, "#7a5fd0");
  desk(28, 48, 40, 14, AMETHYST);
  monitor(40, 37, 16, 13, docLines);
  rect(41, 54, 14, 4, LINE); rect(42, 55, 12, 2, "#d7dbe0");
  paperStack(31, 57, 2);
  rect(60, 53, 5, 6, LINE); rect(61, 54, 3, 4, "#f2ece0"); rect(61, 54, 3, 1, "#6b4a33");
  plant(66, 32);
}

// ---- ikigai Launchpad: demo day. A pitch on the screen, the batch in rows. ----
{
  rect(100, 6, 72, 26, LINE); rect(101, 7, 70, 24, "#f7f5ec");
  rect(104, 9, 28, 3, PURPLE); rect(104, 14, 20, 1, "#8a8f98"); rect(104, 17, 24, 1, "#8a8f98"); rect(104, 20, 16, 1, "#8a8f98");
  for (const [i, h] of [[0, 4], [1, 7], [2, 10], [3, 15]]) { rect(140 + i * 7, 28 - h, 5, h, i === 3 ? "#e7c693" : PURPLE); }
  rect(137, 28, 32, 1, "#55606c");
  // The podium, and two rows of founders' chairs with an aisle down the middle.
  box(112, 40, 14, 6, 12, "#4c1d95", "#2e1065");
  rect(116, 37, 6, 3, LINE); rect(117, 38, 4, 1, "#d7dbe0");
  for (const y of [62, 82]) for (const x of [93, 107, 149, 163]) chair(x, y, VIOLET);
  plant(167, 34);
}

// ---- Finding founders: the pipeline, and the agent scanning for builders. ----
{
  rect(192, 7, 72, 25, LINE); rect(193, 8, 70, 23, "#f4f0ff");
  [[5, "#c4b5fd"], [4, "#a78bfa"], [2, PURPLE], [1, "#e7c693"]].forEach(([count, color], column) => {
    rect(196 + column * 17, 10, 14, 1, "#8a8f98");
    for (let row = 0; row < count; row++) rect(197 + column * 17, 12 + row * 4, 12, 3, color);
  });
  desk(192, 46, 30, 14, AMETHYST);
  monitor(196, 35, 20, 13, (x, y, w, h) => { rect(x, y, w, h, "#0d2a22"); for (let j = 1; j < h; j += 3) rect(x + 1, y + j, w - 2, 1, "#1b4d3e"); rect(x + 3, y + 2, 6, 1, "#7bffb0"); rect(x + 3, y + 5, 11, 1, "#7bffb0"); rect(x + 3, y + 8, 8, 1, "#7bffb0"); });
  desk(234, 46, 30, 14, AMETHYST);
  monitor(239, 35, 20, 13, codeLines);
  rect(198, 52, 12, 4, LINE); rect(199, 53, 10, 2, "#d7dbe0");
  rect(241, 52, 12, 4, LINE); rect(242, 53, 10, 2, "#d7dbe0");
  chair(200, 66, DEEP); chair(243, 66, DEEP);
}

// ---- Community & content: the residency's coffee bar and sofa, the newsletter. ----
{
  rect(276, 8, 22, 20, LINE); rect(277, 9, 20, 18, "#2a1a4a");
  rect(279, 11, 12, 1, "#e9e4d4"); rect(279, 14, 16, 1, "#c4b5fd"); rect(279, 17, 13, 1, "#c4b5fd"); rect(279, 20, 15, 1, "#c4b5fd");
  frame(302, 7, 30, 22, (x, y, w) => { rect(x + 2, y + 2, w - 4, 3, PURPLE); rect(x + 2, y + 7, w - 8, 1, "#7b8794"); rect(x + 2, y + 9, w - 5, 1, "#7b8794"); rect(x + 2, y + 11, w - 9, 1, "#7b8794"); rect(x + 2, y + 13, w - 6, 1, "#7b8794"); }, DEEP);
  box(274, 38, 38, 10, 12, "#f1ecff", "#5b21b6");
  rect(278, 31, 10, 10, LINE); rect(279, 32, 8, 8, "#aab2bb"); rect(281, 36, 4, 2, LINE); // Espresso machine.
  for (const x of [293, 299, 305]) { rect(x, 41, 4, 4, LINE); rect(x + 1, 42, 2, 2, "#f2ece0"); }
  rug(276, 74, 42, 20, "#4c1d95", DEEP);
  sofa(278, 62, 38, VIOLET);
  plant(318, 28);
}

// ---- Contrary: reading and writing. Every wall is books. ----
{
  bookcase(5, HALL_BOTTOM + 1, 30, 36, 3);
  bookcase(53, HALL_BOTTOM + 1, 30, 36, 19);
  // The writing desk: a typewriter, a manuscript, a green banker's lamp.
  rect(6, 197, 26, 2, "#2a223340");
  desk(8, 204, 28, 16, DARKWOOD);
  rect(15, 202, 14, 10, LINE); rect(16, 203, 12, 3, "#3a3f46"); rect(16, 206, 12, 5, "#596069"); for (let i = 17; i < 27; i += 2) { dot(i, 207, "#e8e0cc"); dot(i + 1, 209, "#e8e0cc"); }
  rect(18, 198, 8, 5, LINE); rect(19, 199, 6, 4, "#f4efe0"); rect(20, 200, 4, 1, "#7b8794");
  rect(10, 209, 4, 1, LINE); rect(11, 203, 1, 6, LINE); rect(9, 201, 6, 3, LINE); rect(10, 202, 4, 1, "#3f9b5e");
  rect(30, 212, 5, 6, LINE); rect(31, 213, 3, 4, "#f4efe0");
  // A reading chair, its lamp, an open book, and stacks that never got shelved.
  rug(50, 212, 30, 32, "#7b3f3a", "#5a2c29");
  sofa(56, 214, 20, "#9a5a3c");
  lamp(78, 214);
  rect(60, 236, 12, 6, LINE); rect(61, 237, 5, 4, "#f4efe0"); rect(66, 237, 5, 4, "#e8e0cc"); rect(66, 237, 1, 4, LINE);
  paperStack(8, 240, 5); paperStack(22, 242, 3);
}

// ---- Slug Fund Investment Group: stocks. Tape, candles and a trading floor. ----
{
  const candles = [[0, 8, 3, 1], [1, 9, 4, 1], [2, 11, 5, 0], [3, 9, 6, 1], [4, 7, 7, 1], [5, 10, 4, 0], [6, 6, 8, 1], [7, 4, 9, 1]];
  rect(90, HALL_BOTTOM + 3, 44, 21, LINE); rect(91, HALL_BOTTOM + 4, 42, 19, "#0b1424");
  for (const [i, y, h, up] of candles) { const c = up ? "#4fd08a" : "#ef6461"; rect(95 + i * 5 + 1, HALL_BOTTOM + 3 + y, 1, h + 3, c); rect(95 + i * 5, HALL_BOTTOM + 4 + y, 3, h, c); }
  rect(154, HALL_BOTTOM + 3, 44, 21, LINE); rect(155, HALL_BOTTOM + 4, 42, 19, "#0b1424");
  const trend = [14, 13, 14, 11, 12, 9, 10, 7, 8, 5, 6, 3, 2];
  trend.forEach((v, i) => rect(157 + i * 3, HALL_BOTTOM + 4 + v, 3, 1, "#4fd08a"));
  for (let i = 0; i < 40; i += 8) rect(156 + i, HALL_BOTTOM + 21, 5, 1, i % 16 ? "#4fd08a" : "#ef6461");
  const screen = up => (x, y, w, h) => climbing(up ? "#4fd08a" : "#ef6461")(x, y, w, h);
  const station = (x, y) => {
    desk(x, y, 42, 14, ["#5b6b8c", "#3e4c6c"]);
    monitor(x + 2, y - 10, 12, 12, screen(true)); monitor(x + 15, y - 10, 12, 12, screen(false)); monitor(x + 28, y - 10, 12, 12, screen(true));
    rect(x + 13, y + 7, 16, 4, LINE); rect(x + 14, y + 8, 14, 2, "#c7ccd4");
  };
  station(92, 196); station(158, 196);
  station(92, 222); station(158, 222);
}

// ---- Side work: Korobra's chart, the code, the notebooks. ----
{
  frame(208, HALL_BOTTOM + 4, 32, 20, (x, y, w, h) => { rect(x, y, w, h, "#10202c"); climbing("#ffcf6e")(x + 1, y + 1, w - 2, h - 2); });
  desk(208, 190, 34, 14);
  monitor(211, 179, 14, 12, codeLines); monitor(226, 179, 14, 12, climbing("#4fd08a"));
  rect(214, 196, 14, 4, LINE); rect(215, 197, 12, 2, "#d7dbe0");
  chair(219, 208);
  bookcase(208, 226, 28, 24, 41);
  plant(250, 228);
}

// ---- About me: the TV for the game, a shelf of books, and a coffee. ----
{
  windowPane(314, HALL_BOTTOM + 5, 18, 18);
  box(276, 186, 18, 8, 8, ...DARKWOOD);
  rect(275, 172, 20, 16, LINE); rect(276, 173, 18, 14, "#3b3f4a"); rect(277, 174, 16, 11, "#141a30"); // The game on TV.
  rect(277, 180, 16, 5, "#c99a4a"); rect(277, 180, 16, 1, "#e6c06e"); rect(284, 180, 2, 5, "#4f2d7f"); rect(280, 177, 1, 3, "#f4efe0"); rect(289, 176, 1, 4, "#f4efe0");
  rect(283, 188, 4, 1, LINE);
  bookcase(314, 186, 20, 24, 67);
  rug(280, 214, 44, 26, "#6f8a5c", "#546c44");
  sofa(290, 228, 26, "#b0683f");
  box(322, 234, 12, 10, 6, ...WOOD);
  rect(325, 236, 5, 5, LINE); rect(326, 237, 3, 3, "#f2ece0"); rect(326, 237, 3, 1, "#6b4a33");
}

// ---- Wall tops and doorways, drawn last so they sit over everything. ----
cap(0, 0, WIDTH, 4);
cap(0, 0, 4, HEIGHT - 4); cap(336, 0, 4, HEIGHT - 4);
for (const x of [84, 184, 268]) cap(x, 0, 4, FRONT_TOP);
for (const x of [84, 200, 268]) cap(x, HALL_BOTTOM, 4, FRONT_BOTTOM - HALL_BOTTOM);
cap(0, FRONT_TOP, WIDTH, 4);
cap(0, HALL_BOTTOM - 2, WIDTH, 2);
cap(0, FRONT_BOTTOM, WIDTH, 4);
rect(0, HEIGHT - 4, WIDTH, 4, "#1d1826");

// Doors onto the corridor: a gap with a mat in front of it.
const mat = (x, y) => { rect(x, y, 16, 8, "#6d4a2c"); rect(x + 1, y + 1, 14, 6, "#8a6240"); for (let i = 2; i < 15; i += 2) rect(x + i, y + 2, 1, 4, "#6d4a2c"); };
const topFloors = FLOORS_886;
topDoors.forEach((x, index) => {
  rect(x, FRONT_TOP, 16, 4, topFloors[index]);
  mat(x, HALL_TOP + 1);
  rect(x - 1, FRONT_TOP, 1, 4, LINE); rect(x + 16, FRONT_TOP, 1, 4, LINE);
});
const bottomFloors = ["#a8743f", "#2c4170", "#dcd2c0", "#dcb483"];
bottomDoors.forEach((x, index) => {
  rect(x, HALL_BOTTOM - 2, 16, 34, bottomFloors[index]);
  rect(x, HALL_BOTTOM - 2, 16, 3, "#2a223340");
  rect(x - 2, HALL_BOTTOM - 2, 2, 34, LINE); rect(x + 16, HALL_BOTTOM - 2, 2, 34, LINE);
  rect(x - 1, HALL_BOTTOM - 2, 1, 34, "#6d4a2c"); rect(x + 16, HALL_BOTTOM - 2, 1, 34, "#6d4a2c");
  mat(x, HALL_BOTTOM - 9);
});
plant(8, HALL_TOP + 4); plant(316, HALL_TOP + 4);

// ---- Names, lettered on every floor: the same words as the copy, never shortened. ----
const names = canvas(WIDTH, HEIGHT);
function letter(lines, cx, y, SPACE = 2) {
  for (const line of lines) if (wide(line, 1, SPACE) > 106) throw new Error(`"${line}" is too wide for its floor`);
  const stamp = color => (dx, dy) => lines.forEach((line, index) => text(names, line, cx - Math.floor(wide(line, 1, SPACE) / 2) + dx, y + index * 10 + dy, color, 1, SPACE));
  const outline = stamp("#1d1626");
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) outline(dx, dy);
  stamp("#fbf6e6")(0, 0);
}
letter(["886 Studios"], 44, 105);
letter(["Building ikigai", "Launchpad"], 136, 97);
letter(["Finding", "founders"], 228, 97);
letter(["Community", "& content"], 304, 97);
letter(["Contrary", "Research"], 44, 245);
letter(["Slug Fund", "Investment Group"], 144, 245);
letter(["On the side"], 236, 254, 1);
letter(["About me"], 304, 254);

// ---- The man: black shirt, dark blue pants, an undercut with a middle part. ----
const palette = { k: "#15121c", H: "#2b2230", h: "#4b3a44", f: "#5c5258", s: "#f0c8a0", S: "#d59f72", e: "#15121c", T: "#23232b", t: "#3e3e4a", P: "#1f3566", p: "#30508f", B: "#15121c", W: "#4a4652" };
const head = {
  down: [".....kkkkkk.....", "....kHHHHHHk....", "...kHHhHHhHHk...", "...kHhHkkHhHk...", "...kHHHssHHHk...", "...kfHssssHfk...", "...kfssssssfk...", "...ksseSSessk...", "...kssssssssk...", "....kssSSssk....", ".....kkkkkk....."],
  up: [".....kkkkkk.....", "....kHHHHHHk....", "...kHHhHHhHHk...", "...kHHHkkHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kfHHHHHHfk...", "...kffHHHHffk...", "...kffffffffk...", "....kssssssk....", ".....kkkkkk....."],
  left: [".....kkkkkk.....", "....kHHHHHHk....", "...kHhhHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...ksHHHHfffk...", "...kssssSfffk...", "...kesssSSffk...", "...kssssssffk...", "....kssssssk....", ".....kkkkkk....."],
};
const body = {
  down: ["....kkkkkkkk....", "...kTTTTTTTTk...", "..kTtTTTTTTtTk..", "..kTkTTTTTTkTk..", "..ksskTTTTkssk..", "..kkkkTTTTkkkk.."],
  up: ["....kkkkkkkk....", "...kTTTTTTTTk...", "..kTtTTTTTTtTk..", "..kTkTTTTTTkTk..", "..ksskTTTTkssk..", "..kkkkTTTTkkkk.."],
  left: ["....kkkkkkk.....", "....kTTTTTTk....", "....kTtTTTTk....", "....kTtTTTTk....", "....kssTTTTk....", "....kkkTTTTk...."],
};
const legs = {
  front: {
    stand: ["....kPPPPPPk....", "....kPpPPpPk....", "....kPPkkPPk....", "....kPPkkPPk....", "....kBBkkBBk....", "....kkkkkkkk...."],
    a: ["....kPPPPPPk....", "....kPpPPpPk....", "....kPPkkPPk....", "....kBBkkPPk....", "....kkkkkBBk....", ".........kkk...."],
    b: ["....kPPPPPPk....", "....kPpPPpPk....", "....kPPkkPPk....", "....kPPkkBBk....", "....kBBkkkkk....", "....kkk........."],
  },
  left: {
    stand: ["....kPPPPPPk....", "....kPpPPPPk....", ".....kPPPPk.....", ".....kPPPPk.....", ".....kBBBBk.....", ".....kkkkkk....."],
    a: ["....kPPPPPPk....", "....kPpPPPPk....", "...kPPkkkPPk....", "...kPPk.kPPk....", "...kBBk.kBBk....", "...kkkk.kkkk...."],
    b: ["....kPPPPPPk....", "....kPpPPPPk....", ".....kPPPPk.....", ".....kPPPPk.....", "....kBBBBk......", "....kkkkkk......"],
  },
};
const CELL = [16, 24];
const sheet = canvas(CELL[0] * 3, CELL[1] * 4);
const stamp = (rows, col, row, mirror = false) => rows.forEach((line, j) => [...(mirror ? [...line].reverse().join("") : line)].forEach((c, i) => {
  if (c !== ".") sheet.rect(col * CELL[0] + i, row * CELL[1] + 1 + j, 1, 1, palette[c]);
}));
const facings = [["down", "front", false], ["left", "left", false], ["left", "left", true], ["up", "front", false]];
facings.forEach(([view, stride, mirror], row) => ["stand", "a", "b"].forEach((frame, col) => {
  const bodyView = view === "up" ? "up" : view;
  stamp([...head[view], ...body[bodyView], ...legs[stride][frame]], col, row, mirror);
}));

// Written with content hashes, the same way the site's other baked art is.
const out = "public/office";
mkdirSync(out, { recursive: true });
for (const file of readdirSync(out)) rmSync(`${out}/${file}`);
const art = {};
for (const [key, image] of Object.entries({ scene, names, worker: sheet })) {
  const bytes = png(image);
  const name = `${key}-${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}.png`;
  writeFileSync(`${out}/${name}`, bytes);
  art[key] = `/office/${name}`;
  console.log(name, bytes.length);
}
writeFileSync("lib/office-art.json", `${JSON.stringify(art, null, 2)}\n`);
