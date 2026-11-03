import { readFile, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const root=path.resolve(import.meta.dirname,"../..");
const file=path.join(root,"lib/workshop-curios.json");
const data=JSON.parse(await readFile(file,"utf8"));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({"meshopt.encoder":MeshoptEncoder,"meshopt.decoder":MeshoptDecoder});
for(const [id,asset] of Object.entries(data)) {
  const source=path.join(root,"public",asset.src);
  const document=await io.read(source);
  if(document.getRoot().listExtensionsUsed().some(e=>e.extensionName==="EXT_meshopt_compression"))continue;
  await document.transform(dedup(),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:"high"}));
  const bytes=await io.writeBinary(document);
  const name=`${id}-${createHash("sha256").update(bytes).digest("hex").slice(0,8)}.glb`;
  const next=path.join(root,"public/workshop",name);
  await writeFile(next,bytes); if(next!==source)await unlink(source);
  asset.src=`/workshop/${name}`;
  console.log(`${id}: ${(bytes.length/1024).toFixed(0)} KB`);
}
await writeFile(file,JSON.stringify(data,null,2)+"\n");
