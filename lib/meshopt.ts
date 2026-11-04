import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

type DecodeArgs = Parameters<typeof MeshoptDecoder.decodeGltfBufferAsync>;
type Pending = { resolve:(data:Uint8Array)=>void; reject:(error:Error)=>void; timer:ReturnType<typeof setTimeout> };
const pending = new Map<number, Pending>();
let worker: Worker | null = null, unavailable = false, sequence = 0;

function stopWorker() {
  unavailable = true;
  worker?.terminate(); worker = null;
  for (const job of pending.values()) { clearTimeout(job.timer); job.reject(new Error("Decoder worker unavailable")); }
  pending.clear();
}

function decoderWorker() {
  if (worker) return worker;
  // A bundled module has a stable URL. The library's blob worker revoked its
  // URL immediately, which could strand decoding after a failed load in Safari.
  worker = new Worker(new URL("./meshopt-worker.ts", import.meta.url), { type: "module", name: "island-model-decoder" });
  worker.onmessage = (event: MessageEvent<{id:number;data?:Uint8Array;error?:string}>) => {
    const job = pending.get(event.data.id);
    if (!job) return;
    pending.delete(event.data.id); clearTimeout(job.timer);
    if (event.data.data) job.resolve(event.data.data);
    else job.reject(new Error(event.data.error ?? "Model could not be decoded"));
  };
  worker.onerror = event => { event.preventDefault(); stopWorker(); };
  return worker;
}

const decoder = {
  ...MeshoptDecoder,
  async decodeGltfBufferAsync(...args: DecodeArgs) {
    if (unavailable || typeof Worker === "undefined") return MeshoptDecoder.decodeGltfBufferAsync(...args);
    try {
      const target = decoderWorker();
      const [count, size, source, mode, filter] = args;
      const copy = source.slice(), id = ++sequence;
      return await new Promise<Uint8Array>((resolve,reject) => {
        pending.set(id, {resolve,reject,timer:setTimeout(stopWorker,10_000)});
        target.postMessage({id,count,size,source:copy,mode,filter},[copy.buffer]);
      });
    } catch {
      // Keep the scene usable if workers are blocked or fail to start.
      return MeshoptDecoder.decodeGltfBufferAsync(...args);
    }
  },
};

export function islandMeshopt() { return decoder; }
