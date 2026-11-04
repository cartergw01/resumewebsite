// Draws the Work page's office as pixel art, one rectangle at a time: no image
// models, no source art. Run `node scripts/office/draw_office.mjs` after editing.
// Seats, doors and collision bounds live in lib/office-plan.ts and must match.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const WIDTH = 372, HEIGHT = 272;
// Saved larger than drawn: scaled down smoothly, every pixel stays the same size at any width.
const SAVE_SCALE = 6;
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
  K: "10001 10010 10100 11000 10100 10010 10001", F: "11111 10000 10000 11110 10000 10000 10000", G: "01111 10000 10000 10011 10001 10001 01111", I: "11111 00100 00100 00100 00100 00100 11111",
  L: "10000 10000 10000 10000 10000 10000 11111", O: "01110 10001 10001 10001 10001 10001 01110", R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110", T: "11111 00100 00100 00100 00100 00100 00100",
  a: "00000 00000 01110 00001 01111 10001 01111", b: "10000 10000 11110 10001 10001 10001 11110", c: "00000 00000 01111 10000 10000 10000 01111",
  d: "00001 00001 01111 10001 10001 10001 01111", e: "00000 00000 01110 10001 11111 10000 01111", f: "00110 01000 11110 01000 01000 01000 01000",
  g: "00000 00000 01111 10001 10001 10001 01111 00001 01110", h: "10000 10000 11110 10001 10001 10001 10001", i: "00100 00000 01100 00100 00100 00100 01110",
  j: "00010 00000 00110 00010 00010 00010 00010 10010 01100", k: "10000 10000 10010 10100 11000 10100 10010", l: "01100 00100 00100 00100 00100 00100 01110", m: "00000 00000 11010 10101 10101 10101 10101", n: "00000 00000 11110 10001 10001 10001 10001",
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
// ---- A person, standing, in any colours: the same sprite as the man's. ----
const person = (x, y, view, colors, mirror = false) => {
  const stride = view === "left" ? "left" : "front";
  const rows = [...head[view], ...body[view], ...legs[stride].stand];
  const inks = { ...palette, ...colors };
  rect(x - 6, y - 1, 13, 3, "#2a223340");
  rows.forEach((line, j) => [...(mirror ? [...line].reverse().join("") : line)].forEach((c, i) => {
    if (c !== ".") dot(x - 8 + i, y - 22 + j, inks[c]);
  }));
};

// ---- Floors and walls ----
const FLOOR_TOP = 36, FRONT_TOP = 116, HALL_TOP = 120, HALL_BOTTOM = 152, FLOOR_BOTTOM = 184, FRONT_BOTTOM = 264;
const PURPLE = "#6d35d8", CONTRARY = "#184df6";

// A room's name is inlaid in its floor: a darker or lighter shade of the floor
// itself with a lit lower edge, under the furniture and under the night.
function inlay(lines, cx, y, base, roomWidth, lighter = false) {
  const ink = shade(base, lighter ? 92 : -92), edge = shade(base, lighter ? -14 : 24);
  lines.forEach((line, index) => {
    if (wide(line) > roomWidth - 6) throw new Error(`"${line}" (${wide(line)}) is too wide for a ${roomWidth} room`);
    const x = cx - Math.floor(wide(line) / 2), row = y + index * 10;
    text(scene, line, x, row + 1, edge);
    text(scene, line, x, row, ink);
  });
}

// 886 Studios: natural materials. Purple is kept for what carries the brand: the
// sign, the trim along the wall, the pitch, one sofa and one of the people.
const FLOORS_886 = ["#d8b98c", "#e9e5da", "#a9b0ba", "#cb9a6c"];
planks(4, FLOOR_TOP, 84, 80, FLOORS_886[0], "#c2a274");
checker(92, FLOOR_TOP, 100, 80, FLOORS_886[1], "#dcd7ca");
carpet(196, FLOOR_TOP, 84, 80, FLOORS_886[2], "#9aa2ad");
planks(284, FLOOR_TOP, 84, 80, FLOORS_886[3], "#b18355", 6);
for (const [x, w] of [[4, 84], [92, 100], [196, 84], [284, 84]]) wallFace(x, 4, w, 32, "#f4eddc", "#ebe2cd", PURPLE, "#4d22a0");

checker(4, HALL_TOP, 364, 32, "#b0aab8", "#a39dac", 8);
rect(4, HALL_TOP + 2, 364, 3, "#2a223320");

// Contrary Research in its own blue. Slug Fund a navy trading floor.
const FLOORS_LOWER = ["#b98a54", "#2c4170", "#dcd2c0", "#dcb483"];
planks(4, FLOOR_BOTTOM, 112, 80, FLOORS_LOWER[0], "#a2763f");
carpet(120, FLOOR_BOTTOM, 96, 80, FLOORS_LOWER[1], "#263a65");
checker(220, FLOOR_BOTTOM, 88, 80, FLOORS_LOWER[2], "#cdc2ae");
planks(312, FLOOR_BOTTOM, 56, 80, FLOORS_LOWER[3], "#c49c6c", 6);
wallFace(4, HALL_BOTTOM, 112, 32, CONTRARY, "#1442d6", "#0d2a8f", "#081c66");
wallFace(120, HALL_BOTTOM, 96, 32, "#1c2c50", "#182746", "#0b1424", "#2a3a62");
wallFace(220, HALL_BOTTOM, 88, 32, "#e7d9b8", "#dccca8", "#8a6a48", "#6d5238");
wallFace(312, HALL_BOTTOM, 56, 32, "#e9c9a0", "#e0bc90", "#b0683f", "#8a4f2e");

inlay(["Building ikigai", "Launchpad"], 142, 97, FLOORS_886[1], 100);
inlay(["Finding", "founders"], 238, 97, FLOORS_886[2], 84);
inlay(["Community", "& content"], 326, 97, FLOORS_886[3], 84);
inlay(["Contrary Research"], 60, 253, FLOORS_LOWER[0], 112);
inlay(["Slug Fund", "Investment Group"], 168, 245, FLOORS_LOWER[1], 96, true);
inlay(["Korobra Capital", "& side projects"], 264, 245, FLOORS_LOWER[2], 88);
inlay(["About me"], 340, 253, FLOORS_LOWER[3], 56);

const SEAT = "#7c8796";

// ---- 886 Studios: the sign, the desk, and a cabinet of term sheets. ----
{
  rect(22, 5, 44, 25, "#4d22a0"); rect(23, 6, 42, 23, PURPLE);
  text(scene, "886", 44 - Math.floor(wide("886", 2) / 2), 7, "#ffffff", 2);
  text(scene, "Studios", 44 - Math.floor(wide("Studios") / 2), 21, "#ffffff");
  windowPane(6, 8, 13, 18); windowPane(69, 8, 13, 18);
  rug(26, 74, 38, 22, "#b89a72", "#9c7f58");
  box(8, 34, 16, 10, 22, "#d8dce2", "#a7aeb9");
  rect(10, 47, 12, 1, "#737b88"); rect(10, 54, 12, 1, "#737b88"); rect(14, 49, 4, 1, "#737b88"); rect(14, 56, 4, 1, "#737b88");
  desk(30, 48, 40, 14);
  monitor(42, 37, 16, 13, docLines);
  rect(43, 54, 14, 4, LINE); rect(44, 55, 12, 2, "#d7dbe0");
  paperStack(33, 57, 2);
  rect(62, 53, 5, 6, LINE); rect(63, 54, 3, 4, "#f2ece0"); rect(63, 54, 3, 1, "#6b4a33");
  plant(70, 32);
}

// ---- Building ikigai Launchpad: demo day, a pitch and the batch in rows. ----
{
  rect(106, 6, 72, 26, LINE); rect(107, 7, 70, 24, "#f7f5ec");
  rect(110, 9, 28, 3, PURPLE); rect(110, 14, 20, 1, "#8a8f98"); rect(110, 17, 24, 1, "#8a8f98"); rect(110, 20, 16, 1, "#8a8f98");
  for (const [i, h] of [[0, 4], [1, 7], [2, 10], [3, 15]]) rect(146 + i * 7, 28 - h, 5, h, i === 3 ? "#e7c693" : "#8a8f98");
  rect(143, 28, 32, 1, "#55606c");
  box(116, 40, 14, 6, 12, ...DARKWOOD);
  rect(120, 37, 6, 3, LINE); rect(121, 38, 4, 1, "#d7dbe0");
  for (const y of [62, 82]) for (const x of [97, 111, 157, 171]) chair(x, y, SEAT);
  plant(172, 34);
}

// ---- Finding founders: the pipeline, and the agent scanning for builders. ----
{
  rect(200, 7, 76, 25, LINE); rect(201, 8, 74, 23, "#f4f0e4");
  [[5, "#d9d2bf"], [4, "#c9c0a6"], [2, "#b9a98a"], [1, PURPLE]].forEach(([count, color], column) => {
    rect(205 + column * 18, 10, 14, 1, "#8a8f98");
    for (let row = 0; row < count; row++) rect(206 + column * 18, 12 + row * 4, 12, 3, color);
  });
  desk(200, 46, 30, 14);
  monitor(204, 35, 20, 13, (x, y, w, h) => { rect(x, y, w, h, "#0d2a22"); for (let j = 1; j < h; j += 3) rect(x + 1, y + j, w - 2, 1, "#1b4d3e"); rect(x + 3, y + 2, 6, 1, "#7bffb0"); rect(x + 3, y + 5, 11, 1, "#7bffb0"); rect(x + 3, y + 8, 8, 1, "#7bffb0"); });
  desk(246, 46, 30, 14);
  monitor(251, 35, 20, 13, codeLines);
  rect(206, 52, 12, 4, LINE); rect(207, 53, 10, 2, "#d7dbe0");
  rect(253, 52, 12, 4, LINE); rect(254, 53, 10, 2, "#d7dbe0");
  chair(209, 66, SEAT); chair(255, 66, SEAT);
}

// ---- Community & content: the coffee bar, the newsletter, and the people. ----
{
  rect(288, 8, 22, 20, LINE); rect(289, 9, 20, 18, "#2a3a33");
  rect(291, 11, 12, 1, "#e9e4d4"); rect(291, 14, 16, 1, "#b8c4bc"); rect(291, 17, 13, 1, "#b8c4bc"); rect(291, 20, 15, 1, "#b8c4bc");
  frame(324, 7, 32, 22, (x, y, w) => { rect(x + 2, y + 2, w - 4, 3, PURPLE); rect(x + 2, y + 7, w - 8, 1, "#7b8794"); rect(x + 2, y + 9, w - 5, 1, "#7b8794"); rect(x + 2, y + 11, w - 9, 1, "#7b8794"); rect(x + 2, y + 13, w - 6, 1, "#7b8794"); });
  box(286, 38, 38, 10, 12, "#efe7d4", "#8a5f3c");
  rect(290, 31, 10, 10, LINE); rect(291, 32, 8, 8, "#aab2bb"); rect(293, 36, 4, 2, LINE); // Espresso machine.
  for (const x of [304, 310, 316]) { rect(x, 41, 4, 4, LINE); rect(x + 1, 42, 2, 2, "#f2ece0"); }
  sofa(336, 40, 30, PURPLE);
  // Kai and Kevin talking by the bar, and founders in the room with them.
  const founder = { H: "#3a2a22", h: "#5c4436", f: "#3a2a22" };
  [
    [344, 72, "down", false, { ...founder, T: "#3e8f83", t: "#59ad9f", P: "#3a3f4b", p: "#4d5362" }],
    [360, 80, "left", false, { H: "#1f1b22", h: "#3a3340", f: "#1f1b22", s: "#d8a884", S: "#b98a68", T: "#d9a441", t: "#efc56c", P: "#42485a", p: "#565d72" }],
    [296, 84, "left", true, { f: "#3a3340", T: "#b5433a", t: "#d3665c", P: "#2c303a", p: "#3f4452" }], // Kai
    [316, 84, "left", false, { H: "#191519", h: "#3a3340", f: "#3a3340", T: PURPLE, t: "#8b5cf6", P: "#2f3a4f", p: "#435069" }], // Kevin
    [346, 92, "up", false, { H: "#7a4a2a", h: "#9c6a42", f: "#7a4a2a", s: "#f4d4b4", S: "#dcb492", T: "#e8e2d2", t: "#ffffff", P: "#51607a", p: "#687994" }],
  ].forEach(([x, y, view, mirror, colors]) => person(x, y, view, colors, mirror));
}

// ---- Contrary Research: reading and writing, under Contrary's blue. ----
{
  bookcase(5, 162, 45, 27, 3);
  bookcase(74, 162, 41, 27, 19);
  // The writing desk: a typewriter, a manuscript, a green banker's lamp.
  desk(12, 204, 32, 16, DARKWOOD);
  rect(21, 202, 14, 10, LINE); rect(22, 203, 12, 3, "#3a3f46"); rect(22, 206, 12, 5, "#596069"); for (let i = 23; i < 33; i += 2) { dot(i, 207, "#e8e0cc"); dot(i + 1, 209, "#e8e0cc"); }
  rect(24, 198, 8, 5, LINE); rect(25, 199, 6, 4, "#f4efe0"); rect(26, 200, 4, 1, "#7b8794");
  rect(14, 209, 4, 1, LINE); rect(15, 203, 1, 6, LINE); rect(13, 201, 6, 3, LINE); rect(14, 202, 4, 1, "#3f9b5e");
  rect(37, 212, 5, 6, LINE); rect(38, 213, 3, 4, "#f4efe0");
  // A reading corner: the chair in Contrary's blue, its lamp, an open book.
  rug(76, 202, 38, 42, "#e9e1cc", "#0d2a8f");
  sofa(83, 208, 24, CONTRARY);
  lamp(111, 212);
  rect(89, 232, 12, 6, LINE); rect(90, 233, 5, 4, "#f4efe0"); rect(95, 233, 5, 4, "#e8e0cc"); rect(95, 233, 1, 4, LINE);
  paperStack(12, 242, 5); paperStack(26, 243, 3);
}

// ---- Slug Fund Investment Group: every screen shows a different part of the market. ----
{
  const GREEN = "#4fd08a", RED = "#ef6461", W = "#dfe6f2";
  const heatmap = (x, y, w, h) => {
    rect(x, y, w, h, "#0b1424");
    [[0, 0, 12, 8, "#2f9e64"], [13, 0, 8, 4, "#c9484a"], [13, 5, 8, 3, "#57c78a"], [22, 0, w - 22, 8, "#8fdcae"], [0, 9, 7, h - 9, "#a33b3e"], [8, 9, 10, h - 9, "#3fb077"], [19, 9, 6, h - 9, "#e07a7a"], [26, 9, w - 26, h - 9, "#2f9e64"]]
      .forEach(([a, b, c, d, color]) => rect(x + a, y + b, c, d, color));
  };
  const candles = (x, y, w, h) => {
    rect(x, y, w, h, "#0b1424");
    [[8, 3, 1], [9, 4, 1], [10, 5, 0], [8, 6, 1], [6, 7, 1], [8, 4, 0], [5, 8, 1]].forEach(([top, tall, up], i) => {
      const color = up ? GREEN : RED, cx = x + 2 + i * 4;
      rect(cx + 1, y + top - 2, 1, tall + 3, color); rect(cx, y + top - 1, 3, tall, color);
    });
    [3, 2, 4, 2, 3, 5, 4].forEach((tall, i) => rect(x + 2 + i * 4, y + h - tall, 3, tall, "#3b5a8c"));
  };
  frame(124, HALL_BOTTOM + 3, 36, 21, (x, y, w, h) => heatmap(x, y, w, h), "#2a3a62");
  frame(182, HALL_BOTTOM + 3, 32, 21, (x, y, w, h) => candles(x, y, w, h), "#2a3a62");
  // The tape, running along the wall on either side of the door.
  for (const [from, to] of [[124, 160], [182, 214]]) for (let i = from; i < to; i += 4) rect(i, HALL_BOTTOM + 26, 3, 1, (i * 7) % 3 ? GREEN : RED);

  const orderBook = (x, y, w, h) => { for (let j = 0; j < h; j += 2) { const size = 2 + (j * 5) % (Math.floor(w / 2) - 1); rect(x + Math.floor(w / 2) - size, y + j, size, 1, GREEN); rect(x + Math.floor(w / 2), y + j, Math.max(1, Math.floor(w / 2) - size), 1, RED); } };
  const portfolio = (x, y, w, h) => { const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2); for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const d = i * i + j * j; if (d > 18 || d < 4) continue; dot(cx + i, cy + j, i >= 0 && j < 0 ? "#e7c693" : i >= 0 ? GREEN : j < 1 ? "#6b97ff" : RED); } };
  const headlines = (x, y, w, h) => { for (let j = 1; j < h; j += 2) { rect(x + 1, y + j, 2, 1, j % 4 === 1 ? GREEN : RED); rect(x + 4, y + j, w - 5 - (j * 3) % 4, 1, W); } };
  const yields = (x, y, w, h) => { [[0, 7], [1, 6], [2, 6], [3, 5], [4, 4], [5, 4], [6, 3], [7, 2], [8, 2], [9, 1]].forEach(([i, row]) => rect(x + 1 + i, y + row + 1, 1, 1, "#ffcf6e")); rect(x, y + h - 1, w, 1, "#3b5a8c"); };
  const tradingDesk = (x, paintLeft, paintRight) => {
    desk(x, 196, 32, 14, ["#5b6b8c", "#3e4c6c"]);
    monitor(x + 2, 186, 14, 12, paintLeft); monitor(x + 16, 186, 14, 12, paintRight);
    rect(x + 8, 203, 16, 4, LINE); rect(x + 9, 204, 14, 2, "#c7ccd4");
  };
  tradingDesk(126, orderBook, portfolio);
  tradingDesk(182, headlines, yields);
  // The memo table: the fund's 15+ investment memos, in stacks.
  desk(134, 224, 68, 10, WOOD);
  paperStack(138, 230, 3); paperStack(152, 230, 4); paperStack(180, 230, 2); paperStack(192, 230, 3);
}

// ---- Korobra Capital & side projects: the fund's chart, the code, the notebooks. ----
{
  frame(228, HALL_BOTTOM + 4, 22, 20, (x, y, w, h) => { rect(x, y, w, h, "#10202c"); climbing("#ffcf6e")(x + 1, y + 1, w - 2, h - 2); });
  frame(274, HALL_BOTTOM + 4, 28, 20, codeLines);
  desk(228, 190, 26, 14);
  monitor(230, 179, 11, 12, codeLines); monitor(242, 179, 11, 12, climbing("#4fd08a"));
  rect(234, 196, 14, 4, LINE); rect(235, 197, 12, 2, "#d7dbe0");
  chair(235, 208, SEAT);
  bookcase(228, 224, 26, 20, 41);
  box(282, 192, 20, 12, 8, ...WOOD);
  rect(286, 194, 12, 7, LINE); rect(287, 195, 10, 5, "#f4efe0"); rect(288, 196, 8, 1, "#7b8794"); rect(288, 198, 6, 1, "#7b8794");
  plant(284, 214);
}

// ---- About me: the game on TV, a shelf of books, and a coffee. ----
{
  windowPane(352, HALL_BOTTOM + 5, 14, 18);
  box(314, 186, 16, 8, 8, ...DARKWOOD);
  rect(313, 172, 18, 16, LINE); rect(314, 173, 16, 14, "#3b3f4a"); rect(315, 174, 14, 11, "#141a30");
  rect(315, 180, 14, 5, "#c99a4a"); rect(315, 180, 14, 1, "#e6c06e"); rect(321, 180, 2, 5, "#4f2d7f"); rect(318, 177, 1, 3, "#f4efe0"); rect(326, 176, 1, 4, "#f4efe0");
  rect(320, 188, 4, 1, LINE);
  bookcase(350, 186, 16, 24, 67);
  rug(316, 216, 44, 24, "#6f8a5c", "#546c44");
  sofa(324, 224, 24, "#b0683f");
  box(352, 232, 12, 8, 6, ...WOOD);
  rect(355, 233, 5, 5, LINE); rect(356, 234, 3, 3, "#f2ece0"); rect(356, 234, 3, 1, "#6b4a33");
}

// ---- Wall tops and doorways, drawn last so they sit over everything. ----
cap(0, 0, WIDTH, 4);
cap(0, 0, 4, HEIGHT - 4); cap(WIDTH - 4, 0, 4, HEIGHT - 4);
for (const x of [88, 192, 280]) cap(x, 0, 4, FRONT_TOP);
for (const x of [116, 216, 308]) cap(x, HALL_BOTTOM, 4, FRONT_BOTTOM - HALL_BOTTOM);
cap(0, FRONT_TOP, WIDTH, 4);
cap(0, HALL_BOTTOM - 2, WIDTH, 2);
cap(0, FRONT_BOTTOM, WIDTH, 4);
rect(0, HEIGHT - 4, WIDTH, 4, "#1d1826");

// Doors onto the corridor: a gap with a mat in front of it.
const mat = (x, y) => { rect(x, y, 16, 8, "#6d4a2c"); rect(x + 1, y + 1, 14, 6, "#8a6240"); for (let i = 2; i < 15; i += 2) rect(x + i, y + 2, 1, 4, "#6d4a2c"); };
[36, 132, 228, 316].forEach((x, index) => {
  rect(x, FRONT_TOP, 16, 4, FLOORS_886[index]);
  mat(x, HALL_TOP + 1);
  rect(x - 1, FRONT_TOP, 1, 4, LINE); rect(x + 16, FRONT_TOP, 1, 4, LINE);
});
[52, 164, 252, 332].forEach((x, index) => {
  rect(x, HALL_BOTTOM - 2, 16, 34, FLOORS_LOWER[index]);
  rect(x, HALL_BOTTOM - 2, 16, 3, "#2a223340");
  rect(x - 2, HALL_BOTTOM - 2, 2, 34, LINE); rect(x + 16, HALL_BOTTOM - 2, 2, 34, LINE);
  rect(x - 1, HALL_BOTTOM - 2, 1, 34, "#6d4a2c"); rect(x + 16, HALL_BOTTOM - 2, 1, 34, "#6d4a2c");
  mat(x, HALL_BOTTOM - 9);
});
plant(8, HALL_TOP + 4); plant(348, HALL_TOP + 4);

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
const enlarge = image => {
  const out = canvas(image.width * SAVE_SCALE, image.height * SAVE_SCALE);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const from = (Math.floor(y / SAVE_SCALE) * image.width + Math.floor(x / SAVE_SCALE)) * 4, to = (y * out.width + x) * 4;
    out.data[to] = image.data[from]; out.data[to + 1] = image.data[from + 1]; out.data[to + 2] = image.data[from + 2]; out.data[to + 3] = image.data[from + 3];
  }
  return out;
};
const out = "public/office";
mkdirSync(out, { recursive: true });
for (const file of readdirSync(out)) rmSync(`${out}/${file}`);
const art = {};
for (const [key, image] of Object.entries({ scene, worker: sheet })) {
  const bytes = png(enlarge(image));
  const name = `${key}-${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}.png`;
  writeFileSync(`${out}/${name}`, bytes);
  art[key] = `/office/${name}`;
  console.log(name, bytes.length);
}
writeFileSync("lib/office-art.json", `${JSON.stringify(art, null, 2)}\n`);
