import { AgXToneMapping, Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Color, DirectionalLight, HemisphereLight, Mesh, PointLight, MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator, Raycaster, Scene, Spherical, SRGBColorSpace, Texture, TextureLoader, Vector2, Vector3, WebGLRenderer } from "three";
import { makeLitWindow } from "./work-lit-window";
import { CITY_TIME_DURATION } from "./city-time";
import { addIslandGrain } from "./island-orbit-materials";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { hardwareWebGL } from "./hardware-webgl";

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
  // Sharp on Retina; capped at 2x because a turned island renders every frame,
  // and at 1.5x on software WebGL.
  renderer.setPixelRatio(Math.min(devicePixelRatio, hardwareWebGL() ? 2 : 1.5));
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
          // Lit panes stay a warm amber: brighter, they wash out to white when
          // the Work camera flies close to the facade.
          material.emissiveIntensity *= .45;
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
    // a bright sky, and every lit window and lamp switched off. The two rigs
    // blend, so switching relights the model gradually rather than snapping.
    const rigs = {
      night: { env: .1, sky: new Color(0x5d73b0), ground: new Color(0x15151c), skyI: .7, key: new Color(0xb8ccff), keyI: 2.4, keyPos: new Vector3(-6.6, 7, -7.4), rim: 1.3, bounceC: new Color(0x8ca4ff), bounce: .45, fill: .35, lamps: 1, glow: 1, pane: new Color(0xd9a868) },
      day: { env: .28, sky: new Color(0xb4cbf5), ground: new Color(0x3e3a30), skyI: 1, key: new Color(0xfff0da), keyI: 2.6, keyPos: new Vector3(-6.6, 7.4, 7.4), rim: .35, bounceC: new Color(0xd9cdb5), bounce: .55, fill: .45, lamps: 0, glow: 0, pane: new Color(0x6c8091) },
    };
    const lampPower = lamps.map(lamp => lamp.intensity);
    // Lit panes glow from within at night (a darker surface under the glow
    // reads as a lamplit window, not a white tile) and are glass by day.
    const nightPane = new Color(0x4a3d30), daylightGlass = new Color(0x2c3f48);
    let daylight = 0, tween = 0;
    const lerp = (a: number, b: number) => a + (b - a) * daylight;
    const applyRig = () => {
      const n = rigs.night, d = rigs.day;
      scene.environmentIntensity = lerp(n.env, d.env);
      sky.color.copy(n.sky).lerp(d.sky, daylight); sky.groundColor.copy(n.ground).lerp(d.ground, daylight); sky.intensity = lerp(n.skyI, d.skyI);
      key.color.copy(n.key).lerp(d.key, daylight); key.intensity = lerp(n.keyI, d.keyI);
      key.position.copy(n.keyPos).lerp(d.keyPos, daylight);
      rim.intensity = lerp(n.rim, d.rim);
      bounce.color.copy(n.bounceC).lerp(d.bounceC, daylight); bounce.intensity = lerp(n.bounce, d.bounce);
      fill.intensity = lerp(n.fill, d.fill);
      lamps.forEach((lamp, i) => { lamp.intensity = lampPower[i] * (1 - daylight); });
      // By day a lit pane is just glass: its baked warm colour is tinted down
      // to the blue-green glazing of the daylight render.
      for (const { material, night } of glowing) {
        material.emissiveIntensity = night * (1 - daylight);
        material.color.copy(nightPane).lerp(daylightGlass, daylight);
      }
      const pane = litWindow?.group.children[0];
      if (pane instanceof Mesh && pane.material instanceof MeshBasicMaterial) pane.material.color.copy(n.pane).lerp(d.pane, daylight);
      renderer.shadowMap.needsUpdate = true;
    };
    const setDaylight = (day: boolean, animate: boolean, duration = CITY_TIME_DURATION) => new Promise<void>(resolve => {
      cancelAnimationFrame(tween);
      const from = daylight, to = day ? 1 : 0;
      if (!animate || from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { daylight = to; applyRig(); flushRender(); resolve(); return; }
      const start = performance.now();
      const step = (now: number) => {
        if (disposed) { resolve(); return; }
        const k = Math.min(1, (now - start) / duration);
        daylight = from + (to - from) * (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
        applyRig(); flushRender();
        if (k < 1) tween = requestAnimationFrame(step); else resolve();
      };
      tween = requestAnimationFrame(step);
    });
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
    let yaw = 0;
    let pitch = 0;
    let renderFrame = 0;
    // A drag can pull past the view's limits against growing resistance, and a
    // release coasts and springs back. Keys still step within the hard limits.
    const YAW = 0.65, PITCH = 0.13, STRETCH = 0.1;
    const rubber = (value: number, limit: number) => {
      const over = Math.abs(value) - limit;
      return over <= 0 ? value : Math.sign(value) * (limit + STRETCH * over * .55 / (over * .55 + STRETCH));
    };
    let rawYaw = 0, rawPitch = 0, glide = 0;
    const show = () => {
      yaw = rubber(rawYaw, YAW);
      pitch = rubber(rawPitch, PITCH);
      canvas.dataset.orbitYaw = yaw.toFixed(4);
      canvas.dataset.orbitPitch = pitch.toFixed(4);
      scheduleRender();
    };
    const stopGlide = () => { cancelAnimationFrame(glide); glide = 0; };
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
      if (disposed) return;
      updatePose();
      renderer.render(scene, camera);
    };
    // Pointer devices can deliver several events in one display frame. Keep
    // every movement, but submit only the latest camera position to the GPU.
    const scheduleRender = () => {
      if (!renderFrame && !disposed) renderFrame = requestAnimationFrame(() => { renderFrame = 0; render(); });
    };
    const flushRender = () => { cancelAnimationFrame(renderFrame); renderFrame = 0; render(); };
    const resize = () => {
      if (disposed) return;
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
      cancelAnimationFrame(tween);
      stopGlide();
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
        stopGlide();
        rawYaw = Math.max(-YAW, Math.min(YAW, yaw + dx));
        rawPitch = Math.max(-PITCH, Math.min(PITCH, pitch + dy));
        show();
      },
      // Direct manipulation: follows the pointer, stretching past the limits.
      drag(dx: number, dy: number) {
        stopGlide();
        rawYaw += dx;
        rawPitch += dy;
        show();
      },
      // Coast on the release velocity (radians per ms), then settle inside
      // the limits. Zero velocity (or reduced motion) only springs back.
      release(vYaw: number, vPitch: number) {
        stopGlide();
        let previous = performance.now();
        const step = (now: number) => {
          // A frame's timestamp can precede the release that scheduled it.
          const dt = Math.max(0, Math.min(now - previous, 48));
          previous = Math.max(previous, now);
          const settle = (raw: number, velocity: number, limit: number): [number, number] => {
            const over = Math.abs(raw) - limit;
            if (over > 0) {
              // Past the edge: brake hard, then ease back onto it.
              velocity = Math.sign(raw) === Math.sign(velocity) ? velocity * Math.exp(-dt / 40) : 0;
              raw = Math.sign(raw) * (limit + over * Math.exp(-dt / 90)) + velocity * dt;
            } else {
              raw += velocity * dt;
              velocity *= Math.exp(-dt / 220);
            }
            return [raw, velocity];
          };
          [rawYaw, vYaw] = settle(rawYaw, vYaw, YAW);
          [rawPitch, vPitch] = settle(rawPitch, vPitch, PITCH);
          const resting = (raw: number, velocity: number, limit: number) => Math.abs(velocity) < 2e-5 && Math.abs(raw) - limit < 1e-4;
          if (resting(rawYaw, vYaw, YAW) && resting(rawPitch, vPitch, PITCH)) {
            rawYaw = Math.max(-YAW, Math.min(YAW, rawYaw));
            rawPitch = Math.max(-PITCH, Math.min(PITCH, rawPitch));
            glide = 0;
          } else glide = requestAnimationFrame(step);
          show();
        };
        glide = requestAnimationFrame(step);
      },
      reset() { stopGlide(); rawYaw = rawPitch = yaw = pitch = 0; canvas.dataset.orbitYaw = "0"; canvas.dataset.orbitPitch = "0"; flushRender(); },
      setDaylight(day: boolean, animate = true, duration?: number) { return setDaylight(day, animate, duration); },
      dispose,
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
