"use client";

import { useEffect, useRef } from "react";
import { currentCityTime, CITY_TIME_EVENT } from "@/lib/city-time";

// One spark: fired out of the tower, it flies, slows, arcs and fades.
type Spark = { x: number; y: number; vx: number; vy: number; born: number; life: number; color: string; size: number };
export type TowerLaunch = { tiers: number[][][]; top: number[] };

const PALETTES = ["255,211,138", "255,241,214", "255,143,176", "255,190,120", "214,232,255"];
// Taipei 101 lights its tiers in a rainbow; some sweeps colour each tier.
const RAINBOW = ["255,96,96", "255,160,80", "255,222,96", "130,230,120", "110,200,255", "120,140,255", "200,130,255", "255,140,210"];
const random = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

// Fireworks out of Taipei 101 at night, like its New Year show: everything
// fires from the tower itself. Sprays shoot out of the corners of its eight
// tiers in quick patterns (climbing, falling, all at once, a zipper up one
// side and down the other) and the crown bursts off the spire; a show runs for
// about twelve seconds, ends on a finale, rests, and starts again. Launch
// points are projected from the Blender tower (scripts/blender/export_life_anchors.py).
// The canvas reaches well beyond the island so bursts are never cut off. It
// draws only while sparks are alive, at most ~60fps, steps aside by day and
// during entries (bar Work's own answering burst), and respects reduced
// motion.
export default function CityFireworks({ tower, launch: from, className }: { tower: number[]; launch?: TowerLaunch; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const visual = canvas?.closest<HTMLElement>("[data-island-visual]");
    const scene = canvas?.closest<HTMLElement>("[data-island-scene]");
    const stage = canvas?.closest<HTMLElement>("[data-island-stage]");
    const context = canvas?.getContext("2d");
    if (!canvas || !visual || !scene || !stage || !context) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sparks: Spark[] = [];
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const tiers = from?.tiers ?? [];
    const spire = from?.top ?? [tower[0], tower[1] - 90];
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
    let width = 0, height = 0, ratio = 1, artWidth = 0, artHeight = 0, offsetX = 0, offsetY = 0;

    const allowed = () => !motion.matches && !document.hidden && currentCityTime() === "night"
      && scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering;
    // Entering Work at night, the tower answers the tap with one burst off
    // its spire, the only fireworks an entry allows.
    const answering = () => !motion.matches && !document.hidden && currentCityTime() === "night"
      && stage.dataset.entering === "work";
    let answered = false;
    const later = (ms: number, run: () => void, when = allowed) => {
      const id = setTimeout(() => { pending.delete(id); if (when()) run(); }, ms);
      pending.add(id);
    };
    // The artwork is a 1200x800 render drawn with object-fit: contain in the
    // island's box; the canvas is larger than that box and offset from it.
    const place = () => {
      const scale = Math.min(artWidth / 1200, artHeight / 800);
      return { scale, left: offsetX + (artWidth - 1200 * scale) / 2, top: offsetY + (artHeight - 800 * scale) / 2 };
    };
    const resize = () => {
      ratio = Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1 : 1.5);
      width = canvas.clientWidth; height = canvas.clientHeight;
      artWidth = visual.clientWidth; artHeight = visual.clientHeight;
      offsetX = -canvas.offsetLeft; offsetY = -canvas.offsetTop;
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    };
    const start = () => { if (!frame) frame = requestAnimationFrame(draw); };

    // A spray out of one tier corner: sparks fly outward, mostly level and a
    // little up, then arc down.
    const spray = ([x, y]: number[], outward: number, color: string, count = 11, reach = 1) => {
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const angle = random(-.2, .75), speed = random(.08, .17) * reach;
        sparks.push({ x, y, vx: outward * Math.cos(angle) * speed, vy: -Math.sin(angle) * speed, born: now, life: random(900, 1500), color, size: 1 });
      }
      start();
    };
    const tier = (i: number, color: string, count?: number, reach?: number) => {
      const [left, right] = tiers[i];
      spray(left, -1, color, count, reach);
      spray(right, 1, color, count, reach);
    };
    // The crown: a fountain straight up off the spire and a ring burst just above it.
    const crown = (color: string, big = false, when = allowed) => {
      const now = performance.now();
      for (let i = 0; i < 14; i++) {
        const angle = -Math.PI / 2 + random(-.28, .28), speed = random(.1, .2);
        sparks.push({ x: spire[0], y: spire[1], vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, born: now, life: random(800, 1200), color, size: 1 });
      }
      later(260, () => {
        const x = spire[0], y = spire[1] - random(30, 45), count = big ? 70 : 46, born = performance.now();
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + random(0, .15), speed = random(.09, .14) * (big ? 1.25 : 1);
          sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, born, life: random(1300, 1900), color, size: 1.3 });
        }
        start();
      }, when);
      start();
    };

    // Patterns, each fired from the tower. Times in ms from the pattern's start;
    // each returns how long it takes.
    const patterns: Record<string, (color: string) => number> = {
      climb: color => { const rainbow = Math.random() < .4; tiers.forEach((_, i) => later(i * 75, () => tier(i, rainbow ? RAINBOW[i % RAINBOW.length] : color))); return tiers.length * 75; },
      fall: color => { tiers.forEach((_, i) => later(i * 75, () => tier(tiers.length - 1 - i, color))); return tiers.length * 75; },
      ring: color => { tiers.forEach((_, i) => tier(i, color, 8, 1.15)); return 200; },
      zipper: color => {
        tiers.forEach((_, i) => later(i * 85, () => { spray(tiers[i][0], -1, color); spray(tiers[tiers.length - 1 - i][1], 1, color); }));
        return tiers.length * 85;
      },
      crown: color => { crown(color); return 300; },
    };
    let last = "";
    const show = () => {
      const ends = performance.now() + random(10_000, 13_000);
      const next = () => {
        if (performance.now() > ends) {
          // Finale: every tier at once, twice, and a big crown.
          const color = pick(PALETTES);
          if (tiers.length) { patterns.ring(color); later(380, () => patterns.ring(pick(PALETTES))); }
          later(500, () => crown(color, true));
          return;
        }
        const names = tiers.length ? Object.keys(patterns).filter(name => name !== last) : ["crown"];
        last = pick(names);
        const took = patterns[last](pick(PALETTES));
        // Now and then the crown answers the tiers.
        if (last !== "crown" && Math.random() < .35) later(took + 120, () => crown(pick(PALETTES)));
        later(took + random(450, 850), next);
      };
      next();
    };

    let previous = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      // At most ~60fps, even on 120Hz screens.
      if (previous && now - previous < 15) return;
      const dt = Math.min(40, previous ? now - previous : 16); previous = now;
      const { scale, left, top } = place();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      context.lineCap = "round";
      const line = Math.max(1.1, 2 * scale);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        const age = now - spark.born;
        if (age > spark.life) { sparks.splice(i, 1); continue; }
        spark.vx *= Math.pow(.9982, dt); spark.vy = spark.vy * Math.pow(.9982, dt) + .00011 * dt;
        spark.x += spark.vx * dt; spark.y += spark.vy * dt;
        const fade = Math.pow(1 - age / spark.life, 1.4);
        const hx = left + spark.x * scale, hy = top + spark.y * scale;
        // A streak whose length follows the spark's speed, and a bright head.
        context.strokeStyle = `rgba(${spark.color},${(fade * .75).toFixed(3)})`; context.lineWidth = line * spark.size;
        context.beginPath(); context.moveTo(hx - spark.vx * 70 * scale, hy - spark.vy * 70 * scale); context.lineTo(hx, hy); context.stroke();
        context.fillStyle = `rgba(255,248,235,${fade.toFixed(3)})`;
        context.beginPath(); context.arc(hx, hy, line * .7 * spark.size, 0, Math.PI * 2); context.fill();
      }
      if (!sparks.length) { cancelAnimationFrame(frame); frame = 0; previous = 0; context.clearRect(0, 0, width, height); }
    };
    const schedule = () => {
      clearTimeout(timer); timer = undefined;
      if (!allowed()) {
        pending.forEach(clearTimeout); pending.clear();
        sparks.length = 0; cancelAnimationFrame(frame); frame = 0; previous = 0; context.clearRect(0, 0, canvas.width, canvas.height);
        if (answering() && !answered) { answered = true; crown(PALETTES[0], true, answering); }
        if (!stage.dataset.entering) answered = false;
        return;
      }
      answered = false;
      timer = setTimeout(() => {
        if (!allowed()) return;
        show();
        // Leave the skyline quiet between shows; the entry burst still answers immediately.
        timer = setTimeout(schedule, random(24_000, 32_000));
      }, random(1200, 2400));
    };
    const observer = new MutationObserver(schedule);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    const sizes = new ResizeObserver(resize);
    sizes.observe(canvas);
    sizes.observe(visual);
    window.addEventListener(CITY_TIME_EVENT, schedule);
    motion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    resize(); schedule();
    return () => {
      clearTimeout(timer); cancelAnimationFrame(frame);
      pending.forEach(clearTimeout);
      observer.disconnect(); sizes.disconnect();
      window.removeEventListener(CITY_TIME_EVENT, schedule);
      motion.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [tower, from]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-city-fireworks />;
}
