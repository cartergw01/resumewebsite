// Render seamless 12-second, 30fps starfield clips in landscape and portrait.
// Usage: node scripts/render-starfield-loop.mjs /tmp/starfield-loop-frames
// Encode each folder with FFmpeg, e.g.:
// ffmpeg -framerate 30 -i /tmp/starfield-loop-frames/desktop/%04d.png
//   -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart
//   -an public/starfield-loop-desktop-v1.mp4
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const output = process.argv[2];
if (!output) throw new Error("Provide a temporary frame-output directory.");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas id="frame"></canvas>');
  await page.evaluate(() => {
    const canvas = document.getElementById("frame");
    const ctx = canvas.getContext("2d", { alpha: false });
    const random = (n) => {
      const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const smooth = (n) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
    window.renderFrame = ({ width, height, frame }) => {
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const fraction = frame / 360;
      const unit = Math.min(width, height) / 900;
      ctx.fillStyle = "#030611";
      ctx.fillRect(0, 0, width, height);

      // Different depths give a visible, unhurried flight through empty space.
      // Each star fades at its own cycle boundary so frame 360 equals frame 0.
      for (let index = 0; index < 115; index++) {
        const depth = 0.2 + random(index * 7 + 1) * 0.8;
        const phase = random(index * 7 + 2);
        const life = (fraction + phase) % 1;
        const travel = (65 + depth * 230) * unit;
        const x = random(index * 7 + 3) * (width + 220 * unit) - 110 * unit - (life - 0.5) * travel;
        const y = random(index * 7 + 4) * (height + 100 * unit) - 50 * unit + (life - 0.5) * travel * 0.27;
        const envelope = smooth(life / 0.12) * smooth((1 - life) / 0.12);
        const glimmer = 0.8 + 0.2 * Math.sin(fraction * Math.PI * 4 + phase * Math.PI * 2);
        const alpha = (0.25 + depth * 0.65) * envelope * glimmer;
        const radius = (0.4 + depth * 1.15) * unit;
        if (depth > 0.76) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
          glow.addColorStop(0, `rgba(202,220,255,${alpha * 0.22})`);
          glow.addColorStop(1, "rgba(202,220,255,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
        }
        ctx.fillStyle = `rgba(235,241,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Two brief meteors per loop, away from the headline and island controls.
      for (const [offset, startX, startY] of [[0.08, 0.9, 0.16], [0.57, 0.57, 0.39]]) {
        const age = (fraction - offset + 1) % 1;
        const duration = 0.105;
        if (age >= duration) continue;
        const t = age / duration;
        const alpha = Math.sin(t * Math.PI) ** 1.5 * 0.7;
        const dx = -Math.min(width * 0.38, 470 * unit);
        const dy = 125 * unit;
        const x = width * startX + dx * t;
        const y = height * startY + dy * t;
        const tailX = x - dx * 0.2;
        const tailY = y - dy * 0.2;
        const trail = ctx.createLinearGradient(tailX, tailY, x, y);
        trail.addColorStop(0, "rgba(170,200,245,0)");
        trail.addColorStop(1, `rgba(231,240,255,${alpha})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.2 * unit;
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = `rgba(255,248,226,${alpha})`;
        ctx.beginPath(); ctx.arc(x, y, 1.5 * unit, 0, Math.PI * 2); ctx.fill();
      }
      return canvas.toDataURL("image/png").split(",")[1];
    };
  });

  for (const [name, width, height] of [["desktop", 1600, 900], ["mobile", 900, 1600]]) {
    const folder = path.join(output, name);
    await mkdir(folder, { recursive: true });
    for (let frame = 0; frame < 360; frame++) {
      const png = await page.evaluate((args) => window.renderFrame(args), { width, height, frame });
      await writeFile(path.join(folder, `${String(frame).padStart(4, "0")}.png`), Buffer.from(png, "base64"));
      if (frame % 120 === 0) console.log(`${name}: ${frame}/360 frames`);
    }
    console.log(`${name}: complete (${width} × ${height}, 12 seconds)`);
  }
} finally {
  await browser.close();
}
