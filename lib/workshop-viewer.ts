import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { islandMeshopt } from "./meshopt";
import lighting from "./workshop-environment.json";

export type ModelState = "loading" | "ready" | "error";

function release(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach(texture => { texture.dispose(); if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close(); });
}

// One renderer per open inspector. Objects replace only their own geometry;
// the environment and canvas survive browsing the directory.
export function mountWorkshopViewer(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe6edff, 0x776046, 1));
  const key = new THREE.DirectionalLight(0xffedcd, 2); key.position.set(-3, 4, 5); scene.add(key);
  const camera = new THREE.PerspectiveCamera(34, 1, .01, 100);
  camera.position.set(1.5, 1.1, 3.8);
  const home = camera.position.clone();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableZoom = false; controls.enableDamping = false;
  // Horizontal gestures turn the model; vertical gestures remain native
  // scrolling. OrbitControls releases its pointer when the browser pans.
  renderer.domElement.style.touchAction = "pan-y pinch-zoom";
  const root = new THREE.Group(); scene.add(root);
  const loader = new GLTFLoader().setMeshoptDecoder(islandMeshopt());
  let disposed = false, failed = false, frame = 0, generation = 0;
  let request: AbortController | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let report: ((state: ModelState) => void) | undefined;
  let environment: THREE.DataTexture | undefined;
  const environmentRequest = new AbortController();
  const environmentReady = fetch(lighting.src, { signal: environmentRequest.signal }).then(async response => {
    if (!response.ok) throw new Error("Lighting unavailable");
    const bytes = await response.arrayBuffer();
    if (disposed) return;
    const data = new HDRLoader().parse(bytes);
    environment = new THREE.DataTexture(data.data, data.width, data.height, THREE.RGBAFormat, data.type);
    environment.mapping = THREE.CubeUVReflectionMapping;
    environment.minFilter = environment.magFilter = THREE.LinearFilter;
    environment.colorSpace = THREE.LinearSRGBColorSpace;
    environment.generateMipmaps = false;
    // The bake preserves the render target's bottom-up texture coordinates.
    environment.flipY = false; environment.needsUpdate = true;
    scene.environment = environment;
  });
  // A dialog may close before load() starts awaiting the lighting request.
  void environmentReady.catch(() => {});
  const draw = () => {
    if (disposed || failed || frame || !host.clientWidth || !host.clientHeight) return;
    frame = requestAnimationFrame(() => { frame = 0; if (!disposed && !failed) renderer.render(scene, camera); });
  };
  controls.addEventListener("change", draw);
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); draw();
  };
  const observer = new ResizeObserver(resize); observer.observe(host);
  const cancel = () => { generation++; request?.abort(); request = null; clearTimeout(deadline); };
  const clear = () => { release(root); root.clear(); renderer.renderLists.dispose(); };
  const reset = () => { root.rotation.set(0, 0, 0); camera.position.copy(home); controls.target.set(0, 0, 0); controls.update(); draw(); };
  const lost = () => { if (!disposed) { failed = true; cancel(); report?.("error"); } };
  renderer.domElement.addEventListener("webglcontextlost", lost);

  return {
    async load(src: string, notify: (state: ModelState) => void) {
      cancel(); clear(); reset(); report = notify;
      const token = generation;
      const controller = new AbortController(); request = controller;
      const current = () => !disposed && !failed && token === generation;
      notify("loading");
      deadline = setTimeout(() => { if (current()) { cancel(); clear(); notify("error"); } }, 15_000);
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error("Model unavailable");
        const [bytes] = await Promise.all([response.arrayBuffer(), environmentReady]);
        if (!current()) return;
        const gltf = await loader.parseAsync(bytes, "");
        const model = gltf.scene;
        if (!current()) { release(model); return; }
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
        model.position.sub(center);
        const normalized = new THREE.Group(); normalized.add(model);
        normalized.scale.setScalar(2.4 / Math.max(size.x, size.y, size.z, .001));
        root.add(normalized);
        // Drivers with parallel compilation keep controls responsive while
        // the new object's materials are prepared.
        await renderer.compileAsync(scene, camera);
        if (!current()) return;
        clearTimeout(deadline); request = null;
        resize(); notify("ready");
      } catch {
        if (current()) { clearTimeout(deadline); clear(); notify("error"); }
      }
    },
    cancel,
    rotate: (direction: number) => { root.rotation.y += direction * Math.PI / 6; draw(); },
    zoom: (value: number) => { camera.position.setLength(home.length() / Math.max(.75, Math.min(1.7, value))); draw(); },
    reset,
    glow: (on: boolean) => {
      root.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          if (material instanceof THREE.MeshStandardMaterial && (material.name.includes("pink heart") || material.name.includes("pink band"))) material.emissiveIntensity = on ? 4 : .1;
        }
      }); draw();
    },
    dispose: () => {
      disposed = true; cancel(); environmentRequest.abort(); cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); clear();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      environment?.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}

export type WorkshopViewer = ReturnType<typeof mountWorkshopViewer>;
