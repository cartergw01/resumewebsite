// Recompress the browser's island models with meshopt and quantized vertices.
// node scripts/blender/compress_models.mjs
//
// Blender exports Draco. Meshopt's output is smaller once served with Brotli
// (which Vercel applies to .glb), decodes several times faster on a phone,
// and its decoder is ~20 KB instead of Draco's ~250 KB. Every model listed in
// lib/island-orbit-assets.json and lib/island-flight-assets.json that is not
// yet meshopt-compressed is rewritten under a new fingerprinted name, its
// manifest entry updated and the old file removed. Run before
// bake-orbit-anchors.mjs, whose cached anchors are keyed to each model's path.
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import draco3d from "draco3dgltf";

const root = path.resolve(import.meta.dirname, "../..");
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

async function compress(src) {
  const file = path.join(root, "public", src);
  const document = await io.read(file);
  if (document.getRoot().listExtensionsUsed().some(extension => extension.extensionName === "EXT_meshopt_compression")) return src;
  // Drop the Draco extension so the rewritten file carries meshopt only.
  document.getRoot().listExtensionsUsed().find(extension => extension.extensionName === "KHR_draco_mesh_compression")?.dispose();
  await document.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: "high" }));
  const bytes = await io.writeBinary(document);
  const prefix = path.basename(src, ".glb").replace(/-[0-9a-f]{8}$/, "");
  const name = `${prefix}-${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}.glb`;
  await writeFile(path.join(root, "public/blender", name), bytes);
  if (`/blender/${name}` !== src) await unlink(file);
  console.log(`${src} → /blender/${name} (${(bytes.length / 1048576).toFixed(2)} MiB)`);
  return `/blender/${name}`;
}

for (const manifestName of ["island-orbit-assets.json", "island-flight-assets.json"]) {
  const manifestPath = path.join(root, "lib", manifestName);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const asset of Object.values(manifest)) {
    for (const key of ["src", "daySrc"]) if (asset[key]) asset[key] = await compress(asset[key]);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}
