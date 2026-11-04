"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { ENTERS_RIM, fromRest, hoopShot, LEAVES_NET, NET_SETTLE, netAt, project, shadowOf, shotAt, SHOT_DURATION } from "@/lib/hoop-shot";
import { lightsOn, ROOM_LIGHTS_EVENT, ROOM_LIGHTS_INTENT } from "@/lib/room-lights";
import type { ParallaxState } from "./IslandLife";
import styles from "./WorkshopObjects.module.css";

export type HoopShotHandle = { shoot: () => void };

const { atlas, density, frames, regions, world } = hoopShot;
// The canvas only covers the court and hoop, and only draws during a shot.
const AREA = [770, 0, 280, 600];
const rect = (name: keyof typeof atlas) => atlas[name] as number[];
const rimAt = project(world.rim);
const netEnd = project([world.rim[0], world.rim[1], world.rim[2] - world.netDepth]);
const restAt = project(world.ball);
const edgeAt = project([world.ball[0] + world.ballRadius, world.ball[1], world.ball[2]]);
const RADIUS = Math.hypot(edgeAt.x - restAt.x, edgeAt.y - restAt.y);
const SLICE = 1;
// The patch overlaps the cut, so no hairline of sky can show between them.
const CUT_INSET = 1.5;
// The ball's stopped by now: dissolve back into the still, not a hard swap.
const HAND_BACK = .22;

// Tapping the workshop's basketball shoots it. It's baked into the still, so
// for the length of a shot this canvas covers it with the bare court, flies its
// rendered frames along lib/hoop-shot.ts, and passes it behind the rim's front
// and through a net that gives way. At rest the canvas is empty and costs nothing.
export default function HoopShot({ scale, onUnavailable, ref }: { scale: number; onUnavailable: () => void; ref?: Ref<HoopShotHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shootRef = useRef<() => void>(() => {});
  const unavailable = useRef(onUnavailable);
  useEffect(() => { unavailable.current = onUnavailable; }, [onUnavailable]);
  useImperativeHandle(ref, () => ({ shoot: () => shootRef.current() }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const visual = canvas?.closest<HTMLElement>("[data-island-visual]") as (HTMLElement & { parallax?: ParallaxState }) | null;
    const scene = canvas?.closest<HTMLElement>("[data-island-scene]");
    const stage = canvas?.closest<HTMLElement>("[data-island-stage]");
    if (!canvas || !context || !visual || !scene || !stage || !scale) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const sheets: Partial<Record<"lit" | "dark", Promise<HTMLImageElement>>> = {};
    const loaded: Partial<Record<"lit" | "dark", HTMLImageElement>> = {};
    const variant = () => lightsOn("projects") ? "lit" as const : "dark" as const;
    const load = (which: "lit" | "dark") => sheets[which] ??= new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => { loaded[which] = image; resolve(image); };
      image.onerror = () => { delete sheets[which]; reject(new Error("Hoop shot layers failed to load")); };
      image.src = hoopShot[which];
    });
    const settled = () => scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering && !document.hidden;

    const ratio = Math.min(devicePixelRatio, 2.5);
    canvas.width = Math.round(AREA[2] * scale * ratio);
    canvas.height = Math.round(AREA[3] * scale * ratio);
    context.setTransform(scale * ratio, 0, 0, scale * ratio, -AREA[0] * scale * ratio, -AREA[1] * scale * ratio);
    context.imageSmoothingQuality = "high";

    // The still's own net has to go while this one moves: over open sky no
    // painted patch could cover it, so the still is cut away beneath the net.
    const cutNet = (on: boolean) => {
      if (!on) { delete visual.dataset.netCut; return; }
      if (visual.dataset.netCut) return;
      const left = (visual.clientWidth - 1200 * scale) / 2, top = (visual.clientHeight - 800 * scale) / 2;
      const [x, y, w, h] = regions.net;
      visual.style.setProperty("--net-x", `${left + (x + CUT_INSET) * scale}px`);
      visual.style.setProperty("--net-y", `${top + (y + CUT_INSET) * scale}px`);
      visual.style.setProperty("--net-w", `${(w - CUT_INSET * 2) * scale}px`);
      visual.style.setProperty("--net-h", `${(h - CUT_INSET * 2) * scale}px`);
      visual.dataset.netCut = "true";
    };

    const sprite = (sheet: HTMLImageElement, name: keyof typeof atlas, x: number, y: number, alpha = 1) => {
      const [ax, ay, aw, ah] = rect(name);
      context.globalAlpha = alpha;
      context.drawImage(sheet, ax, ay, aw, ah, x, y, aw / density, ah / density);
      context.globalAlpha = 1;
    };
    // The same parallax as the still: the ball sits between its two anchors.
    const shift = (x: number, y: number) => {
      const p = visual.parallax;
      if (!p?.depth) return [0, 0];
      const d = p.depth(x, y) - p.focus;
      return [-p.x * d * 1200, -p.y * d * 800];
    };
    const drawNet = (sheet: HTMLImageElement, name: "net-back" | "net-front", time: number, ballZ: number, offset: number[]) => {
      const [ax, ay, aw] = rect(name);
      const [rx, ry, rw, rh] = regions.net;
      let y = ry;
      for (let row = 0; row < rh; row += SLICE) {
        const source = ry + row;
        const u = Math.max(0, Math.min(1.1, (source - rimAt.y) / (netEnd.y - rimAt.y)));
        const { widen, hang, whip } = netAt(time, u, ballZ);
        // Above the rim's centre the cords stay on the rim; below it they hang.
        const height = source < rimAt.y ? SLICE : SLICE * hang;
        const centre = rimAt.x + (netEnd.x - rimAt.x) * u;
        const width = rw * widen;
        context.drawImage(sheet, ax, ay + row * density, aw, SLICE * density,
          centre + whip + (rx - centre) * widen + offset[0], y + offset[1], width, height + .25);
        y += height;
      }
    };

    let frame = 0, last = 0, time = -1;
    const stop = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0; time = -1;
      cutNet(false);
      context.clearRect(AREA[0], AREA[1], AREA[2], AREA[3]);
      canvas.style.opacity = "";
      canvas.dataset.hoopShot = "idle";
    };
    const draw = (sheet: HTMLImageElement) => {
      const pose = shotAt(time);
      const at = project([pose.x, pose.y, pose.z]);
      context.clearRect(AREA[0], AREA[1], AREA[2], AREA[3]);

      // The court under the ball: its baked shadow fades as it leaves, and a
      // cast shadow takes over and follows it.
      const [cx, cy] = regions.court;
      const courtShift = shift(restAt.x, restAt.y);
      const near = Math.max(0, 1 - fromRest(pose) / .45);
      sprite(sheet, "court-clean", cx + courtShift[0], cy + courtShift[1]);
      if (near > 0) sprite(sheet, "court-shadow", cx + courtShift[0], cy + courtShift[1], near);
      const shadow = shadowOf(pose);
      const strength = shadow.strength * (1 - near);
      if (strength > .01) {
        const on = project([shadow.x, shadow.y, shadow.z]);
        const r = RADIUS * (restAt.depth / on.depth) * 1.15 * shadow.spread;
        context.save();
        context.translate(on.x + courtShift[0], on.y + courtShift[1]);
        context.scale(1, .52);
        const soft = context.createRadialGradient(0, 0, r * .2 / shadow.spread, 0, 0, r);
        const dark = variant() === "lit" ? .42 : .3;
        soft.addColorStop(0, `rgba(6,5,12,${dark * strength})`);
        soft.addColorStop(1, "rgba(6,5,12,0)");
        context.fillStyle = soft;
        context.fillRect(-r, -r, r * 2, r * 2);
        context.restore();
      }

      // The hoop once the ball reaches it, until the cords have stopped.
      const netLive = time >= ENTERS_RIM && time < LEAVES_NET + NET_SETTLE;
      const netShift = shift(rimAt.x, rimAt.y);
      cutNet(netLive);
      if (netLive) {
        sprite(sheet, "net-plate", regions.net[0] + netShift[0], regions.net[1] + netShift[1]);
        drawNet(sheet, "net-back", time, pose.z, netShift);
      }

      // The ball: one of its turning frames, blended into the next.
      const turn = ((pose.spin / (Math.PI * 2)) % 1 + 1) % 1 * frames;
      const index = Math.floor(turn) % frames, next = (index + 1) % frames, blend = turn - Math.floor(turn);
      const toward = (restAt.depth - at.depth) / (restAt.depth - rimAt.depth);
      const offset = [courtShift[0] + (netShift[0] - courtShift[0]) * toward, courtShift[1] + (netShift[1] - courtShift[1]) * toward];
      const size = restAt.depth / at.depth;
      const [bx, by] = regions.ball;
      context.save();
      // Squashing sits on the floor, not around the ball's centre.
      context.translate(at.x + offset[0], at.y + offset[1] + RADIUS * size * pose.squash);
      context.scale(size * (1 + pose.squash * .55), size * (1 - pose.squash));
      context.translate(-restAt.x, -restAt.y);
      const name = (i: number) => `ball-${String(i).padStart(2, "0")}` as keyof typeof atlas;
      sprite(sheet, name(index), bx, by);
      if (blend > .02) sprite(sheet, name(next), bx, by, blend);
      context.restore();

      // Once inside the rim, its front and the near cords pass over the ball.
      if (netLive) {
        drawNet(sheet, "net-front", time, pose.z, netShift);
        if (time < LEAVES_NET + .1) sprite(sheet, "rim-front", regions.net[0] + netShift[0], regions.net[1] + netShift[1]);
      }
    };
    const tick = (now: number) => {
      frame = 0;
      if (!settled()) { stop(); return; }
      time += Math.min(now - (last || now), 50) / 1000;
      last = now;
      if (time >= SHOT_DURATION + HAND_BACK) { stop(); return; }
      const sheet = loaded[variant()];
      if (time >= SHOT_DURATION) canvas.style.opacity = String(1 - (time - SHOT_DURATION) / HAND_BACK);
      else if (sheet) draw(sheet);
      frame = requestAnimationFrame(tick);
    };
    shootRef.current = () => {
      if (motion.matches) { unavailable.current(); return; }
      if (time >= 0 || !settled()) return;
      const begin = (sheet: HTMLImageElement) => {
        if (time >= 0 || !settled()) return;
        // Paint the first frame now, so the ball never blinks out in between.
        time = 0; last = 0;
        canvas.dataset.hoopShot = "flying";
        draw(sheet);
        frame = requestAnimationFrame(tick);
      };
      const ready = loaded[variant()];
      if (ready) begin(ready);
      else load(variant()).then(begin, () => unavailable.current());
    };

    // Fetch the layers once someone settles on the island, so a tap is instant.
    let idle: ReturnType<typeof setTimeout> | undefined;
    const prepare = () => {
      clearTimeout(idle);
      if (!settled()) { if (time >= 0) stop(); return; }
      if (connection?.saveData || motion.matches) return;
      idle = setTimeout(() => { if (settled()) void load(variant()).catch(() => {}); }, 900);
    };
    const reach = (event: Event) => { if ((event as CustomEvent).detail === "projects") void load("dark").catch(() => {}); };
    const flip = () => { void load(variant()).catch(() => {}); };
    const observer = new MutationObserver(prepare);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    document.addEventListener("visibilitychange", prepare);
    window.addEventListener(ROOM_LIGHTS_INTENT, reach);
    window.addEventListener(ROOM_LIGHTS_EVENT, flip);
    prepare();
    return () => {
      clearTimeout(idle);
      observer.disconnect();
      document.removeEventListener("visibilitychange", prepare);
      window.removeEventListener(ROOM_LIGHTS_INTENT, reach);
      window.removeEventListener(ROOM_LIGHTS_EVENT, flip);
      shootRef.current = () => {};
      stop();
    };
  }, [scale]);

  return <canvas ref={canvasRef} className={styles.hoopShot} aria-hidden="true" data-hoop-shot="idle"
    style={{ left: AREA[0] * scale, top: AREA[1] * scale, width: AREA[2] * scale, height: AREA[3] * scale }} />;
}
