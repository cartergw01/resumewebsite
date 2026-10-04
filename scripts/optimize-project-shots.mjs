// Keep the original captures as sources; every consumer imports these smaller
// WebP files so the workshop screen and destination use identical artwork.
import sharp from "sharp";
import { mkdir, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = new URL("../public/project-shots/", import.meta.url);
const output = new URL("optimized/", source);
await mkdir(output, { recursive: true });
let before = 0;
let after = 0;
for (const name of (await readdir(source)).filter(name => /\.(jpg|webp)$/.test(name)).sort()) {
  const input = new URL(name, source);
  const destination = new URL(name.replace(/\.jpg$/, ".webp"), output);
  await sharp(fileURLToPath(input)).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(fileURLToPath(destination));
  before += (await stat(input)).size;
  after += (await stat(destination)).size;
}
console.log(`Project screenshots: ${before} → ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller)`);
