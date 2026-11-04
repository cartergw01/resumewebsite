// Pack the basketball shot's layers (build_islands.py --time hoop-shot and
// hoop-shot-dark) into one image per lighting, on the night still's crop, and
// record where everything is in lib/hoop-shot.json for lib/hoop-shot.ts.
// node scripts/blender/export_hoop_shot.mjs LIT_DIRECTORY DARK_DIRECTORY
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const [lit, dark] = process.argv.slice(2);
if (!lit || !dark) throw new Error("Use: export_hoop_shot.mjs LIT_DIRECTORY DARK_DIRECTORY");
const root = path.resolve(import.meta.dirname, "../..");
const [cx, cy, cw, ch] = JSON.parse(await readFile(path.join(root, "lib/island-cameras.json"), "utf8")).projects.crop;
const meta = JSON.parse(await readFile(path.join(lit, "layers.json"), "utf8"));
// The still's own density, so swapping a layer in doesn't change its sharpness.
const WIDTH = 2880, DENSITY = WIDTH / 1200, GAP = 4, FEATHER = 9 * DENSITY;
const pixels = ([x, y, w, h]) => ({ left: Math.round(x * DENSITY), top: Math.round(y * DENSITY), width: Math.round(w * DENSITY), height: Math.round(h * DENSITY) });

async function layer(directory, name, region, feather = 0) {
  const source = path.join(directory, `${name}.png`);
  const { width: rawWidth } = await sharp(source).metadata();
  const scale = rawWidth / 1200;
  let image = sharp(source)
    .extract({ left: Math.round(cx * scale), top: Math.round(cy * scale), width: Math.round(cw * scale), height: Math.round(ch * scale) })
    .resize(WIDTH, WIDTH * 2 / 3)
    .extract(pixels(region))
    .ensureAlpha();
  const { width, height } = pixels(region);
  let buffer = await image.png().toBuffer();
  if (feather) {
    // Fade the edge: the clean court only has to differ under the ball.
    const mask = Buffer.from(`<svg width="${width}" height="${height}"><defs><filter id="f"><feGaussianBlur stdDeviation="${feather / 2}"/></filter></defs><rect x="${feather}" y="${feather}" width="${width - feather * 2}" height="${height - feather * 2}" fill="#fff" filter="url(#f)"/></svg>`);
    buffer = await sharp(buffer).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  }
  return { input: buffer, width, height };
}

// The ball's shadow on its own, as darkness over the bare court, so it can
// follow the ball anywhere on the court.
const SHADOW_REGION = [800, 495, 105, 72];
const SHADOW_INK = 10;
async function shadowLayer(directory) {
  const { width, height } = pixels(SHADOW_REGION);
  const read = async name => (await layer(directory, name, SHADOW_REGION)).input;
  const bare = await sharp(await read("court-clean")).removeAlpha().raw().toBuffer();
  const shaded = await sharp(await read("court-shadow")).removeAlpha().raw().toBuffer();
  const darkness = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    const light = rgb => rgb[i * 3] * .3 + rgb[i * 3 + 1] * .59 + rgb[i * 3 + 2] * .11;
    darkness[i] = Math.round(255 * Math.max(0, (light(bare) - light(shaded)) / Math.max(1, light(bare) - SHADOW_INK)));
  }
  // The court's painted lines darken differently from its boards, and must not
  // follow the shadow around: a median takes out anything that thin.
  const smooth = await sharp(darkness, { raw: { width, height, channels: 1 } }).median(17).blur(2.5).extractChannel(0).raw().toBuffer();
  const out = Buffer.alloc(width * height * 4);
  const fade = 12 * DENSITY;
  for (let i = 0; i < width * height; i++) {
    const x = i % width, y = Math.floor(i / width);
    const edge = Math.min(1, Math.min(x, y, width - 1 - x, height - 1 - y) / fade);
    out[i * 4] = out[i * 4 + 1] = SHADOW_INK; out[i * 4 + 2] = SHADOW_INK + 6;
    out[i * 4 + 3] = Math.round(smooth[i] * edge * edge * (3 - 2 * edge));
  }
  return { input: await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer(), width, height };
}

const frames = Array.from({ length: meta.frames }, (_, i) => `ball-${String(i).padStart(2, "0")}`);
const parts = [
  { name: "court-clean", region: meta.court, feather: FEATHER },
  { name: "ball-shadow", region: SHADOW_REGION, feather: 0 },
  ...["net-plate", "net-back", "net-front", "rim-front"].map(name => ({ name, region: meta.net, feather: 0 })),
  ...frames.map(name => ({ name, region: meta.ballRegion, feather: 0 })),
];

// A simple shelf layout, the same for both lightings.
const ATLAS = 1024;
let x = GAP, y = GAP, shelf = 0;
const atlas = {};
for (const part of parts) {
  const { width, height } = pixels(part.region);
  if (x + width + GAP > ATLAS) { x = GAP; y += shelf + GAP; shelf = 0; }
  atlas[part.name] = [x, y, width, height];
  x += width + GAP; shelf = Math.max(shelf, height);
}
const atlasHeight = y + shelf + GAP;

const output = path.join(root, "public/blender");
async function pack(directory, variant) {
  const pieces = [];
  for (const part of parts) {
    const piece = part.name === "ball-shadow" ? await shadowLayer(directory) : await layer(directory, part.name, part.region, part.feather);
    pieces.push({ input: piece.input, left: atlas[part.name][0], top: atlas[part.name][1] });
  }
  const image = await sharp({ create: { width: ATLAS, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(pieces).webp({ quality: 91, alphaQuality: 100, effort: 6 }).toBuffer();
  const prefix = `hoop-shot-${variant}-`;
  const name = `${prefix}${createHash("sha256").update(image).digest("hex").slice(0, 8)}.webp`;
  for (const file of await readdir(output)) if (file.startsWith(prefix) && file !== name) await unlink(path.join(output, file));
  await writeFile(path.join(output, name), image);
  console.log(`${name}: ${(image.length / 1024).toFixed(0)} KB, ${ATLAS}×${atlasHeight}`);
  return `/blender/${name}`;
}
const round = list => list.map(value => +value.toFixed(4));
await writeFile(path.join(root, "lib/hoop-shot.json"), JSON.stringify({
  lit: await pack(lit, "lit"), dark: await pack(dark, "dark"),
  atlas,
  regions: { court: meta.court, ball: meta.ballRegion, net: meta.net, shadow: SHADOW_REGION },
  frames: meta.frames, density: DENSITY,
  world: { ball: round(meta.ball), ballRadius: meta.ballRadius, rim: round(meta.rim), rimRadius: meta.rimRadius, netDepth: meta.netDepth, floor: meta.floor },
}, null, 2) + "\n");
