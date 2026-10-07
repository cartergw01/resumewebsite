// Crop each island's depth map exactly like its still and publish it for the
// browser's parallax. node scripts/blender/export_depth.mjs RAW_DEPTH_DIRECTORY
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const [input] = process.argv.slice(2);
if (!input) throw new Error("Pass the raw depth render directory.");
const root = path.resolve(import.meta.dirname, "../..");
const crops = JSON.parse(await readFile(path.join(root, "lib/island-orbit-assets.json"), "utf8"));
const manifestPath = path.join(root, "lib/blender-islands.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const output = path.join(root, "public/blender");
for (const world of ["work", "writing", "projects"]) {
  const source = path.join(input, `${world}.png`);
  const [x, y, width, height] = crops[world].crop;
  const { width: rawWidth } = await sharp(source).metadata();
  const scale = rawWidth / 1200;
  // Depth stays smooth, so a 900px map is plenty; alpha marks the island.
  const image = await sharp(source)
    .extract({ left: Math.round(x * scale), top: Math.round(y * scale), width: Math.round(width * scale), height: Math.round(height * scale) })
    .resize(900, 600)
    .webp({ quality: 90, alphaQuality: 90, effort: 6 })
    .toBuffer();
  const name = `depth-${world}-${createHash("sha256").update(image).digest("hex").slice(0, 8)}.webp`;
  for (const file of await readdir(output)) if (file.startsWith(`depth-${world}-`) && file !== name) await unlink(path.join(output, file));
  await writeFile(path.join(output, name), image);
  manifest[world].depthSrc = `/blender/${name}`;
  console.log(`${world}: ${name} (${(image.length / 1024).toFixed(0)} KB)`);
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
