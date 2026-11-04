// Browser-only capture scene. Reuses the site's baked 3D models and typography.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const smooth = (t) => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const mix = (a, b, t) => a + (b - a) * t;
const random = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export async function createSocialScene({ assets, cameras, width, height }) {
  const root = document.createElement('div');
  root.id = 'social-cinema';
  root.innerHTML = `<canvas></canvas>
    <div class="cinema-byline">Carter Wang</div>
    <div class="cinema-title" data-title="home">Carter<br>Wang</div>
    <div class="cinema-title" data-title="work">Work</div>
    <div class="cinema-title" data-title="writing">Writing</div>
    <div class="cinema-title" data-title="projects">Projects</div>
    <div class="cinema-address">carterkowang.com</div>`;
  document.body.append(root);
  const style = document.createElement('style');
  style.textContent = `
    body > :not(#social-cinema) { visibility: hidden !important; }
    #social-cinema { position: fixed; inset: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: #030611; color: #fff7ea; font-family: var(--font-display); }
    #social-cinema canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    .cinema-title { position: absolute; left: 64px; top: 475px; font-size: 80px; line-height: 1; letter-spacing: -.035em; font-weight: 850; font-stretch: 125%; opacity: 0; text-shadow: 0 2px 20px #030611; }
    .cinema-title[data-title="home"] { top: 225px; font-size: 88px; }
    .cinema-byline { position: absolute; top: 52px; left: 66px; font-size: 25px; font-weight: 600; letter-spacing: -.02em; font-stretch: 125%; }
    .cinema-address { position: absolute; left: 67px; bottom: 28px; font-size: 17px; font-weight: 400; color: #fff7ea99; }
  `;
  document.head.append(style);

  const renderer = new THREE.WebGLRenderer({ canvas: root.querySelector('canvas'), antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1.5);
  renderer.setClearColor(0x000000);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  // Match the site's flight renderer: the GLBs already contain baked lighting.
  // Keep exposure fixed. Only original light fixtures receive a restrained
  // glow; ordinary walls, book pages and roofs never enter the glow pass.
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, width / height, .1, 500);
  camera.setViewOffset(width, height, -215, 0, width, height);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const placed = {};
  const surfaces = [];
  const positions = { work: [-9, 2, -3], writing: [-1, -1, 8], projects: [10, 3, -4] };
  const yaw = { work: .08, writing: -.1, projects: .12 };
  await Promise.all(Object.entries(positions).map(async ([id, position]) => {
    const gltf = await loader.loadAsync(assets[id].src);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    const dimensions = box.getSize(new THREE.Vector3());
    const scale = 10 / dimensions.x;
    gltf.scene.position.copy(center).multiplyScalar(-scale);
    gltf.scene.scale.setScalar(scale);
    gltf.scene.traverse((object) => {
      if (object.isMesh && object.geometry.hasAttribute('color')) {
        object.material = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color().setScalar(2 ** .55 * (id === 'work' ? 1.4 : 1)) });
        surfaces.push(object);
      }
      // Separate fixture meshes keep their original emissive materials.
      // Their light is also baked into the room, so every lamp stays on
      // without full-scene bloom or camera-dependent lighting changes.
    });
    const group = new THREE.Group();
    group.add(gltf.scene);
    group.position.fromArray(position);
    group.rotation.y = yaw[id];
    scene.add(group);
    placed[id] = { group, origin: new THREE.Vector3(...position),
      view: new THREE.Vector3(...cameras[id].camera.direction).negate().normalize() };
  }));

  // Distant stars remain in world space, so camera travel creates real parallax.
  const starCanvas = document.createElement('canvas'); starCanvas.width = starCanvas.height = 32;
  const context = starCanvas.getContext('2d');
  const glow = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, '#fff7ea'); glow.addColorStop(.2, '#fff7eae0');
  glow.addColorStop(.5, '#cadbff55'); glow.addColorStop(1, '#cadbff00');
  context.fillStyle = glow; context.fillRect(0, 0, 32, 32);
  const starTexture = new THREE.CanvasTexture(starCanvas);
  const starCoordinates = [];
  for (let i = 0; i < 1000; i++) {
    const p = new THREE.Vector3(random(i * 3) * 2 - 1, random(i * 3 + 1) * 2 - 1, random(i * 3 + 2) * 2 - 1).normalize().multiplyScalar(65 + random(i + 800) * 95);
    starCoordinates.push(p.x, p.y, p.z);
  }
  const stars = new THREE.BufferGeometry(); stars.setAttribute('position', new THREE.Float32BufferAttribute(starCoordinates, 3));
  const starfield = new THREE.Points(stars, new THREE.PointsMaterial({ size: 1.2, map: starTexture, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(starfield);

  // Multisample both offscreen targets: renderer.antialias alone only applies
  // to the default framebuffer and would leave these moving edges jagged.
  const makeComposer = () => {
    const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(1.5);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    return composer;
  };
  const lights = makeComposer();
  lights.renderToScreen = false;
  lights.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), .6, .2, .8));
  const composite = makeComposer();
  const lightMix = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, lightTexture: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform sampler2D lightTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(tDiffuse, vUv) + vec4(texture2D(lightTexture, vUv).rgb * .25, 0.0); }',
  });
  composite.addPass(lightMix);
  composite.addPass(new OutputPass());
  const occluder = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const surfaceMaterials = surfaces.map((mesh) => mesh.material);

  // Travel in a loop with deliberate holds, fast crossings and a wide return.
  const wide = { position: new THREE.Vector3(0, 18, 43), target: new THREE.Vector3(0, 0, 0), fov: 35, bank: 0 };
  const close = (id, orbit) => {
    const island = placed[id];
    const view = island.view.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit + yaw[id]);
    return { position: island.origin.clone().addScaledVector(view, id === 'work' ? 19 : 18.5), target: island.origin.clone(), fov: 34, bank: orbit * -.16 };
  };
  const shots = [
    { t: 0, shot: () => wide, title: 'home' },
    { t: 1.1, shot: () => wide, title: 'home' },
    { t: 2.1, shot: () => close('work', -.12), title: 'work' },
    { t: 3.65, shot: () => close('work', .16), title: 'work' },
    { t: 4.6, shot: () => close('writing', -.16), title: 'writing' },
    { t: 6.15, shot: () => close('writing', .14), title: 'writing' },
    { t: 7.1, shot: () => close('projects', -.14), title: 'projects' },
    { t: 8.65, shot: () => close('projects', .18), title: 'projects' },
    { t: 10.1, shot: () => wide, title: 'home' },
    { t: 12, shot: () => wide, title: 'home' },
  ];
  const titles = Object.fromEntries([...root.querySelectorAll('[data-title]')].map((el) => [el.dataset.title, el]));
  function render(time) {
    const t = time % 12;
    let index = shots.findIndex((shot, i) => i < shots.length - 1 && t >= shot.t && t < shots[i + 1].t);
    if (index < 0) index = 0;
    const a = shots[index], b = shots[index + 1];
    const local = (t - a.t) / (b.t - a.t);
    const crossing = a.title !== b.title;
    const e = smooth(local);
    const from = a.shot(), to = b.shot();
    camera.position.copy(from.position).lerp(to.position, e);
    camera.position.y += crossing ? Math.sin(e * Math.PI) * 4 : 0;
    camera.lookAt(from.target.clone().lerp(to.target, e));
    camera.rotateZ(mix(from.bank, to.bank, e) + (crossing ? Math.sin(e * Math.PI * 2) * .045 : 0));
    camera.fov = mix(from.fov, to.fov, e) + (crossing ? Math.sin(e * Math.PI) * 8 : 0);
    for (const [id, island] of Object.entries(placed)) {
      const phase = t / 12 * Math.PI * 2 + ['work', 'writing', 'projects'].indexOf(id) * 2;
      island.group.position.y = island.origin.y + Math.sin(phase) * .15;
    }
    const weights = { home: 0, work: 0, writing: 0, projects: 0 };
    weights[a.title] += 1 - e; weights[b.title] += e;
    // Opening/closing leave room for the name; close-ups use the whole frame.
    camera.setViewOffset(width, height, -mix(80, 215, weights.home), 0, width, height);
    camera.updateProjectionMatrix();
    for (const [name, element] of Object.entries(titles)) {
      const opacity = crossing ? Math.max(0, (weights[name] - .5) * 2) : weights[name];
      element.style.opacity = String(opacity);
      element.style.transform = `translateY(${(1 - weights[name]) * 24}px)`;
    }
    root.querySelector('.cinema-byline').style.opacity = String(1 - weights.home);
    // Black geometry still writes depth, so a lamp cannot shine through a
    // wall or island as the camera circles. Restore the baked scene afterward.
    surfaces.forEach((mesh) => { mesh.material = occluder; });
    starfield.visible = false;
    lights.render();
    surfaces.forEach((mesh, i) => { mesh.material = surfaceMaterials[i]; });
    starfield.visible = true;
    lightMix.uniforms.lightTexture.value = lights.readBuffer.texture;
    composite.render();
  }
  render(0);
  return { render };
}
