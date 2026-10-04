// Run after exporting a model or changing its camera/cropped artwork anchors:
// node scripts/blender/bake-orbit-anchors.mjs
// Resolve the exact same Three.js surface intersections once, off the visitor's
// main thread. Source signatures keep edited assets from using stale anchors.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const manifestPath = resolve(root, 'lib/island-orbit-assets.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const artwork = JSON.parse(await readFile(resolve(root, 'lib/blender-islands.json'), 'utf8'));
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>');
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    const roots = [resolve(root, 'node_modules/three') + '/', resolve(root, 'public') + '/'];
    if (!roots.some(prefix => path.startsWith(prefix))) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', extname(path) === '.js' ? 'text/javascript' : 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  for (const [world, asset] of Object.entries(manifest)) {
    const art = artwork[world];
    const anchors = { landmark: [art.landmark], [world === 'work' ? 'entryWindow' : world === 'writing' ? 'spread' : 'screen']: world === 'work' ? art.entryWindow : world === 'writing' ? art.spread : art.screen };
    const points = await page.evaluate(async ({ asset, anchors }) => {
      const { Box3, PerspectiveCamera, Raycaster, Vector2, Vector3 } = await import('three');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
      const draco = new DRACOLoader().setDecoderPath('/public/draco/').setWorkerLimit(1);
      const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/public' + asset.src);
      gltf.scene.updateMatrixWorld(true);
      const camera = new PerspectiveCamera(asset.camera.fov, 1.5, .05, 150);
      camera.position.fromArray(asset.camera.position);
      const direction = new Vector3().fromArray(asset.camera.direction);
      const center = new Box3().setFromObject(gltf.scene).getCenter(new Vector3());
      const target = camera.position.clone().addScaledVector(direction, center.clone().sub(camera.position).dot(direction));
      camera.lookAt(target);
      camera.setViewOffset(1200, 800, ...asset.crop);
      camera.updateMatrixWorld(true);
      const raycaster = new Raycaster();
      const radius = camera.position.distanceTo(target);
      const points = {};
      for (const [name, coordinates] of Object.entries(anchors)) points[name] = coordinates.map(([x,y]) => {
        raycaster.setFromCamera(new Vector2(x / 600 - 1, 1 - y / 400), camera);
        return (raycaster.intersectObject(gltf.scene, true)[0]?.point ?? raycaster.ray.at(radius, new Vector3())).toArray();
      });
      if (asset.entryWindow3D) points.entryWindow = asset.entryWindow3D;
      draco.dispose();
      return points;
    }, {asset, anchors});
    asset.surfaceAnchors = { signature: JSON.stringify([asset.src, asset.camera, asset.crop, anchors, asset.entryWindow3D]), points };
    console.log(`${world}: baked ${Object.values(points).flat().length} surface anchors`);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
} finally {
  await browser.close();
  server.close();
}
