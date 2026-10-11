import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// The island models are meshopt-compressed (scripts/blender/compress_models.mjs).
// Decode them in a worker, as the old Draco decoder did: decoding on the main
// thread blocked the page for a beat, which could land mid island entry.
// (Renamed so the React hooks lint rule doesn't take it for a hook.)
const { useWorkers: startWorkers } = MeshoptDecoder;
let started = false;
export function islandMeshopt() {
  if (!started) { startWorkers(1); started = true; }
  return MeshoptDecoder;
}
