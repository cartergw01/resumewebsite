"use client";

import { useEffect, useRef } from "react";
import { CITY_TIME_EVENT, currentCityTime } from "@/lib/city-time";
import { lightsOn } from "@/lib/room-lights";

type Point = number[];
export type Life = { lanes?: Point[][]; tower?: Point[]; lamp?: Point; cone?: Point; festoon?: Point[]; bulb?: Point[]; yard?: Point[]; lava?: Point[]; ball?: Point[]; strips?: number[][][]; fireworks?: { tiers: Point[][]; top: Point } };
export type ParallaxState = { x: number; y: number; focus: number; depth?: (x: number, y: number) => number };

// Small things that move, placed with points projected from the Blender scene
// (scripts/blender/export_life_anchors.py): Taipei's traffic,
// dust in the study's lamplight and wax rising in its lava lamp, the shed's
// festoon bulbs, colour-cycling LED ball and fireflies, and a light travelling
// along the workshop's LED strips. With a room's lights off they all go dark
// but the fireflies.
// One canvas at ~30fps, only while the island is settled and visible; it
// follows the depth parallax so the details stay on their surfaces.
export default function IslandLife({ world, life, className }: { world: "work" | "writing" | "projects"; life: Life; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const visual = canvas?.closest<HTMLElement>("[data-island-visual]") as (HTMLElement & { parallax?: ParallaxState }) | null;
    const scene = canvas?.closest<HTMLElement>("[data-island-scene]");
    const stage = canvas?.closest<HTMLElement>("[data-island-stage]");
    const context = canvas?.getContext("2d");
    if (!canvas || !visual || !scene || !stage || !context) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = 0, width = 0, height = 0, ratio = 1, time = 0;
    const random = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };

    // Most of each avenue is hidden behind the blocks lining it, so each lane
    // carries enough cars that the stretches in view stay busy.
    const cars = (life.lanes ?? []).flatMap((lane, index) => Array.from({ length: 6 }, (_, k) => ({
      lane, index, t: random(index * 7 + k) , speed: .028 + random(index * 3 + k * 11) * .03,
      tint: ["236,236,230", "214,218,222", "238,196,64", "180,186,194"][Math.floor(random(index + k * 5) * 4)],
    })));
    const motes = Array.from({ length: 18 }, (_, i) => ({ u: random(i), v: random(i + 40), phase: random(i + 80) * 6.28, speed: .5 + random(i + 120) }));
    const flies = Array.from({ length: 5 }, (_, i) => ({ seed: i * 17.3, phase: random(i + 7) * 6.28 }));
    // Wax blobs: each rises and sinks on its own slow cycle.
    const wax = Array.from({ length: 4 }, (_, i) => ({ period: 16 + random(i + 200) * 12, phase: random(i + 230) * 6.28, size: .38 + random(i + 260) * .22, drift: random(i + 290) * 6.28 }));

    const live = () => !document.hidden && scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering && !visual.dataset.orbitLive;
    const place = () => {
      const scale = Math.min(width / 1200, height / 800);
      return { scale, left: (width - 1200 * scale) / 2, top: (height - 800 * scale) / 2 };
    };
    const resize = () => {
      ratio = Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1 : 1.5);
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    };
    const along = (points: Point[], t: number) => {
      const f = Math.max(0, Math.min(.9999, t)) * (points.length - 1);
      const i = Math.floor(f), k = f - i;
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * k, points[i][1] + (points[i + 1][1] - points[i][1]) * k];
    };
    // How much of a car the camera can see at t: lane samples carry 1 where
    // the road is in view and 0 behind a building, so cars slip out of sight
    // behind towers instead of sliding across them. Older anchors without it
    // count as always seen.
    const seen = (points: Point[], t: number) => {
      const f = Math.max(0, Math.min(.9999, t)) * (points.length - 1);
      const i = Math.floor(f), k = f - i;
      const a = points[i][2] ?? 1, b = points[i + 1][2] ?? 1;
      return a + (b - a) * k;
    };
    const glow = (x: number, y: number, r: number, color: string, alpha: number) => {
      const g = context.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${color},${alpha})`); g.addColorStop(1, `rgba(${color},0)`);
      context.fillStyle = g; context.fillRect(x - r, y - r, r * 2, r * 2);
    };
    // A soft blob stretched tall (a rising wax drop) or wide.
    const blob = (x: number, y: number, r: number, stretch: number, color: string, alpha: number) => {
      context.save(); context.translate(x, y); context.scale(1 / Math.sqrt(stretch), Math.sqrt(stretch));
      glow(0, 0, r, color, alpha); context.restore();
    };
    // The LED ball's colour: once round the wheel every 24s, starting on purple.
    const hue = (t: number) => {
      const h = (280 + 360 * (t / 24 + .08 * Math.sin(t / 24 * Math.PI * 2))) % 360;
      const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (.6 - .4 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
      return `${f(0)},${f(8)},${f(4)}`;
    };
    const size = (pair?: Point[]) => pair && pair.length > 1 ? Math.hypot(pair[1][0] - pair[0][0], pair[1][1] - pair[0][1]) : 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = last ? now - last : 33;
      if (dt < 30) return;
      last = now; time += Math.min(dt, 100) / 1000;
      const { scale, left, top } = place();
      const p = visual.parallax;
      // Image point -> screen, including the parallax shift at that depth.
      const at = (x: number, y: number) => {
        let sx = x, sy = y;
        // The shader samples from the shifted point, so content moves the other way.
        if (p?.depth) { const d = p.depth(x, y) - p.focus; sx -= p.x * d * 1200; sy -= p.y * d * 800; }
        return [left + sx * scale, top + sy * scale];
      };
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      const night = world !== "work" || currentCityTime() === "night";
      if (world === "work") {
        for (const car of cars) {
          car.t += car.speed * Math.min(dt, 100) / 1000 / 2.2;
          if (car.t > 1) car.t -= 1;
          const forward = car.index % 2 === 0;
          const t = forward ? car.t : 1 - car.t;
          const tail = forward ? t - .025 : t + .025;
          // A night streak shows only while both its head and tail are in view.
          const visible = night ? Math.min(seen(car.lane, t), seen(car.lane, tail)) : seen(car.lane, t);
          if (visible < .02) continue;
          const [x, y] = at(...(along(car.lane, t) as [number, number]));
          if (night) {
            const [bx, by] = at(...(along(car.lane, tail) as [number, number]));
            const color = forward ? "255,240,214" : "255,70,52";
            context.strokeStyle = `rgba(${color},${.55 * visible})`; context.lineWidth = Math.max(.8, 1.4 * scale);
            context.beginPath(); context.moveTo(bx, by); context.lineTo(x, y); context.stroke();
            glow(x, y, 3.2 * scale * 1.6, color, .9 * visible);
          } else {
            context.globalCompositeOperation = "source-over";
            context.fillStyle = `rgba(${car.tint},${.95 * visible})`;
            context.beginPath(); context.arc(x, y, Math.max(.9, 1.5 * scale), 0, Math.PI * 2); context.fill();
            context.globalCompositeOperation = "lighter";
          }
        }
      }
      const roomLit = world !== "work" && lightsOn(world);
      if (world === "writing" && roomLit && life.lava && life.lava.length > 2) {
        // Amber wax rising and sinking through the lava lamp's magenta liquid.
        const [[bx, by], [tx, ty], [ex, ey]] = life.lava;
        const width = Math.hypot(ex - (bx + tx) / 2, ey - (by + ty) / 2);
        const [mx, my] = at((bx + tx) / 2, (by + ty) / 2);
        glow(mx, my, width * 3.2 * scale, "255,70,150", .10 + .03 * Math.sin(time * .7));
        for (const drop of wax) {
          const u = (1 - Math.cos(time / drop.period * Math.PI * 2 + drop.phase)) / 2;
          const rising = Math.sin(time / drop.period * Math.PI * 2 + drop.phase);
          const ix = bx + (tx - bx) * u + Math.sin(time * .3 + drop.drift) * width * .25;
          const iy = by + (ty - by) * u;
          // Narrower toward the bottle's tapered top; stretched while moving.
          const r = width * drop.size * (1 - .35 * u) * scale;
          const [x, y] = at(ix, iy);
          blob(x, y, r * 1.5, 1 + .45 * Math.abs(rising), "255,150,50", .55);
          blob(x, y, r * .8, 1 + .45 * Math.abs(rising), "255,214,140", .35);
        }
      }
      // A soft light travels along each LED strip, which breathes gently.
      for (const [i, [a, b, rgb]] of (roomLit ? life.strips ?? [] : []).entries()) {
        const color = rgb.join(","), length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const [ax, ay] = at(a[0], a[1]), [bx, by] = at(b[0], b[1]);
        context.strokeStyle = `rgba(${color},${(.12 + .06 * Math.sin(time * .8 + i)).toFixed(3)})`;
        context.lineWidth = Math.max(1.2, 3 * scale);
        context.beginPath(); context.moveTo(ax, ay); context.lineTo(bx, by); context.stroke();
        // One pulse per ~250px of strip, moving at ~45px a second.
        const pulses = Math.max(1, Math.round(length / 250));
        for (let k = 0; k < pulses; k++) {
          const u = ((time * 45 / Math.max(length, 1)) + k / pulses + i * .31) % 1;
          const [x, y] = at(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
          glow(x, y, Math.max(10, Math.min(28, length * .08)) * scale, color, .5);
        }
      }
      if (world === "writing" && life.lamp && life.cone && lightsOn("writing")) {
        // Dust drifting slowly through the lamp's cone of light.
        const [lx, ly] = life.lamp, [cx, cy] = life.cone;
        for (const mote of motes) {
          const v = (mote.v + time * .018 * mote.speed) % 1;
          const spread = (.2 + v * .9) * 34;
          const ix = lx + (cx - lx) * v + Math.sin(time * .6 * mote.speed + mote.phase) * spread * (mote.u - .5) * 2;
          const iy = ly + (cy - ly) * v;
          const twinkle = .35 + .65 * Math.max(0, Math.sin(time * 1.3 * mote.speed + mote.phase));
          const [x, y] = at(ix, iy);
          glow(x, y, 1.8 * scale * 1.6, "255,226,170", .5 * twinkle * Math.sin(Math.PI * v));
        }
      } else if (world === "projects") {
        // With the workshop's lights off only the fireflies are left.
        const lit = lightsOn("projects");
        for (const [i, [bx, by]] of (lit ? life.festoon ?? [] : []).entries()) {
          const breath = .55 + .25 * Math.sin(time * 1.1 + i * 1.7) + .12 * Math.sin(time * 2.9 + i);
          const [x, y] = at(bx, by);
          glow(x, y, 6 * scale * 1.6, "255,214,150", .35 * breath);
        }
        for (const [bx, by] of lit ? life.bulb ?? [] : []) {
          const flicker = .8 + .2 * Math.sin(time * 23) * Math.sin(time * 3.1);
          const [x, y] = at(bx, by);
          glow(x, y, 14 * scale * 1.6, "255,206,140", .22 * flicker);
        }
        // The LED ball slowly cycles through its colours.
        if (roomLit && life.ball) {
          const unit = size(life.ball);
          const color = hue(time);
          const [x, y] = at(life.ball[0][0], life.ball[0][1]);
          glow(x, y, unit * 1.05 * scale, color, .6);
          glow(x, y, unit * 3.2 * scale, color, .18);
        }
        const yard = life.yard ?? [];
        for (const [i, fly] of flies.entries()) {
          if (!yard.length) break;
          const home = yard[i % yard.length];
          const ix = home[0] + Math.sin(time * .45 + fly.seed) * 26 + Math.sin(time * 1.3 + fly.seed * 2) * 7;
          const iy = home[1] - 10 + Math.cos(time * .38 + fly.seed) * 12;
          const blink = Math.max(0, Math.sin(time * 1.6 + fly.phase)) ** 3;
          const [x, y] = at(ix, iy);
          glow(x, y, 2.6 * scale * 1.6, "214,255,140", .85 * blink);
        }
      }
      if (!live()) { cancelAnimationFrame(frame); frame = 0; last = 0; }
    };
    const sync = () => {
      if (motion.matches || !live()) { cancelAnimationFrame(frame); frame = 0; last = 0; if (!live()) context.clearRect(0, 0, canvas.width, canvas.height); return; }
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    observer.observe(visual, { attributes: true, attributeFilter: ["data-orbit-live"] });
    const sizes = new ResizeObserver(resize); sizes.observe(canvas);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener(CITY_TIME_EVENT, sync);
    resize(); sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); sizes.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener(CITY_TIME_EVENT, sync);
    };
  }, [world, life]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-island-life={world} />;
}
