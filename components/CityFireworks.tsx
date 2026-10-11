"use client";

import { useEffect, useRef } from "react";
import { currentCityTime, CITY_TIME_EVENT } from "@/lib/city-time";

type Spark = { x: number; y: number; px: number; py: number; vx: number; vy: number };
type Burst = { x: number; y: number; from: number; born: number; life: number; color: string; sparks: Spark[]; burst: boolean };
// A spark fired out of one of the tower's tiers: it flies outward, arcs and falls.
type Ember = { x: number; y: number; vx: number; vy: number; born: number; life: number; color: string };
export type TowerLaunch = { tiers: number[][][]; top: number[] };

const PALETTES = ["255,211,138", "255,143,176", "255,241,214", "255,190,120"];
const RISE = 750;

// Fireworks out of Taipei 101 at night, like its New Year show: fire sprays
// out of the corners of each tier in turn, climbing the tower, and then a
// shell rises off the spire and bursts above it. Between shows a lone shell
// now and then leaves the spire. Launch points are projected from the Blender
// tower (scripts/blender/export_life_anchors.py). It draws only while sparks
// are alive, so at rest it costs nothing; it waits for the camera to settle,
// steps aside by day, during entries and live 3D orbits, and respects reduced
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
    const bursts: Burst[] = [];
    const embers: Ember[] = [];
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, run: () => void) => { const id = setTimeout(() => { pending.delete(id); if (allowed()) run(); }, ms); pending.add(id); };
    const spire = from?.top ?? [tower[0], tower[1] - 90];
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined, width = 0, height = 0, ratio = 1;

    const allowed = () => !motion.matches && !document.hidden && currentCityTime() === "night"
      && scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering && !visual.dataset.orbitLive;
    // The artwork is a 1200x800 render drawn with object-fit: contain.
    const place = () => {
      const scale = Math.min(width / 1200, height / 800);
      return { scale, left: (width - 1200 * scale) / 2, top: (height - 800 * scale) / 2 };
    };
    const resize = () => {
      ratio = Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1 : 2);
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    };
    // A shell off the spire: it climbs, then bursts into a round flower.
    const shell = (color: string) => {
      const x = spire[0] + (Math.random() - .5) * 14;
      const y = spire[1] - 55 - Math.random() * 45;
      const count = 48 + Math.floor(Math.random() * 22);
      const speed = .10 + Math.random() * .045;
      const sparks: Spark[] = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * .2;
        const v = speed * (.75 + Math.random() * .3);
        return { x, y, px: x, py: y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v };
      });
      bursts.push({ x, y, from: spire[1], born: performance.now(), life: 1500 + Math.random() * 500, color, sparks, burst: false });
      if (!frame) frame = requestAnimationFrame(draw);
    };
    // A spray from one corner of a tier: sparks fly outward, mostly sideways
    // and a little up, then arc down.
    const spray = ([x, y]: number[], outward: number, color: string) => {
      const now = performance.now();
      for (let i = 0; i < 12; i++) {
        const angle = -.15 + Math.random() * .85;
        const speed = .07 + Math.random() * .08;
        embers.push({ x, y, vx: outward * Math.cos(angle) * speed, vy: -Math.sin(angle) * speed, born: now, life: 1000 + Math.random() * 600, color });
      }
      if (!frame) frame = requestAnimationFrame(draw);
    };
    // The show: tier by tier up the tower, both corners at once, then the crown.
    const show = () => {
      const color = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      const tiers = from?.tiers ?? [];
      tiers.forEach(([left, right], i) => later(i * 150, () => { spray(left, -1, color); spray(right, 1, color); }));
      later(tiers.length * 150 + 150, () => shell(color));
      // Now and then a second shell follows closely.
      if (Math.random() < .35) later(tiers.length * 150 + 550 + Math.random() * 300, () => shell(PALETTES[Math.floor(Math.random() * PALETTES.length)]));
    };
    let last = 0;
    const draw = (now: number) => {
      const dt = Math.min(40, last ? now - last : 16); last = now;
      const { scale, left, top } = place();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      context.lineCap = "round";
      const line = Math.max(1.1, 2 * scale);
      for (let e = embers.length - 1; e >= 0; e--) {
        const ember = embers[e];
        const age = now - ember.born;
        if (age > ember.life) { embers.splice(e, 1); continue; }
        ember.vx *= Math.pow(.9982, dt); ember.vy = ember.vy * Math.pow(.9982, dt) + .00011 * dt;
        ember.x += ember.vx * dt; ember.y += ember.vy * dt;
        const fade = Math.pow(1 - age / ember.life, 1.4);
        const hx = left + ember.x * scale, hy = top + ember.y * scale;
        context.strokeStyle = `rgba(${ember.color},${(fade * .75).toFixed(3)})`; context.lineWidth = line;
        context.beginPath(); context.moveTo(hx - ember.vx * 70 * scale, hy - ember.vy * 70 * scale); context.lineTo(hx, hy); context.stroke();
        context.fillStyle = `rgba(255,248,235,${fade.toFixed(3)})`;
        context.beginPath(); context.arc(hx, hy, line * .7, 0, Math.PI * 2); context.fill();
      }
      for (let b = bursts.length - 1; b >= 0; b--) {
        const burst = bursts[b];
        const age = now - burst.born;
        if (age < RISE) {
          // The climb: a thin fading streak with a bright head.
          const k = 1 - Math.pow(1 - age / RISE, 2);
          const y = burst.from + (burst.y - burst.from) * k;
          const sx = left + burst.x * scale, sy = top + y * scale;
          const tail = top + Math.min(burst.from, y + 26) * scale;
          const gradient = context.createLinearGradient(sx, sy, sx, tail);
          gradient.addColorStop(0, `rgba(${burst.color},.85)`); gradient.addColorStop(1, `rgba(${burst.color},0)`);
          context.strokeStyle = gradient; context.lineWidth = 1.1;
          context.beginPath(); context.moveTo(sx, sy); context.lineTo(sx, tail); context.stroke();
          continue;
        }
        const t = age - RISE;
        if (t > burst.life) { bursts.splice(b, 1); continue; }
        const fade = Math.pow(1 - t / burst.life, 1.6);
        const width = Math.max(1, 2.4 * scale);
        context.fillStyle = `rgba(255,248,235,${fade.toFixed(3)})`;
        for (const spark of burst.sparks) {
          spark.vx *= Math.pow(.9985, dt); spark.vy = spark.vy * Math.pow(.9985, dt) + .000045 * dt;
          spark.x += spark.vx * dt; spark.y += spark.vy * dt;
          // A streak whose length follows the spark's speed, and a bright head.
          spark.px = spark.x - spark.vx * 110; spark.py = spark.y - spark.vy * 110;
          const hx = left + spark.x * scale, hy = top + spark.y * scale;
          const trail = context.createLinearGradient(left + spark.px * scale, top + spark.py * scale, hx, hy);
          trail.addColorStop(0, `rgba(${burst.color},0)`); trail.addColorStop(1, `rgba(${burst.color},${fade.toFixed(3)})`);
          context.strokeStyle = trail; context.lineWidth = width;
          context.beginPath(); context.moveTo(left + spark.px * scale, top + spark.py * scale); context.lineTo(hx, hy); context.stroke();
          context.beginPath(); context.arc(hx, hy, width * .75, 0, Math.PI * 2); context.fill();
        }
        // A brief soft flash where it bursts.
        if (t < 220) {
          const r = (14 + t / 8) * scale * 2;
          const glow = context.createRadialGradient(left + burst.x * scale, top + burst.y * scale, 0, left + burst.x * scale, top + burst.y * scale, r);
          glow.addColorStop(0, `rgba(${burst.color},${(.35 * (1 - t / 220)).toFixed(3)})`); glow.addColorStop(1, `rgba(${burst.color},0)`);
          context.fillStyle = glow; context.fillRect(left + burst.x * scale - r, top + burst.y * scale - r, r * 2, r * 2);
        }
      }
      frame = bursts.length || embers.length ? requestAnimationFrame(draw) : 0;
      if (!frame) { last = 0; context.clearRect(0, 0, width, height); }
    };
    const schedule = () => {
      clearTimeout(timer); timer = undefined;
      if (!allowed()) {
        pending.forEach(clearTimeout); pending.clear();
        bursts.length = 0; embers.length = 0; cancelAnimationFrame(frame); frame = 0; context.clearRect(0, 0, canvas.width, canvas.height); return;
      }
      timer = setTimeout(() => {
        if (!allowed()) return;
        // Mostly the full show; sometimes just a shell off the spire.
        if (from && Math.random() < .7) show(); else shell(PALETTES[Math.floor(Math.random() * PALETTES.length)]);
        schedule();
      }, 3200 + Math.random() * 3600);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    observer.observe(visual, { attributes: true, attributeFilter: ["data-orbit-live"] });
    const sizes = new ResizeObserver(resize);
    sizes.observe(canvas);
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
