// Draws the Work page's office as pixel art, one rectangle at a time: no image
// models, no source art. Run `node scripts/office/draw_office.mjs` after editing.
// Seats, doors and collision bounds live in lib/office-plan.ts and must match.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import sharp from "sharp";

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
  H: "10001 10001 10001 11111 10001 10001 10001", X: "10001 10001 01010 00100 01010 10001 10001",
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
const screens = canvas(WIDTH, HEIGHT);
let target = scene;
const rect = (...args) => target.rect(...args);
const dot = (...args) => target.dot(...args);

// Real marks and the real batch photo, brought down to the art's own pixels.
async function mark(file, size) {
  const { data, info } = await sharp(file, { density: 400 }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return (x, y, color) => { for (let j = 0; j < info.height; j++) for (let i = 0; i < info.width; i++) if (data[(j * info.width + i) * 4 + 3] > 70) dot(x + i, y + j, color); };
}
async function photo(file, width, height) {
  const { data, info } = await sharp(file).resize(width, height, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const hex = v => v.toString(16).padStart(2, "0");
  return (x, y) => { for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) { const at = (j * width + i) * info.channels; dot(x + i, y + j, `#${hex(data[at])}${hex(data[at + 1])}${hex(data[at + 2])}`); } };
}
const contraryMark = await mark("public/logos/contrary.svg", 12);
const slugMark = await mark("public/logos/slug-fund.svg", 12);
const korobraMark = await mark("public/logos/korobra-capital.png", 12);
const batchPhoto = await photo("public/ikigai-batch.jpg", 15, 11);
const logo886 = await mark("public/logos/886-studios.png", 32);

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
head.leftBuzz = [".....kkkkkk.....", "....kHHHHHHk....", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...ksHHHHHHHk...", "...kssssSHHHk...", "...kssssSHHHk...", "...kesssSSHHk...", "...kssssssHHk...", "....kssssssk....", ".....kkkkkk....."];
head.downLong = [".....kkkkkk.....", "....kHHHHHHk....", "...kHHhHHhHHk...", "...kHhHkkHhHk...", "...kHHHssHHHk...", "...kHHssssHHk...", "...kHssssssHk...", "...kHseSSesHk...", "...kHssssssHk...", "...kHkssSskHk...", "....kkkkkkkk...."];
head.upBuzz = [".....kkkkkk.....", "....kHHHHHHk....", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kssssssssk...", "....kssssssk....", ".....kkkkkk....."];
head.upLong = [".....kkkkkk.....", "....kHHHHHHk....", "...kHHhHHhHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "...kHHHHHHHHk...", "....kkkkkkkk...."];
const tankTop = ["....kkkkkkkk....", "...ksTTTTTTsk...", "..kssTTTTTTssk..", "..kskTTTTTTksk..", "..ksskTTTTkssk..", "..kkkkTTTTkkkk.."];
const seatedLegs = { down: ["....kPPPPPPk....", "....kkkkkkkk...."], left: ["..kPPPPPPPPk....", "..kkkkkkkkkk...."] };
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
// ---- A person, standing or sitting, in any colours: the same sprite as the man's. ----
const person = (x, y, view, colors, { mirror = false, seated = false, tank = false } = {}) => {
  const base = view.startsWith("left") ? "left" : view.startsWith("up") ? "up" : "down";
  const lower = seated ? seatedLegs[base] ?? [] : legs[base === "left" ? "left" : "front"].stand;
  const rows = [...head[view], ...(tank ? tankTop : body[base]), ...lower];
  const inks = { ...palette, ...colors };
  if (!seated) rect(x - 6, y - 1, 13, 3, "#2a223340");
  rows.forEach((line, j) => [...(mirror ? [...line].reverse().join("") : line)].forEach((c, i) => {
    if (c !== ".") dot(x - 8 + i, y - rows.length + 1 + j, inks[c]);
  }));
};

// ---- Floors and walls ----
const FLOOR_TOP = 36, FRONT_TOP = 116, HALL_TOP = 120, HALL_BOTTOM = 152, FLOOR_BOTTOM = 184, FRONT_BOTTOM = 264;
const PURPLE = "#6d35d8", CONTRARY = "#184df6";

// A room's name is inlaid in its floor: a darker or lighter shade of the floor
// itself with a lit lower edge, under the furniture and under the night.
function inlay(lines, cx, y, base, roomWidth, lighter = false) {
  // Still the floor's own lettering, but as close to black or white as it will go.
  const ink = lighter ? "#fbf6e6" : "#15101a", edge = shade(base, lighter ? -24 : 34);
  lines.forEach((line, index) => {
    if (wide(line) > roomWidth - 6) throw new Error(`"${line}" (${wide(line)}) is too wide for a ${roomWidth} room`);
    const x = cx - Math.floor(wide(line) / 2), row = y + index * 10;
    text(scene, line, x, row + 1, edge);
    text(scene, line, x, row, ink);
  });
}

// 886 Studios: natural materials. Purple is kept for what carries the brand: the
// sign, the trim along the wall, the pitch, one sofa and one of the people.
const FLOORS_886 = ["#d8b98c", "#a7abb6", "#d9b78e", "#46303a"];
planks(4, FLOOR_TOP, 84, 80, FLOORS_886[0], "#c2a274");
carpet(92, FLOOR_TOP, 100, 80, FLOORS_886[1], "#9a9eaa");
checker(196, FLOOR_TOP, 84, 80, FLOORS_886[2], "#cda97e");
planks(284, FLOOR_TOP, 84, 80, FLOORS_886[3], "#39262f", 6);
logo886(12, 77, "#6d35d8d8"); // 886's mark, set into the floor.
// The office: cream paneling. Demo day: a dark hall. The scouts: a neighbourhood cafe. Community: a dark brick bar.
wallFace(4, 4, 84, 32, "#f4eddc", "#ebe2cd", PURPLE, "#4d22a0");
wallFace(92, 4, 100, 32, "#2c3040", "#272b3a", PURPLE, "#4d22a0");
wallFace(196, 4, 84, 32, "#e6dcc4", "#dcd1b6", PURPLE, "#4d22a0");
wallFace(284, 4, 84, 32, "#3c2530", "#3c2530", PURPLE, "#4d22a0");
for (let j = 6; j < 28; j += 4) { rect(284, j + 3, 84, 1, "#2c1a24"); for (let i = (j % 8 ? 2 : 8); i < 84; i += 12) rect(284 + i, j, 1, 4, "#2c1a24"); }
// The stage, raised along the front of the hall.
rect(92, FLOOR_TOP, 100, 21, "#b78f63"); for (let j = 0; j < 21; j += 5) rect(92, FLOOR_TOP + j, 100, 1, "#a27c52"); for (let i = 8; i < 100; i += 16) rect(92 + i, FLOOR_TOP, 1, 21, "#a27c52");
rect(92, FLOOR_TOP + 21, 100, 4, "#6f5236"); rect(92, FLOOR_TOP + 21, 100, 1, "#8d6c4b"); rect(92, FLOOR_TOP + 25, 100, 2, "#2a223340");

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
inlay(["Community", "& content"], 326, 97, FLOORS_886[3], 84, true);
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
  windowPane(6, 8, 13, 18);
  frame(68, 8, 19, 15, (x, y) => batchPhoto(x, y)); // The ikigai batch.
  rug(50, 76, 36, 36, "#b89a72", "#9c7f58");
  chair(62, 78, SEAT);
  box(58, 91, 20, 8, 6, ...WOOD);
  rect(61, 93, 4, 3, "#f4efe0"); rect(70, 92, 4, 4, LINE); rect(71, 93, 2, 2, "#f2ece0");
  chair(62, 101, SEAT);
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
  // Kai and Kevin at the front. Patryk, Max and Jimmy in the audience, turned to the stage.
  person(136, 52, "down", { H: "#1f1b22", h: "#3a3340", f: "#3a3340", T: "#b5433a", t: "#d3665c", P: "#2c303a", p: "#3f4452" });
  person(152, 52, "down", { H: "#191519", h: "#3a3340", f: "#3a3340", T: PURPLE, t: "#8b5cf6", P: "#2f3a4f", p: "#435069" });
  for (const y of [62, 82]) for (const x of [97, 111, 157, 171]) chair(x, y, "#3d4254");
  const audience = (chairX, chairY, view, colors) => {
    person(chairX + 6, chairY + 7, view, colors, { seated: true });
    rect(chairX, chairY + 7, 12, 5, LINE); rect(chairX + 1, chairY + 8, 10, 3, "#3d4254"); rect(chairX + 1, chairY + 8, 10, 1, shade("#3d4254", 30));
  };
  audience(97, 62, "up", { H: "#141216", h: "#2e2a32", f: "#242026", s: "#ecc8a0", S: "#d2a97e", T: "#2f6fd0", t: "#5b93e6" }); // Max
  audience(111, 62, "up", { H: "#6b4a2e", h: "#8a6642", f: "#5c4028", s: "#f7dcc6", S: "#e4bda0", T: "#f4f4ef", t: "#ffffff" }); // Patryk
  audience(157, 62, "up", { H: "#1f1b22", h: "#3a3340", f: "#2a2630", s: "#e9c49c", S: "#cfa67c", T: "#5c6b7a", t: "#76879a" }); // Jameson
  audience(171, 62, "up", { H: "#2b2230", h: "#4b3a44", f: "#6b6470", s: "#e9c49c", S: "#cfa67c", T: "#7a3b3b", t: "#955050" }); // Chris
  audience(157, 82, "upBuzz", { H: "#e6cd80", h: "#f2e2a6", f: "#e6cd80", s: "#f5d6bc", S: "#e0b698", T: "#4a5568", t: "#63708a" }); // Jimmy
  audience(171, 82, "up", { H: "#3a2a22", h: "#5c4436", f: "#3a2a22", s: "#dcb190", S: "#c0926c", T: "#3e8f83", t: "#59ad9f" }); // Someone from the batch, next to him.
  // Ginny and Freya, in the back row.
  audience(97, 82, "upLong", { H: "#241c1a", h: "#42332e", s: "#ecc8a0", S: "#d2a97e", T: "#1f5a3a", t: "#2f7a50" });
  audience(111, 82, "upLong", { H: "#2e2320", h: "#4c3a34", s: "#ecc8a0", S: "#d2a97e", T: "#1c1c22", t: "#35353e" });
}

// ---- Finding founders: a cafe, where most of it really happens. ----
{
  const WOODEN = "#a9764a";
  // A round table on one leg, with room for what's on it.
  const cafeTable = (x, y, w = 20) => {
    rect(x + 3, y + 19, w - 4, 2, "#2a223340");
    rect(x + Math.floor(w / 2) - 1, y + 9, 3, 9, "#3a3038");
    rect(x + Math.floor(w / 2) - 5, y + 17, 11, 2, "#3a3038");
    rect(x + 2, y, w - 4, 11, LINE); rect(x, y + 2, w, 7, LINE);
    rect(x + 2, y + 1, w - 4, 9, "#f6f2e8"); rect(x + 1, y + 3, w - 2, 5, "#f6f2e8");
    rect(x + 3, y + 1, w - 6, 1, "#ffffff"); rect(x + 2, y + 9, w - 4, 1, "#d8d2c2");
  };
  // Big windows onto the night, with the pipeline board between them.
  windowPane(199, 7, 26, 21);
  windowPane(251, 7, 26, 21);
  rect(227, 7, 22, 21, LINE); rect(228, 8, 20, 19, "#2a3a33");
  [[4, "#e9e4d4"], [3, "#c9d3c6"], [2, "#b8c4bc"], [1, "#e7c693"]].forEach(([count, color], column) => {
    for (let row = 0; row < count; row++) rect(229 + column * 5, 10 + row * 4, 3, 2, color);
  });
  // The counter, with an espresso machine, a grinder and a stack of cups.
  box(198, 38, 34, 10, 12, "#e9dfc9", "#8a5f3c");
  rect(201, 30, 14, 12, LINE); rect(202, 31, 12, 10, "#c9d0d6"); rect(202, 31, 12, 2, "#eef2f4"); rect(204, 36, 2, 3, LINE); rect(209, 36, 2, 3, LINE); rect(203, 34, 10, 1, "#7b8794");
  rect(217, 29, 6, 13, LINE); rect(218, 30, 4, 4, "#6b4a33"); rect(218, 34, 4, 7, "#3a3f46");
  for (const j of [0, 2, 4]) { rect(226, 40 - j, 4, 2, LINE); rect(227, 40 - j, 2, 1, "#f2ece0"); }
  // The scout's table: a laptop with the agent running, and a coffee.
  cafeTable(206, 62);
  rect(210, 55, 12, 8, LINE); rect(211, 56, 10, 6, "#0d2a22"); rect(212, 57, 5, 1, "#7bffb0"); rect(212, 59, 7, 1, "#7bffb0");
  rect(209, 63, 14, 3, LINE); rect(210, 64, 12, 1, "#d7dbe0");
  rect(222, 66, 3, 3, LINE); rect(223, 67, 1, 1, "#f2ece0");
  // The coffee chat: an empty chair across the table from a founder.
  chair(235, 62, WOODEN);
  chair(265, 62, WOODEN);
  person(271, 71, "left", { H: "#2a1f1c", h: "#4a3a34", f: "#3a2c28", s: "#e4bb92", S: "#c99e76", T: "#3e8f83", t: "#59ad9f", P: "#42485a", p: "#565d72" }, { seated: true });
  cafeTable(247, 62, 18);
  for (const x of [250, 258]) { rect(x, 64, 4, 4, LINE); rect(x + 1, 65, 2, 2, "#f2ece0"); rect(x + 1, 65, 2, 1, "#6b4a33"); }
  // Plants: a tall one by the window, one in the corner, a trailing one on the counter.
  plant(263, 26);
  plant(198, 88);
  for (const [x, y] of [[230, 34], [232, 36], [231, 38], [229, 36]]) rect(x, y, 3, 3, "#4fb56f");
}

// ---- Community & content: a good bar. Neon, bottles, stools, and a velvet booth. ----
{
  // The back bar: lit shelves of bottles under a neon 886.
  rect(286, 21, 36, 15, "#1c1118"); rect(286, 21, 36, 1, "#e7a35a"); rect(286, 28, 36, 1, "#7a4a2c");
  const bottles = ["#3f9b5e", "#c9832f", "#d8d2bf", "#7a4f9a", "#b5473c", "#2f6f8f", "#c9a23a", "#3f9b5e"];
  bottles.forEach((color, i) => {
    rect(288 + i * 4, 23, 3, 5, color); rect(289 + i * 4, 22, 1, 1, color);
    rect(288 + i * 4, 30, 3, 5, bottles[(i + 3) % 8]); rect(289 + i * 4, 29, 1, 1, bottles[(i + 3) % 8]);
  });
  const neonX = 304 - Math.floor(wide("886", 2) / 2);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(scene, "886", neonX + dx, 6 + dy, "#c084fc66", 2);
  text(scene, "886", neonX, 6, "#f3e8ff", 2);
  // The bartender, behind it, in a white tank top.
  person(304, 46, "downLong", { H: "#2a1a18", h: "#4a2f28", s: "#f0caa4", S: "#d6a980", T: "#ffffff", P: "#1c1c22", p: "#2c2c34" }, { tank: true });
  // The bar itself: dark wood, a brass rail, a strip of light under the lip.
  box(286, 38, 38, 10, 12, "#6a4632", "#2a1a22");
  rect(287, 50, 36, 1, "#c084fc"); rect(287, 57, 36, 1, "#b08a4a");
  rect(290, 34, 3, 7, LINE); rect(291, 35, 1, 5, "#c9d0d6"); // A shaker.
  for (const [x, color] of [[298, "#e7a35a"], [305, "#d9536f"], [312, "#8fd3c7"]]) { rect(x, 41, 4, 5, LINE); rect(x + 1, 42, 2, 3, color); rect(x + 1, 42, 2, 1, "#ffffff55"); }
  // Stools along the bar.
  for (const x of [288, 302, 316]) {
    rect(x + 1, 69, 7, 2, "#1c111840");
    rect(x + 3, 64, 2, 6, "#b08a4a");
    rect(x, 60, 8, 5, LINE); rect(x + 1, 61, 6, 3, "#8c2f3f"); rect(x + 1, 61, 6, 1, "#b84a5a");
  }
  // Pendant lights, warm pools on the bar and the floor.
  for (const x of [297, 313]) {
    rect(x, 21, 1, 9, "#14090f");
    rect(x - 3, 30, 7, 4, LINE); rect(x - 2, 31, 5, 2, "#e7a35a"); rect(x - 1, 33, 3, 1, "#fff0c4");
    for (const [w, h, y, alpha] of [[22, 9, 41, "22"], [14, 6, 43, "22"]]) rect(x - Math.floor(w / 2), y, w, h, `#ffd99a${alpha}`);
  }
  // The booth, in the brand's purple velvet, with its table.
  sofa(336, 40, 30, PURPLE);
  box(344, 60, 14, 6, 3, "#1c1118", "#120a10");
  rect(347, 58, 3, 4, "#e7a35a"); rect(353, 58, 3, 4, "#d9536f");
  // Founders: two on the sofa, the rest talking around the room.
  ([
    [344, 58, "down", { H: "#3a2a22", h: "#5c4436", f: "#3a2a22", T: "#3e8f83", t: "#59ad9f" }, { seated: true }],
    [358, 58, "downLong", { H: "#2a1f1c", h: "#4a3a34", s: "#e9c49c", S: "#cfa67c", T: "#d9a441", t: "#efc56c", P: "#42485a", p: "#565d72" }, { seated: true }],
    [296, 74, "down", { H: "#1f1b22", h: "#3a3340", f: "#1f1b22", s: "#d8a884", S: "#b98a68", T: "#c9683e", t: "#e0875e", P: "#2c303a", p: "#3f4452" }, {}],
    [312, 82, "left", { H: "#141216", h: "#2e2a32", f: "#242026", T: "#e8e2d2", t: "#ffffff", P: "#51607a", p: "#687994" }, {}],
    [294, 94, "up", { H: "#7a4a2a", h: "#9c6a42", f: "#7a4a2a", s: "#f4d4b4", S: "#dcb492", T: "#55703f", t: "#6f8f55", P: "#42485a", p: "#565d72" }, {}],
    [340, 84, "left", { H: "#3a2a22", h: "#5c4436", f: "#3a2a22", s: "#c9976f", S: "#ab7c56", T: "#26415f", t: "#3b5f86", P: "#3a3f4b", p: "#4d5362" }, { mirror: true }],
    [358, 84, "left", { H: "#141216", h: "#2e2a32", f: "#242026", T: "#a8506a", t: "#c56c86", P: "#2f3a4f", p: "#435069" }, {}],
    [292, 65, "up", { H: "#2a1f1c", h: "#4a3a34", f: "#3a2c28", T: "#7a4f9a", t: "#9568b5" }, { seated: true }],
    [320, 65, "upLong", { H: "#6b4a2e", h: "#8a6642", T: "#c9a23a", t: "#dfbb58" }, { seated: true }],
    [332, 70, "left", { H: "#1f1b22", h: "#3a3340", f: "#1f1b22", s: "#e4bb92", S: "#c99e76", T: "#3f6f8f", t: "#5a8bab", P: "#2c303a", p: "#3f4452" }, { mirror: true }],
    [361, 96, "left", { H: "#3a2a22", h: "#5c4436", f: "#3a2a22", T: "#b5573a", t: "#cf7458", P: "#42485a", p: "#565d72" }, {}],
  ]).forEach(([x, y, view, colors, options]) => person(x, y, view, colors, options));
  for (const [x, y, color] of [[303, 64, "#e7a35a"], [304, 72, "#d9536f"], [283 + 19, 84, "#8fd3c7"], [350, 74, "#e7a35a"], [351, 74, "#e7a35a"]]) { rect(x, y, 3, 4, LINE); rect(x + 1, y + 1, 1, 2, color); }
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
  box(46, 232, 24, 10, 6, ...DARKWOOD);
  rect(49, 227, 16, 16, LINE); rect(50, 228, 14, 14, CONTRARY); contraryMark(51, 229, "#ffffff"); // A bound report.
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
  for (const x of [139, 186]) { rect(x, 220, 16, 16, LINE); rect(x + 1, 221, 14, 14, "#e7c693"); slugMark(x + 2, 222, "#1c2c50"); }
  paperStack(160, 230, 3); paperStack(173, 230, 2);
}

// ---- Korobra Capital & side projects: a desk for each. Stocks, code, writing. ----
{
  frame(228, HALL_BOTTOM + 4, 22, 20, (x, y, w, h) => { rect(x, y, w, h, "#10202c"); climbing("#ffcf6e")(x + 1, y + 1, w - 2, h - 2); });
  frame(274, HALL_BOTTOM + 4, 28, 20, codeLines);
  // The fund's desk, with the market up on the PC.
  desk(224, 190, 26, 14);
  // The fund's mark, and nothing else, on its monitor.
  monitor(227, 177, 20, 14, (x, y, w, h) => { rect(x, y, w, h, "#0b1424"); korobraMark(x + 3, y, "#efe7d4"); });
  rect(231, 196, 12, 4, LINE); rect(232, 197, 10, 2, "#d7dbe0");
  chair(231, 208, SEAT);
  // The coding desk.
  desk(274, 190, 28, 14, DARKWOOD);
  monitor(280, 179, 16, 12, codeLines);
  rect(282, 196, 12, 4, LINE); rect(283, 197, 10, 2, "#d7dbe0");
  rect(297, 196, 3, 4, LINE); rect(298, 197, 1, 2, "#f2ece0");
  chair(282, 208, SEAT);
  // The writing table: an open notebook, a pen, a lamp, and pages in a stack.
  desk(224, 226, 36, 10, ["#e0c49a", "#a98a5e"]);
  rect(234, 227, 15, 8, LINE); rect(235, 228, 6, 6, "#f8f1e0"); rect(242, 228, 6, 6, "#efe6cf"); rect(241, 228, 1, 6, "#b9ab8c");
  for (const j of [229, 231, 233]) { rect(236, j, 4, 1, "#7b8794"); rect(243, j, 4, 1, "#7b8794"); }
  rect(250, 229, 6, 1, "#26415f"); rect(255, 228, 1, 1, "#d9a441");
  rect(226, 224, 7, 7, LINE); rect(227, 225, 5, 2, "#e7c693"); rect(229, 227, 1, 3, "#3a3f46");
  chair(261, 228, SEAT);
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

// ---- What changes when he walks up: a second layer, shown one piece at a time. ----
target = screens;
{
  const GREEN = "#4fd08a", RED = "#ef6461";
  // 886's desk: the deck turns into a signed-off page.
  rect(43, 38, 14, 11, "#ffffff"); rect(44, 39, 12, 2, PURPLE); rect(44, 42, 9, 1, "#7b8794"); rect(44, 44, 7, 1, "#7b8794"); rect(50, 46, 6, 2, "#e7c693");
  // The scout: a match comes up on the terminal.
  rect(211, 56, 10, 6, "#0d2a22"); rect(212, 56, 8, 2, "#7bffb0"); rect(212, 59, 8, 1, "#7bffb0"); rect(212, 61, 5, 1, "#3fae74");
  // Slug Fund's left desk: the book and the mix become price and volume.
  rect(129, 187, 12, 10, "#0b1424"); [[1, 5, 3, 1], [4, 3, 4, 0], [7, 2, 4, 1], [10, 1, 5, 1]].forEach(([i, y, h, up]) => rect(129 + i, 187 + y, 2, h, up ? GREEN : RED));
  rect(143, 187, 12, 10, "#0b1424"); [2, 4, 3, 6, 5, 8].forEach((h, i) => rect(144 + i * 2, 197 - h, 1, h, "#6b97ff"));
  // The right desk: headlines and the curve become the tape and a sector table.
  rect(185, 187, 12, 10, "#0b1424"); for (let j = 1; j < 10; j += 3) { rect(186, 187 + j, 4, 1, GREEN); rect(191, 187 + j, 5, 1, j === 4 ? RED : GREEN); }
  rect(199, 187, 12, 10, "#0b1424"); [[0, 0, 5, 4, GREEN], [6, 0, 6, 4, RED], [0, 5, 7, 5, RED], [8, 5, 4, 5, GREEN]].forEach(([a, b, c, d, color]) => rect(199 + a, 187 + b, c, d, color));
  // The coding desk: the code runs.
  rect(281, 180, 14, 10, "#0d2a22"); for (let j = 1; j < 9; j += 2) rect(282, 180 + j, 10 - (j % 4), 1, "#7bffb0");

  // The Contrary reports: walk up and the cover has the company's name on it.
  const report = (cx, y, name) => {
    const width = wide(name) + 8, x = cx - Math.floor(width / 2);
    rect(x + 1, y + 16, width, 2, "#2a223340");
    rect(x, y, width, 16, LINE); rect(x + 1, y + 1, width - 2, 14, "#fbf7ec"); rect(x + 1, y + 1, width - 2, 3, CONTRARY);
    text(screens, name, x + 4, y + 6, "#14213d");
  };
  report(28, 170, "Shield AI");
  report(95, 170, "SpaceX");
  report(28, 188, "Turo");
  report(95, 192, "Chime");
  report(24, 222, "Hive");
}
target = scene;

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
for (const [key, image] of Object.entries({ scene, screens, worker: sheet })) {
  const bytes = png(enlarge(image));
  const name = `${key}-${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}.png`;
  writeFileSync(`${out}/${name}`, bytes);
  art[key] = `/office/${name}`;
  console.log(name, bytes.length);
}
writeFileSync("lib/office-art.json", `${JSON.stringify(art, null, 2)}\n`);
