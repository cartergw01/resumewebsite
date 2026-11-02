import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

type Args = Parameters<typeof MeshoptDecoder.decodeGltfBufferAsync>;
self.addEventListener("message", async (event: MessageEvent<{id:number;count:Args[0];size:Args[1];source:Args[2];mode:Args[3];filter:Args[4]}>) => {
  const { id, count, size, source, mode, filter } = event.data;
  try {
    const data = await MeshoptDecoder.decodeGltfBufferAsync(count,size,source,mode,filter);
    self.postMessage({id,data},{transfer:[data.buffer]});
  } catch (error) {
    self.postMessage({id,error:error instanceof Error ? error.message : "Model could not be decoded"});
  }
});
