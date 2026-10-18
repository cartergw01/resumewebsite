// Export a room's light masks (build_islands.py --time masks) with exactly the
// night still's crop, small and lossless: each RGB image holds three light
// sources' shares of every pixel's light, which ParallaxStill uses to stage
// the room's switch fixture by fixture (lib/light-switch.ts). Also records
// how far each source reaches across the still, for strips whose light runs
// along their length.
// node scripts/blender/export_light_masks.mjs RAW_DIRECTORY writing|projects
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const [input, world] = process.argv.slice(2);
if (!input || !["writing", "projects"].includes(world)) throw new Error("Use: export_light_masks.mjs RAW_DIRECTORY writing|projects");
const root = path.resolve(import.meta.dirname, "../..");
const [x, y, width, height] = JSON.parse(await readFile(path.join(root, "lib/island-cameras.json"), "utf8"))[world].crop;
const { sources, files } = JSON.parse(await readFile(path.join(input, `${world}-light-masks.json`), "utf8"));
const [W, H] = [600, 400];
const output = path.join(root, "public/blender");
const prefix = `light-${world}-`;
const names = [], extents = [];
for (const [index, file] of files.entries()) {
  const source = path.join(input, file);
  const { width: rawWidth } = await sharp(source).metadata();
  const scale = rawWidth / 1200;
  const cropped = sharp(source)
    .extract({ left: Math.round(x * scale), top: Math.round(y * scale), width: Math.round(width * scale), height: Math.round(height * scale) })
    .resize(W, H, { kernel: "lanczos3" })
    .removeAlpha();
  const { data } = await cropped.clone().raw().toBuffer({ resolveWithObject: true });
  // Each source's extent: where most of its light falls, left to right.
  for (let channel = 0; channel < 3 && index * 3 + channel < sources.length; channel++) {
    const columns = new Float64Array(W);
    for (let p = 0; p < W * H; p++) columns[p % W] += data[p * 3 + channel];
    const total = columns.reduce((a, b) => a + b, 0) || 1;
    let sum = 0, left = 0, right = W - 1;
    for (let c = 0; c < W; c++) { sum += columns[c]; if (sum < total * .05) left = c + 1; if (sum <= total * .95) right = c + 1; }
    extents.push([+(left / W).toFixed(3), +(Math.min(right, W - 1) / W).toFixed(3)]);
  }
  const image = await cropped.webp({ lossless: true, effort: 6 }).toBuffer();
  names.push(`${prefix}${index}-${createHash("sha256").update(image).digest("hex").slice(0, 8)}.webp`);
  await writeFile(path.join(output, names.at(-1)), image);
}
for (const file of await readdir(output)) if (file.startsWith(prefix) && !names.includes(file)) await unlink(path.join(output, file));
const manifestPath = path.join(root, "lib/blender-islands.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest[world].lightMasks = { sources, src: names.map(name => `/blender/${name}`), extents };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Exported ${world} light masks (${sources.join(", ")}) as ${names.join(", ")}`);
