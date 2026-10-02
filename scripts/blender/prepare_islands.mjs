// Remove excess transparent camera margin consistently from renders, animation
// frames and interaction coordinates. Keep an 88% fit inside the 3:2 art box.
// node scripts/blender/prepare_islands.mjs RAW_DIRECTORY WEB_DIRECTORY
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output || path.resolve(input) === path.resolve(output)) {
  throw new Error("Pass different raw-render and prepared-output directories.");
}
await mkdir(output, { recursive: true });
for (const world of ["work", "writing", "projects"]) {
  const source = path.join(input, `${world}.png`);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] < 16) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  // Quantise the crop on the 1200x800 coordinate grid so both 1920px stills
  // and 1200px video frames receive precisely the same crop without rounding.
  const scale = info.width / 1200;
  const width = Math.min(1200, Math.ceil(Math.max((right - left + 1) / scale / 0.88, (bottom - top + 1) / scale * 1.5 / 0.88) / 15) * 15);
  const height = width * 2 / 3;
  const x = Math.max(0, Math.min(1200 - width, Math.round(((left + right) / scale / 2 - width / 2) / 5) * 5));
  const y = Math.max(0, Math.min(800 - height, Math.round(((top + bottom) / scale / 2 - height / 2) / 5) * 5));
  const crop = factor => ({ left: Math.round(x * factor), top: Math.round(y * factor), width: Math.round(width * factor), height: Math.round(height * factor) });
  await sharp(source).extract(crop(scale)).resize(info.width, info.height).png().toFile(path.join(output, `${world}.png`));
  const metadata = JSON.parse(await readFile(path.join(input, `${world}.json`), "utf8"));
  const project = ([px, py]) => [Number(((px - x) / width * 1200).toFixed(3)), Number(((py - y) / height * 800).toFixed(3))];
  for (const [key, value] of Object.entries(metadata)) {
    if (!Array.isArray(value)) continue;
    metadata[key] = Array.isArray(value[0]) ? value.map(project) : project(value);
  }
  await writeFile(path.join(output, `${world}.json`), JSON.stringify(metadata, null, 2) + "\n");
  if (world === "writing") {
    const frames = path.join(input, "writing-frames");
    const files = (await readdir(frames)).filter(name => /^\d+\.png$/.test(name));
    if (files.length !== 48) throw new Error(`Expected 48 Writing frames, received ${files.length}`);
    const destination = path.join(output, "writing-frames");
    await mkdir(destination, { recursive: true });
    for (const file of files) await sharp(path.join(frames, file)).extract(crop(1)).resize(1200, 800).png().toFile(path.join(destination, file));
  }
  console.log(`${world}: cropped ${width}×${height} at ${x},${y}; artwork and anchors aligned`);
}
