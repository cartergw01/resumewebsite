// Publish the bookshop's renders and projected coordinates for the Writing page.
// node scripts/blender/export_bookshop.mjs .blender-build/bookshop-full
//   -> public/blender/bookshop-*.webp and lib/bookshop.json
import { readFile, writeFile, mkdir } from "node:fs/promises";
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

async function publish(file, name, quality) {
  const image = await sharp(path.join(input, file)).webp({ quality, alphaQuality: 100, effort: 6 }).toBuffer();
  const fingerprint = createHash("sha256").update(image).digest("hex").slice(0, 8);
  const published = `${name}-${fingerprint}.webp`;
  await writeFile(path.join(output, published), image);
  const { width, height } = await sharp(image).metadata();
  return { src: `/blender/${published}`, width, height };
}

const still = await publish("bookshop.png", "bookshop", 90);
const closeups = {};
for (const [area, box] of Object.entries(scene.crops ?? {})) {
  closeups[area] = { ...(await publish(`bookshop-${area}.png`, `bookshop-${area}`, 88)), box };
}
const corners = (key) => {
  if (!scene[key]) throw new Error(`The render has no corners for ${key}`);
  return scene[key];
};
const manifest = {
  width: scene.width,
  height: scene.height,
  still,
  closeups,
  areas: scene.areas,
  // Recorded so a test can tell when content has changed since the render.
  essays: content.essays.map(({ slug, title }) => ({ slug, title, corners: corners(`essay:${slug}`) })),
  readingLists: content.readingLists.map(({ slug, title, year }) => ({ slug, title, year, corners: corners(`reading:${slug}`) })),
  notes: corners("notes"),
  slot: corners("slot"),
};
await writeFile(path.join(root, "lib/bookshop.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Published the bookshop: ${Object.keys(closeups).length} close-ups, ${manifest.essays.length} essays, ${manifest.readingLists.length} reading lists.`);
