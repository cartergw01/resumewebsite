// Convert the Blender renders and their projected anchors into website assets.
// node scripts/blender/export_islands.mjs /tmp/carter-islands [--world work]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const [input, flag, selectedWorld] = process.argv.slice(2);
const allWorlds = ["work", "writing", "projects"];
if ((flag && flag !== "--world") || (flag && !allWorlds.includes(selectedWorld)) || process.argv.length > 5) {
  throw new Error("Use --world work, writing, or projects, or omit it to export all worlds.");
}
if (!input) throw new Error("Pass the Blender render output directory.");
const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, "public/blender");
await mkdir(output, { recursive: true });
const manifest = path.join(root, "lib/blender-islands.json");
const metadata = selectedWorld ? JSON.parse(await readFile(manifest, "utf8")) : {};
const worlds = selectedWorld ? [selectedWorld] : allWorlds;
for (const world of worlds) {
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
// The site no longer plays the Writing loop (depth parallax replaced it), but
// the exporter still publishes one if a render provides it.
const { existsSync } = await import("node:fs");
if (worlds.includes("writing") && existsSync(path.join(input, "writing-loop.webm"))) {
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
}
await writeFile(manifest, JSON.stringify(metadata, null, 2) + "\n");
console.log(`Exported ${worlds.join(", ")} artwork and matching interaction anchors${worlds.includes("writing") ? ", including the Writing loop" : ""}.`);
