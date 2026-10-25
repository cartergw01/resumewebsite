// Render the site's real 3D islands as a cinematic social-sharing loop.
// Requires the local site, Playwright Chromium and FFmpeg on PATH.
// Usage: node scripts/render-social-preview.mjs http://127.0.0.1:3101 v6 [--stills]
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const origin = process.argv[2] || 'http://127.0.0.1:3101';
const version = process.argv[3] || 'v6';
const stills = process.argv.includes('--stills');
if (!/^v[1-9]\d*$/.test(version)) throw new Error('Use a version such as v6 or v7.');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public', `social-preview-${version}`);
const width = 1200, height = 630, fps = 30, seconds = 12;
// Offline models retain the original emissive fixtures and denser light pools.
// They are deliberately served only to this browser, never copied to public/.
const captureModels = path.join(root, '.blender-build/social-preview');
const assets = Object.fromEntries(['work', 'writing', 'projects'].map((id) => [id, { src: `/__social-render/${id}.glb` }]));
for (const id of Object.keys(assets)) {
  try { await access(path.join(captureModels, `${id}.glb`)); }
  catch {
    if (!stills) throw new Error(`Missing ${id} capture model. Run export_flight.py with --world ${id} --social-preview --faces 220000 --samples 48 first.`);
    const flight = JSON.parse(await readFile(path.join(root, 'lib/island-flight-assets.json'), 'utf8'));
    assets[id] = flight[id];
    console.warn(`Still review uses the old ${id} flight model until its capture bake is ready.`);
  }
}
const cameras = JSON.parse(await readFile(path.join(root, 'lib/island-cameras.json'), 'utf8'));
const temporary = await mkdtemp(path.join(tmpdir(), 'carter-social-preview-'));
// Headless Chromium otherwise selects SwiftShader on macOS. Native Metal
// keeps the detailed, antialiased offline capture practical to regenerate.
const browser = await chromium.launch({ headless: true,
  args: process.platform === 'darwin' ? ['--use-gl=angle', '--use-angle=metal'] : [],
});
let encoder;
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  // Browser-only modules are exposed just to this capture context; no new
  // public application routes or client bundles are shipped with the video.
  await page.route('**/__social-render/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/__social-render/')[1];
    if (!name || name.includes('..')) return route.abort();
    let source;
    if (['work.glb', 'writing.glb', 'projects.glb'].includes(name)) source = path.join(captureModels, name);
    else if (name === 'scene.mjs') source = path.join(root, 'scripts/social-preview-scene.mjs');
    else if (['three.module.js', 'three.core.js'].includes(name)) source = path.join(root, 'node_modules/three/build', name);
    else if (name.startsWith('addons/')) source = path.join(root, 'node_modules/three/examples/jsm', name.slice(7));
    else return route.abort();
    await route.fulfill({ contentType: name.endsWith('.glb') ? 'model/gltf-binary' : 'application/javascript', body: await readFile(source) });
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('#hero-title').waitFor();
  await page.waitForFunction(() => history.state?.__NA);
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ type: 'importmap', content: JSON.stringify({ imports: {
    three: '/__social-render/three.module.js',
    'three/addons/': '/__social-render/addons/',
  } }) });
  await page.addScriptTag({ type: 'module', content: `
    import { createSocialScene } from '/__social-render/scene.mjs';
    createSocialScene(${JSON.stringify({ assets, cameras, width, height })})
      .then(scene => { window.__socialScene = scene; })
      .catch(error => { window.__socialError = error.stack || String(error); });
  ` });
  await page.waitForFunction(() => window.__socialScene || window.__socialError, null, { timeout: 60_000 });
  const error = await page.evaluate(() => window.__socialError);
  if (error) throw new Error(error);
  await page.clock.pauseAt(new Date());
  await page.evaluate(() => {
    for (const video of document.querySelectorAll('video')) video.pause();
    for (const animation of document.getAnimations()) animation.pause();
  });

  if (stills) {
    const folder = path.join(tmpdir(), `carter-social-${version}-stills`);
    await mkdir(folder, { recursive: true });
    for (const [index, time] of [0, 2.75, 5.25, 7.75, 9.5].entries()) {
      await page.evaluate((t) => window.__socialScene.render(t), time);
      await page.screenshot({ path: path.join(folder, `frame-${index + 1}.jpg`), type: 'jpeg', quality: 94 });
    }
    console.log(`Review frames: ${folder}`);
  } else {
    encoder = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', 'pipe:0',
      '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-maxrate', '2800k', '-bufsize', '5600k',
      '-vf', 'scale=in_range=full:out_range=limited,format=yuv420p', '-color_range', 'tv',
      '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-level:v', '3.1',
      '-movflags', '+faststart', path.join(temporary, 'preview.mp4'),
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    // Handle a missing/failed encoder immediately without an unhandled rejection.
    const encoded = once(encoder, 'close').catch((error) => [null, error]);
    let encodingError;
    encoder.on('error', (error) => { encodingError = error; });
    encoder.stdin.on('error', (error) => { encodingError = error; });
    for (let frame = 0; frame < seconds * fps; frame++) {
      if (encodingError) throw encodingError;
      await page.evaluate((time) => window.__socialScene.render(time), frame / fps);
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (frame === 0) await page.screenshot({ path: path.join(temporary, 'poster.jpg'), type: 'jpeg', quality: 90 });
      if (!encoder.stdin.write(jpeg)) await Promise.race([
        once(encoder.stdin, 'drain'),
        encoded.then(() => { throw encodingError || new Error('FFmpeg closed before capture completed'); }),
      ]);
      if (frame % 60 === 0) console.log(`Rendered ${frame + 1} of ${seconds * fps} frames`);
    }
    encoder.stdin.end();
    const [code, error] = await encoded;
    if (error) throw error;
    if (code !== 0) throw new Error(`FFmpeg exited with code ${code}`);
    await copyFile(path.join(temporary, 'preview.mp4'), `${output}.mp4`);
    await copyFile(path.join(temporary, 'poster.jpg'), `${output}.jpg`);
    console.log(`Saved ${output}.{mp4,jpg} (${width} × ${height}, ${seconds}s).`);
  }
} finally {
  encoder?.stdin.destroy();
  if (encoder && encoder.exitCode === null) encoder.kill();
  await browser.close();
  await rm(temporary, { recursive: true, force: true });
}
