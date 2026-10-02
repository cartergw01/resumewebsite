// Convert the Blender renders and their projected anchors into website assets.
// node scripts/blender/export_islands.mjs /tmp/carter-islands
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const input = process.argv[2];
if (!input) throw new Error("Pass the Blender render output directory.");
const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, "public/blender");
await mkdir(output, { recursive: true });
const metadata = {};
for (const world of ["work", "writing", "projects"]) {
  metadata[world] = JSON.parse(await readFile(path.join(input, `${world}.json`), "utf8"));
  const image = await sharp(path.join(input, `${world}.png`))
    .webp({ quality: 91, alphaQuality: 100, effort: 6 })
    .toBuffer();
  const fingerprint = createHash("sha256").update(image).digest("hex").slice(0, 8);
  const name = `island-${world}-${fingerprint}.webp`;
  await writeFile(path.join(output, name), image);
  metadata[world].src = `/blender/${name}`;
}
// Fingerprint both loop formats together so a re-render cannot leave browsers
// displaying an older scene over the new still and interaction coordinates.
const loops = await Promise.all(["mov", "webm"].map(async (extension) => ({
  extension,
  buffer: await readFile(path.join(input, `writing-loop.${extension}`)),
})));
const videoHash = createHash("sha256");
for (const { buffer } of loops) videoHash.update(buffer);
const videoFingerprint = videoHash.digest("hex").slice(0, 8);
metadata.writing.video = {};
for (const { extension, buffer } of loops) {
  const name = `writing-loop-${videoFingerprint}.${extension}`;
  await writeFile(path.join(output, name), buffer);
  metadata.writing.video[extension] = `/blender/${name}`;
}
await writeFile(path.join(root, "lib/blender-islands.json"), JSON.stringify(metadata, null, 2) + "\n");
console.log("Exported three transparent Blender renders, the Writing loop, and matching interaction anchors.");
