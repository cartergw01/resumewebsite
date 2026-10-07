import { AgXToneMapping, Box3, Color, Group, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

// Real camera flights between islands. Each island's flight model has its
// full Cycles lighting baked into vertex colours (scripts/blender/export_flight.py),
// so it is drawn unlit and cheaply. The islands sit apart in one space and a
// camera flies from one island's render view to the next, matching each
// still's exact framing at either end so the hand-off is seamless.
export type FlightIsland = {
  id: string;
  src: string;
  daySrc?: string;
  camera: { position: number[]; direction: number[]; fov: number };
  crop: number[];
};
type Placed = { group: Group; dayGroup?: Group; daySrc?: string; dayLoading?: boolean; position: Vector3; target: Vector3; direction: Vector3; fov: number; crop: number[] };

// Where each island sits in the shared flight space (Three coordinates).
const OFFSETS: Record<string, [number, number, number]> = { work: [0, 0, 0], writing: [22, 2, -8], projects: [44, -1, 0] };
// Blender's exposure for each look (2 ** stops), applied as a colour scale.
const EXPOSURE = { night: 2 ** .55, day: 2 ** -.2 };

const bezier = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number) => {
  const u = 1 - t;
  return a.clone().multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
};
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

export async function createFlightWorld(canvas: HTMLCanvasElement, islands: FlightIsland[], signal?: AbortSignal) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(new Color(0), 0);
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1;
  const draco = new DRACOLoader().setDecoderPath("/draco/").setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const scene = new Scene();
  const placed = new Map<string, Placed>();
  // A pre-lit model, drawn unlit, scaled by the still's exposure.
  const load = async (src: string, offset: Vector3, exposure: number) => {
    const response = await fetch(src, { signal });
    if (!response.ok) throw new Error(`Flight model: ${response.status}`);
    const gltf = await loader.parseAsync(await response.arrayBuffer(), "/blender/");
    signal?.throwIfAborted();
    const group = new Group();
    group.add(gltf.scene);
    group.position.copy(offset);
    gltf.scene.traverse(object => {
      if (object instanceof Mesh) object.material = new MeshBasicMaterial({ vertexColors: true, color: new Color().setScalar(exposure) });
    });
    group.visible = false;
    scene.add(group);
    return { group, gltf };
  };
  try {
    for (const island of islands) {
      const offset = new Vector3(...(OFFSETS[island.id] ?? [0, 0, 0]));
      // Decimation merges Taipei's lit windows, so its night model is lifted
      // a little to read like its still.
      const { group, gltf } = await load(island.src, offset, EXPOSURE.night * (island.id === "work" ? 1.4 : 1));
      // The still's camera, aimed where the orbit view aims it.
      const camera = new Vector3().fromArray(island.camera.position);
      const direction = new Vector3().fromArray(island.camera.direction).normalize();
      const center = new Box3().setFromObject(gltf.scene).getCenter(new Vector3());
      const target = camera.clone().addScaledVector(direction, center.clone().sub(camera).dot(direction));
      placed.set(island.id, { group, daySrc: island.daySrc, position: camera.add(offset), target: target.add(offset), direction, fov: island.camera.fov, crop: island.crop });
    }
  } catch (error) { renderer.dispose(); draco.dispose(); throw error; }

  const camera = new PerspectiveCamera(30, 1.5, .05, 400);
  camera.up.set(0, 1, 0);
  let time: "night" | "day" = "night";
  const projection = (island: Placed, rect: DOMRect, width: number, height: number) => {
    // The still's view (its crop of a 3:2 frame), placed into the island's
    // on-screen box exactly as object-fit: contain draws the still.
    const lens = new PerspectiveCamera(island.fov, 1.5, .05, 400);
    lens.setViewOffset(1200, 800, island.crop[0], island.crop[1], island.crop[2], island.crop[3]);
    lens.updateProjectionMatrix();
    const scale = Math.min(rect.width / 1200, rect.height / 800);
    const left = rect.left + (rect.width - 1200 * scale) / 2, top = rect.top + (rect.height - 800 * scale) / 2;
    const placement = new Matrix4().set(
      1200 * scale / width, 0, 0, (left + 600 * scale) * 2 / width - 1,
      0, 800 * scale / height, 0, 1 - (top + 400 * scale) * 2 / height,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    return placement.multiply(lens.projectionMatrix);
  };

  return {
    // Taipei's day model loads the first time day is chosen; until then the
    // night model flies.
    setTime(next: "night" | "day") {
      time = next;
      for (const island of placed.values()) {
        if (next !== "day" || !island.daySrc || island.dayGroup || island.dayLoading) continue;
        island.dayLoading = true;
        void load(island.daySrc, island.group.position.clone(), EXPOSURE.day).then(({ group }) => { island.dayGroup = group; }).catch(() => { island.dayLoading = false; });
      }
    },
    // Fly from one island's still to the next at progress t (0..1).
    render(from: string, to: string, t: number, rect: DOMRect) {
      const a = placed.get(from), b = placed.get(to);
      if (!a || !b) return false;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const ratio = Math.min(devicePixelRatio, 1.25);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) renderer.setPixelRatio(ratio), renderer.setSize(width, height, false);
      const e = smooth(t);
      // Pull back and rise off the first island, cross, then settle onto the next.
      const lift = new Vector3(0, 6, 0);
      const p1 = a.position.clone().addScaledVector(a.direction, -14).add(lift);
      const p2 = b.position.clone().addScaledVector(b.direction, -14).add(lift);
      camera.position.copy(bezier(a.position, p1, p2, b.position, e));
      camera.lookAt(a.target.clone().lerp(b.target, smooth((e - .12) / .76)));
      camera.updateMatrixWorld(true);
      const pa = projection(a, rect, width, height), pb = projection(b, rect, width, height);
      camera.projectionMatrix.fromArray(pa.elements.map((value, i) => value + (pb.elements[i] - value) * e));
      // Widen the lens through the middle so both islands share the frame,
      // zooming out about the island box (the projection's off-axis centre).
      const widen = 1 - .45 * Math.sin(Math.PI * e);
      camera.projectionMatrix.elements[0] *= widen; camera.projectionMatrix.elements[5] *= widen;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      for (const island of placed.values()) {
        const shown = island === a || island === b;
        const day = time === "day" && island.dayGroup;
        island.group.visible = shown && !day;
        if (island.dayGroup) island.dayGroup.visible = shown && Boolean(day);
      }
      renderer.render(scene, camera);
      return true;
    },
    clear() { renderer.clear(); },
    dispose() {
      draco.dispose();
      scene.traverse(object => { if (object instanceof Mesh) { object.geometry.dispose(); (object.material as MeshBasicMaterial).dispose(); } });
      renderer.dispose();
    },
  };
}
export type FlightWorld = Awaited<ReturnType<typeof createFlightWorld>>;
