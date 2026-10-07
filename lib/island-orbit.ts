import { AgXToneMapping, Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Color, DirectionalLight, HemisphereLight, Mesh, PointLight, MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator, Raycaster, Scene, Spherical, SRGBColorSpace, Texture, TextureLoader, Vector2, Vector3, WebGLRenderer } from "three";
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
  surfaceAnchors?: { signature: string; points: OrbitProjection };
  // Warm lamps, screens and task lights from the Blender scene (Three coordinates).
  practicals?: { position: number[]; color: number[]; watts: number }[];
};
export type OrbitProjection = Record<string, number[][]>;

export async function createIslandOrbit(canvas: HTMLCanvasElement, asset: OrbitAsset, anchors: OrbitProjection, project: (points: OrbitProjection) => void, screenImage?: string, signal?: AbortSignal) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(new Color(0), 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
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
    const glowing: { material: MeshStandardMaterial; night: number }[] = [];
    gltf.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        addIslandGrain(material);
        // Lit windows and lamps sit a hair in front of their facades; at this
        // distance the depth buffer can't separate them, so pull them forward.
        if (material.emissive.getHex() !== 0 && material.emissiveIntensity > 0) {
          material.polygonOffset = true;
          material.polygonOffsetFactor = -2;
          material.polygonOffsetUnits = -4;
          // Cycles lets windows and lamps bloom; match their night glow here.
          material.emissiveIntensity *= 1.6;
          glowing.push({ material, night: material.emissiveIntensity });
        }
      }
    });
    const scene = new Scene();
    scene.add(gltf.scene);
    // The same night as the Cycles renders: navy ambience, a cool moon from
    // behind on the left, a blue rim, a low bounce under the cliff, and the
    // scene's own warm lamps.
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.1;
    const sky = new HemisphereLight(0x5d73b0, 0x15151c, 0.7);
    scene.add(sky);
    const key = new DirectionalLight(0xb8ccff, 2.4);
    key.position.set(-6.6, 7, -7.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -11, right: 11, top: 13, bottom: -9, near: 0.1, far: 45 });
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.018;
    key.shadow.camera.updateProjectionMatrix();
    scene.add(key);
    const rim = new DirectionalLight(0x86a8ff, 1.3);
    rim.position.set(3, 4.5, -9);
    scene.add(rim);
    const bounce = new DirectionalLight(0x8ca4ff, 0.45);
    bounce.position.set(1.5, -4.5, 9);
    scene.add(bounce);
    const fill = new DirectionalLight(0x9fb4ff, 0.35);
    fill.position.set(-3, 6, 9);
    scene.add(fill);
    const lamps: PointLight[] = [];
    for (const practical of asset.practicals ?? []) {
      const lamp = new PointLight(new Color().fromArray(practical.color), practical.watts * 0.12, 4.5, 2);
      lamp.position.fromArray(practical.position);
      scene.add(lamp);
      lamps.push(lamp);
    }
    // Work's city also has a clear afternoon: a warm sun from the front left,
    // a bright sky, and every lit window and lamp switched off.
    const setDaylight = (day: boolean) => {
      scene.environmentIntensity = day ? 0.28 : 0.1;
      sky.color.set(day ? 0xb4cbf5 : 0x5d73b0); sky.groundColor.set(day ? 0x3e3a30 : 0x15151c); sky.intensity = day ? 1.0 : 0.7;
      key.color.set(day ? 0xfff0da : 0xb8ccff); key.intensity = day ? 2.6 : 2.4;
      key.position.set(day ? -6.6 : -6.6, day ? 7.4 : 7, day ? 7.4 : -7.4);
      rim.intensity = day ? 0.35 : 1.3;
      bounce.color.set(day ? 0xd9cdb5 : 0x8ca4ff); bounce.intensity = day ? 0.55 : 0.45;
      fill.intensity = day ? 0.45 : 0.35;
      for (const lamp of lamps) lamp.visible = !day;
      for (const { material, night } of glowing) material.emissiveIntensity = day ? 0 : night;
      renderer.shadowMap.needsUpdate = true;
    };
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
    const worldPoints: Record<string, Vector3[]> = {};
    const signature = JSON.stringify([asset.src, asset.camera, asset.crop, anchors, asset.entryWindow3D]);
    if (asset.surfaceAnchors?.signature === signature) {
      // Bake these exact intersections once, instead of scanning up to 1.6M
      // triangles on the visitor's main thread each time a world loads.
      for (const [name, points] of Object.entries(asset.surfaceAnchors.points)) worldPoints[name] = points.map(point => new Vector3().fromArray(point));
    } else {
      // Edited models remain usable until their anchors are baked again.
      const raycaster = new Raycaster();
      for (const [name, points] of Object.entries(anchors)) {
        worldPoints[name] = [];
        for (const [x, y] of points) {
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          signal?.throwIfAborted();
          raycaster.setFromCamera(new Vector2(x / 600 - 1, 1 - y / 400), camera);
          worldPoints[name].push(raycaster.intersectObject(gltf.scene, true)[0]?.point.clone()
            ?? raycaster.ray.at(initial.radius, new Vector3()));
        }
      }
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
    // Compile before the first draw on every world. Doing this after resize()
    // already forced synchronous shader compilation during that first render.
    if (signal?.aborted) { dispose(); signal.throwIfAborted(); }
    await renderer.compileAsync(scene, camera);
    if (signal?.aborted) { dispose(); signal.throwIfAborted(); }
    resize();
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
      setDaylight(day: boolean) { setDaylight(day); flushRender(); },
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
    if (!disposed) {
      environment.dispose();
      draco.dispose();
      renderer.dispose();
    }
    throw error;
  }
}
