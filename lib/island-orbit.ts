import { AgXToneMapping, Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Color, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator, Raycaster, Scene, Spherical, SRGBColorSpace, Texture, TextureLoader, Vector2, Vector3, WebGLRenderer } from "three";
import { flyThroughWindow, makeLitWindow } from "./work-window-camera";
import type { ScreenMatrix } from "./island-orbit-bridge";
import { addIslandGrain } from "./island-orbit-materials";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export type OrbitAsset = {
  src: string;
  camera: { position: number[]; up: number[]; direction: number[]; fov: number };
  crop: number[];
  entryWindow3D?: number[][];
};
export type OrbitProjection = Record<string, number[][]>;

export async function createIslandOrbit(canvas: HTMLCanvasElement, asset: OrbitAsset, anchors: OrbitProjection, project: (points: OrbitProjection) => void, screenImage?: string, signal?: AbortSignal) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(new Color(0), 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const environmentScene = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, 0.04);
  environmentScene.dispose();
  pmrem.dispose();
  const draco = new DRACOLoader().setDecoderPath("/draco/").setWorkerLimit(1);
  let disposed = false;
  try {
    const response = await fetch(asset.src, { signal });
    if (!response.ok) throw new Error(`Island model: ${response.status}`);
    const bytes = await response.arrayBuffer();
    const gltf = await new GLTFLoader().setDRACOLoader(draco).parseAsync(bytes, "/blender/");
    signal?.throwIfAborted();
    gltf.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof MeshStandardMaterial) addIslandGrain(material);
      }
    });
    const scene = new Scene();
    scene.add(gltf.scene);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.3;
    scene.add(new HemisphereLight(0xdde8ff, 0x514328, 0.4));
    const key = new DirectionalLight(0xffefd8, 2.7);
    key.position.set(-7, 11, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -11, right: 11, top: 13, bottom: -9, near: 0.1, far: 45 });
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.018;
    key.shadow.camera.updateProjectionMatrix();
    scene.add(key);
    const rim = new DirectionalLight(0xa2caff, 0.9);
    rim.position.set(5, 4, -6);
    scene.add(rim);
    renderer.shadowMap.needsUpdate = true;
    scene.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(asset.camera.fov, 1.5, 0.05, 150);
    camera.position.fromArray(asset.camera.position);
    const direction = new Vector3().fromArray(asset.camera.direction);
    const center = new Box3().setFromObject(gltf.scene).getCenter(new Vector3());
    const target = camera.position.clone().addScaledVector(direction, center.clone().sub(camera.position).dot(direction));
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.setViewOffset(1200, 800, asset.crop[0], asset.crop[1], asset.crop[2], asset.crop[3]);
    camera.updateMatrixWorld(true);
    const initial = new Spherical().setFromVector3(camera.position.clone().sub(target));
    const raycaster = new Raycaster();
    const worldPoints: Record<string, Vector3[]> = {};
    // Recover the real surface under each rendered anchor, once. Its position
    // then follows the orbit, including the page-entry window and annotations.
    for (const [name, points] of Object.entries(anchors)) {
      worldPoints[name] = points.map(([x, y]) => {
        raycaster.setFromCamera(new Vector2(x / 600 - 1, 1 - y / 400), camera);
        return raycaster.intersectObject(gltf.scene, true)[0]?.point.clone()
          ?? raycaster.ray.at(initial.radius, new Vector3());
      });
    }
    if (asset.entryWindow3D) worldPoints.entryWindow = asset.entryWindow3D.map(point => new Vector3().fromArray(point));
    const litWindow = worldPoints.entryWindow ? makeLitWindow(worldPoints.entryWindow) : null;
    if (litWindow) gltf.scene.add(litWindow.group);
    // The workshop keeps its real project preview attached to the screen.
    // Ray-cast corners let it turn with the monitor and become the entry surface.
    if (screenImage && worldPoints.screen) {
      const texture = await new TextureLoader().loadAsync(screenImage).catch(() => null);
      if (texture) {
        texture.colorSpace = SRGBColorSpace;
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute(worldPoints.screen.flatMap(point => point.toArray()), 3));
        geometry.setAttribute("uv", new Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
        geometry.setIndex([0, 2, 1, 2, 3, 1]);
        const material = new MeshBasicMaterial({ map: texture, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
        const preview = new Mesh(geometry, material);
        gltf.scene.add(preview);
      }
    }
    let inFlight = false;
    let disposePending = false;
    let yaw = 0;
    let pitch = 0;
    let renderFrame = 0;
    const updatePose = () => {
      const orbit = new Spherical(initial.radius, initial.phi + pitch, initial.theta + yaw);
      camera.position.copy(target).add(new Vector3().setFromSpherical(orbit));
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      const projection: OrbitProjection = {};
      for (const [name, points] of Object.entries(worldPoints)) projection[name] = points.map(point => {
        const screen = point.clone().project(camera);
        return [(screen.x + 1) * 600, (1 - screen.y) * 400];
      });
      project(projection);
    };
    const render = () => {
      if (disposed || inFlight) return;
      updatePose();
      renderer.render(scene, camera);
    };
    // Pointer devices can deliver several events in one display frame. Keep
    // every movement, but submit only the latest camera position to the GPU.
    const scheduleRender = () => {
      if (!renderFrame && !disposed && !inFlight) renderFrame = requestAnimationFrame(() => { renderFrame = 0; render(); });
    };
    const flushRender = () => { cancelAnimationFrame(renderFrame); renderFrame = 0; render(); };
    const resize = () => {
      if (inFlight || disposed) return;
      const bounds = canvas.parentElement!.getBoundingClientRect();
      const width = Math.min(canvas.parentElement!.clientWidth || bounds.width, (canvas.parentElement!.clientHeight || bounds.height) * 1.5);
      renderer.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(width / 1.5)), false);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${width / 1.5}px`;
      render();
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(renderFrame);
      gltf.scene.traverse(object => {
        if (!(object instanceof Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
          material.dispose();
        }
      });
      key.shadow.map?.dispose();
      environment.dispose();
      draco.dispose();
      renderer.dispose();
    };
    resize();
    // Finish compiling the tower shaders while its poster is still visible;
    // the first camera move should not have to wait for GPU compilation.
    if (litWindow) await renderer.compileAsync(scene, camera);
    return {
      resize,
      rotate(dx: number, dy: number) {
        yaw = Math.max(-0.65, Math.min(0.65, yaw + dx));
        pitch = Math.max(-0.13, Math.min(0.13, pitch + dy));
        canvas.dataset.orbitYaw = yaw.toFixed(4);
        canvas.dataset.orbitPitch = pitch.toFixed(4);
        scheduleRender();
      },
      reset() { yaw = 0; pitch = 0; canvas.dataset.orbitYaw = "0"; canvas.dataset.orbitPitch = "0"; flushRender(); },
      beginWindowFlight: litWindow ? (host: HTMLElement, matrix: ScreenMatrix) => {
        // Carry the latest input into the flight without drawing a redundant
        // island frame just before the full-viewport camera takes over.
        cancelAnimationFrame(renderFrame);
        renderFrame = 0;
        updatePose();
        inFlight = true;
        return flyThroughWindow(renderer, scene, camera, litWindow, host, matrix, () => {
          inFlight = false;
          if (disposePending) dispose(); else resize();
        });
      } : undefined,
      dispose() { if (inFlight) disposePending = true; else dispose(); },
    };
  } catch (error) {
    environment.dispose();
    draco.dispose();
    renderer.dispose();
    throw error;
  }
}
