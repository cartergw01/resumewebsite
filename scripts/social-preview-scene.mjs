// Browser-only capture: current island artwork, with camera travel and star parallax.
import * as THREE from 'three';
const smooth = (t) => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const mix = (a, b, t) => a + (b - a) * t;
const random = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

async function islandTexture(id, asset) {
  const artwork = new Image();
  artwork.src = asset.src;
  await artwork.decode();
  const canvas = document.createElement('canvas');
  canvas.width = asset.width; canvas.height = asset.height;
  const context = canvas.getContext('2d');
  context.drawImage(artwork, 0, 0, canvas.width, canvas.height);
  if (id === 'writing') {
    const bird = document.querySelector('[data-overview="intro"] [data-overview-bird]');
    if (!bird) throw new Error('The homepage Writing bird is missing from the capture.');
    const image = new Image();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">${bird.outerHTML}</svg>`;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

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
  renderer.setClearColor(0x030611);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, width / height, .1, 500);
  camera.setViewOffset(width, height, -215, 0, width, height);
  const placed = {};
  const positions = { work: [-9, 2, -3], writing: [-1, -1, 8], projects: [10, 3, -4] };
  const yaw = { work: .08, writing: -.1, projects: .12 };
  await Promise.all(Object.entries(positions).map(async ([id, position]) => {
    const texture = await islandTexture(id, assets[id]);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const island = new THREE.Mesh(new THREE.PlaneGeometry(12, 8),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .01, depthWrite: false, toneMapped: false }));
    island.position.fromArray(position);
    scene.add(island);
    placed[id] = { island, origin: new THREE.Vector3(...position),
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
      island.island.position.y = island.origin.y + Math.sin(phase) * .15;
      island.island.quaternion.copy(camera.quaternion);
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
    renderer.render(scene, camera);
  }
  render(0);
  return { render };
}
