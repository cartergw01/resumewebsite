// Publish the walk-along bookshop's renders and coordinates for the Writing page.
// node scripts/blender/export_bookshop.mjs .blender-build/bookshop
//   -> public/blender/bookshop-*.webp and lib/bookshop.json
//
// The long back render is cut into tiles, so the page loads the shop as you
// walk it. The foreground pass is cut into its pieces (they move separately),
// and each book is cut out on its own so it can lean out of the shelf.
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const [input] = process.argv.slice(2);
if (!input) throw new Error("Pass the bookshop render directory.");
const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, "public/blender");
await mkdir(output, { recursive: true });
const scene = JSON.parse(await readFile(path.join(input, "bookshop.json"), "utf8"));
const content = JSON.parse(await readFile(path.join(root, ".blender-build/bookshop-content.json"), "utf8"));

// Old bookshop files go first: every publish is a complete set.
for (const name of await readdir(output)) if (name.startsWith("bookshop-")) await unlink(path.join(output, name));

const published = [];
async function publish(image, name, quality) {
  const buffer = await image.webp({ quality, alphaQuality: 100, effort: 6 }).toBuffer();
  const fingerprint = createHash("sha256").update(buffer).digest("hex").slice(0, 8);
  const file = `bookshop-${name}-${fingerprint}.webp`;
  await writeFile(path.join(output, file), buffer);
  published.push(file);
  return `/blender/${file}`;
}
const area = (rect) => {
  const [l, t, r, b] = rect.map(Math.round);
  return { left: Math.max(0, l), top: Math.max(0, t), width: Math.min(scene.width, r) - Math.max(0, l), height: Math.min(scene.height, b) - Math.max(0, t) };
};

const back = path.join(input, "bookshop-back.png");
const fore = path.join(input, "bookshop-fore.png");
const TILE = 1400;
const tiles = [];
for (let x = 0; x < scene.width; x += TILE) {
  const width = Math.min(TILE, scene.width - x);
  tiles.push({ x, width, src: await publish(sharp(back).extract({ left: x, top: 0, width, height: scene.height }), `tile-${tiles.length}`, 84) });
}
const pieces = {};
for (const [name, rect] of Object.entries(scene.fore)) {
  const box = area(rect);
  pieces[name] = { rect: [box.left, box.top, box.left + box.width, box.top + box.height], foot: scene.feet[name], src: await publish(sharp(fore).extract(box), name.replace(":", "-"), 86) };
}
// Which foreground piece holds each reading list, so its target moves with it.
const pieceAt = (rect) => Object.entries(pieces).find(([, piece]) => rect[0] >= piece.rect[0] && rect[2] <= piece.rect[2] && rect[1] >= piece.rect[1] && rect[3] <= piece.rect[3])?.[0] ?? null;

const item = async (key, kind) => {
  const rect = scene.items[key];
  if (!rect) throw new Error(`The render has nothing for ${key}`);
  const layer = kind === "reading" ? pieceAt(rect) : null;
  const sprite = kind === "notes" || kind === "letters" ? null
    : await publish(sharp(layer ? fore : back).extract(area(rect)), key.replace(":", "-"), 88);
  return { rect, layer, sprite };
};
const manifest = {
  width: scene.width,
  height: scene.height,
  tiles,
  pieces,
  bays: scene.bays,
  essays: await Promise.all(content.essays.map(async ({ slug, title, date }) => ({ slug, title, date, ...(await item(`essay:${slug}`, "essay")) }))),
  readingLists: await Promise.all(content.readingLists.map(async ({ slug, title, year, date }) => ({ slug, title, year, date, ...(await item(`reading:${slug}`, "reading")) }))),
  notes: (await item("notes", "notes")).rect,
  letters: (await item("letters", "letters")).rect,
};
await writeFile(path.join(root, "lib/bookshop.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Published the bookshop: ${tiles.length} tiles, ${Object.keys(pieces).length} foreground pieces, ${published.length} files.`);
