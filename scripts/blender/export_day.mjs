// Export Work's daytime still with exactly the night render's crop, so both
// share one set of interaction anchors and the toggle is a pure crossfade.
// node scripts/blender/export_day.mjs RAW_DAY_DIRECTORY
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const [input] = process.argv.slice(2);
if (!input) throw new Error("Pass the raw daytime render directory.");
const root = path.resolve(import.meta.dirname, "../..");
const [x, y, width, height] = JSON.parse(await readFile(path.join(root, "lib/island-orbit-assets.json"), "utf8")).work.crop;
const source = path.join(input, "work.png");
const { width: rawWidth, height: rawHeight } = await sharp(source).metadata();
const scale = rawWidth / 1200;
const image = await sharp(source)
  .extract({ left: Math.round(x * scale), top: Math.round(y * scale), width: Math.round(width * scale), height: Math.round(height * scale) })
  .resize(rawWidth, rawHeight)
  .webp({ quality: 91, alphaQuality: 100, effort: 6 })
  .toBuffer();
const name = `island-work-day-${createHash("sha256").update(image).digest("hex").slice(0, 8)}.webp`;
const output = path.join(root, "public/blender");
for (const file of await readdir(output)) if (/^island-work-day-.*\.webp$/.test(file) && file !== name) await unlink(path.join(output, file));
await writeFile(path.join(output, name), image);
const manifestPath = path.join(root, "lib/blender-islands.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.work.daySrc = `/blender/${name}`;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Exported Work daytime still ${name} with crop ${x},${y} ${width}×${height}`);
