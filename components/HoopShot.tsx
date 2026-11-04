"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { createPortal } from "react-dom";
import { ARTWORK_PARALLAX_EVENT } from "@/lib/artwork-perspective";
import { chooseLanding, distanceFromRim, hoopShot, insideNet, NET_SETTLE, netAt, planShot, project, REST, shadowOf, SHOOTS_FROM, type BallPose, type Shot } from "@/lib/hoop-shot";
import { flipState, level } from "@/lib/light-switch";
import { lightsOn, ROOM_LIGHTS_EVENT, ROOM_LIGHTS_INTENT } from "@/lib/room-lights";
import type { ParallaxState } from "./IslandLife";
import styles from "./WorkshopObjects.module.css";

export type HoopShotHandle = { shoot: () => void };

const { atlas, density, frames, regions, world } = hoopShot;
// The canvas covers the court and the air above it, and draws only when
// something changes: a shot, a flip of the lights, the pointer's parallax.
const AREA = [730, 60, 370, 640];
const rect = (name: keyof typeof atlas) => atlas[name] as number[];
const rimAt = project(world.rim);
const netEnd = project([world.rim[0], world.rim[1], world.rim[2] - world.netDepth]);
const restAt = project(world.ball);
const shadowHome = project(shadowOf(REST).point);
const edgeAt = project([world.ball[0] + world.ballRadius, world.ball[1], world.ball[2]]);
const RADIUS = Math.hypot(edgeAt.x - restAt.x, edgeAt.y - restAt.y);
const SLICE = 1;
// The patch overlaps the cut, so no hairline of sky can show between them.
const CUT_INSET = 1.5;
// Motion blur, as a film camera's half-open shutter would catch a fast ball.
const SHUTTER = .5;
const BLUR_ABOVE = 2.5;
const BLUR_SAMPLES = 4;
const frameName = (i: number) => `ball-${String(i).padStart(2, "0")}` as keyof typeof atlas;
type Sheet = ImageBitmap | HTMLImageElement;
const FLIP_LENGTH = 320;

// There's one ball, and it stays where it landed until it's tapped: through a
// resize, a visit to another page, and back. Only a full reload resets it.
const state = {
  ball: REST, moved: false, clock: 0, netEnter: -1, netLeave: -1,
  shot: null as (Shot & { startedAt: number }) | null,
  sheets: {} as Partial<Record<"lit" | "dark", Promise<Sheet>>>,
  loaded: {} as Partial<Record<"lit" | "dark", Sheet>>,
};
const load = (which: "lit" | "dark") => state.sheets[which] ??= new Promise<Sheet>((resolve, reject) => {
  const image = new Image();
  image.onload = async () => {
    // Decode now, off the main thread where possible, so a tap can't stall on it.
    let sheet: Sheet = image;
    try { sheet = await createImageBitmap(image); } catch { await image.decode().catch(() => {}); }
    state.loaded[which] = sheet;
    resolve(sheet);
  };
  image.onerror = () => { delete state.sheets[which]; reject(new Error("Hoop shot layers failed to load")); };
  image.src = hoopShot[which];
});
const land = () => { if (state.shot) { state.ball = state.shot.final; state.shot = null; } };

// Tapping the workshop's basketball shoots it. It's baked into the still, so
// from its first shot this canvas covers that with the bare court, and draws the
// ball wherever it is: flying its rendered frames along lib/hoop-shot.ts, behind
// the rim's front and through a net that gives way, then at rest on its new spot
// until it's tapped again. Until that first tap the canvas is empty and costs nothing.
export default function HoopShot({ scale, visual, onUnavailable, onBall, ref }: {
  scale: number; visual: HTMLElement; onUnavailable: () => void; onBall: (x: number, y: number) => void; ref?: Ref<HoopShotHandle>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shootRef = useRef<() => void>(() => {});
  const handlers = useRef({ onUnavailable, onBall });
  useEffect(() => { handlers.current = { onUnavailable, onBall }; }, [onUnavailable, onBall]);
  useImperativeHandle(ref, () => ({ shoot: () => shootRef.current() }), []);
  // Leaving the page mid-shot, it has landed by the time anyone's back.
  useEffect(() => land, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const island = visual as HTMLElement & { parallax?: ParallaxState };
    const scene = visual.closest<HTMLElement>("[data-island-scene]");
    const stage = visual.closest<HTMLElement>("[data-island-stage]");
    if (!canvas || !context || !scene || !stage || !scale) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const variant = () => lightsOn("projects") ? "lit" as const : "dark" as const;
    let disposed = false;
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

    // How much of this lighting is showing, while the room's switch plays out.
    let pass = 1;
    const sprite = (sheet: Sheet, name: keyof typeof atlas, x: number, y: number, alpha = 1) => {
      const [ax, ay, aw, ah] = rect(name);
      context.globalAlpha = alpha * pass;
      context.drawImage(sheet, ax, ay, aw, ah, x, y, aw / density, ah / density);
      context.globalAlpha = 1;
    };
    // The same parallax as the still, at that point's depth.
    const shift = (x: number, y: number) => {
      const p = island.parallax;
      if (!p?.depth) return [0, 0];
      const d = p.depth(x, y) - p.focus;
      return [-p.x * d * 1200, -p.y * d * 800];
    };
    const drawNet = (sheet: Sheet, name: "net-back" | "net-front", through: number, since: number, ballZ: number, offset: number[]) => {
      const [ax, ay, aw] = rect(name);
      const [rx, ry, rw, rh] = regions.net;
      let y = ry;
      context.globalAlpha = pass;
      for (let row = 0; row < rh; row += SLICE) {
        const source = ry + row;
        const u = Math.max(0, Math.min(1.1, (source - rimAt.y) / (netEnd.y - rimAt.y)));
        const { widen, hang, whip } = netAt(u, through, since, ballZ);
        // Above the rim's centre the cords stay on the rim; below it they hang.
        const height = source < rimAt.y ? SLICE : SLICE * hang;
        const centre = rimAt.x + (netEnd.x - rimAt.x) * u;
        context.drawImage(sheet, ax, ay + row * density, aw, SLICE * density,
          centre + whip + (rx - centre) * widen + offset[0], y + offset[1], rw * widen, height + .25);
        y += height;
      }
      context.globalAlpha = 1;
    };
    const drawBall = (sheet: Sheet, pose: BallPose, alpha: number, blend: boolean) => {
      const at = project([pose.x, pose.y, pose.z]);
      const floor = project([pose.x, pose.y, world.floor]);
      const offset = shift(floor.x, floor.y);
      const size = restAt.depth / at.depth;
      const [bx, by] = regions.ball;
      const turn = ((pose.spin / (Math.PI * 2)) % 1 + 1) % 1 * frames;
      const index = Math.floor(turn) % frames, mix = turn - Math.floor(turn);
      context.save();
      // Squashing sits on the floor, not around the ball's centre.
      context.translate(at.x + offset[0], at.y + offset[1] + RADIUS * size * pose.squash);
      context.scale(size * (1 + pose.squash * .55), size * (1 - pose.squash));
      context.translate(-restAt.x, -restAt.y);
      sprite(sheet, frameName(blend || mix < .5 ? index : (index + 1) % frames), bx, by, alpha);
      if (blend && mix > .02) sprite(sheet, frameName((index + 1) % frames), bx, by, alpha * mix);
      context.restore();
      return at;
    };

    let frame = 0, last = 0, dt = 1 / 60;
    const poseNow = (): BallPose => state.shot ? state.shot.pose(state.clock - state.shot.startedAt) : { ...state.ball, squash: 0 };
    const ringing = () => state.netEnter >= 0 && state.clock < state.netLeave + NET_SETTLE;
    const flipping = () => { const flip = flipState("projects"); return !!flip && performance.now() - flip.at < FLIP_LENGTH; };

    const paint = () => {
      context.clearRect(AREA[0], AREA[1], AREA[2], AREA[3]);
      if (!state.moved) return;
      const { lit, dark } = state.loaded;
      // Through a flip of the switch the two lightings dissolve, in step with
      // the still; the spotlight is the last of its fixtures to settle.
      const on = level("projects", "spot", lightsOn("projects"));
      if (lit && (on >= 1 || !dark)) drawScene(lit);
      else if (dark && (on <= 0 || !lit)) drawScene(dark);
      else if (lit && dark) { drawScene(lit); pass = 1 - on; drawScene(dark); pass = 1; }
    };
    const drawScene = (sheet: Sheet) => {
      const { clock, shot, netEnter, netLeave } = state;
      const pose = poseNow();

      // The bare court where the still's ball sits, and the shadow on the
      // court below wherever the ball is now.
      const [cx, cy] = regions.court;
      const courtShift = shift(restAt.x, restAt.y);
      sprite(sheet, "court-clean", cx + courtShift[0], cy + courtShift[1]);
      const shadow = shadowOf(pose);
      if (shadow.strength > .01) {
        const on = project(shadow.point);
        const offset = shift(on.x, on.y);
        const size = restAt.depth / on.depth * shadow.spread;
        context.save();
        context.translate(on.x + offset[0], on.y + offset[1]);
        context.scale(size, size);
        sprite(sheet, "ball-shadow", regions.shadow[0] - shadowHome.x, regions.shadow[1] - shadowHome.y, shadow.strength);
        context.restore();
      }

      // The hoop from when a ball reaches it until its cords have stopped.
      const netLive = netEnter >= 0 && clock >= netEnter && clock < netLeave + NET_SETTLE;
      const netShift = shift(rimAt.x, rimAt.y);
      cutNet(netLive);
      const through = netLive ? Math.max(0, Math.min(1, (clock - netEnter) / (netLeave - netEnter))) : 0;
      const since = clock - netLeave;
      const inside = netLive && !!shot && clock >= shot.startedAt + shot.entersRim && insideNet(pose);
      if (netLive) {
        sprite(sheet, "net-plate", regions.net[0] + netShift[0], regions.net[1] + netShift[1]);
        drawNet(sheet, "net-back", through, since, pose.z, netShift);
        if (!inside) drawNet(sheet, "net-front", through, since, pose.z, netShift);
      }

      // The ball. Moving fast it's a few moments averaged together; slow, its
      // turning frames blend into one another.
      let at = project([pose.x, pose.y, pose.z]);
      const before = shot ? shot.pose(clock - shot.startedAt - dt * SHUTTER) : pose;
      const a = project([pose.x, pose.y, pose.z]), b = project([before.x, before.y, before.z]);
      const travel = Math.hypot(a.x - b.x, a.y - b.y);
      if (shot && travel > BLUR_ABOVE) {
        const samples = Math.min(BLUR_SAMPLES, Math.ceil(travel / BLUR_ABOVE));
        for (let i = 0; i < samples; i++) {
          const moment = shot.pose(clock - shot.startedAt - dt * SHUTTER * (samples - 1 - i) / (samples - 1 || 1));
          at = drawBall(sheet, moment, 1 / (i + 1), false);
        }
      } else at = drawBall(sheet, pose, 1, !!shot);
      handlers.current.onBall(at.x, at.y);

      // Inside the rim, its front and the near cords pass over the ball.
      if (inside) {
        drawNet(sheet, "net-front", through, since, pose.z, netShift);
        sprite(sheet, "rim-front", regions.net[0] + netShift[0], regions.net[1] + netShift[1]);
      }
    };

    const stop = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      land();
      state.netEnter = state.netLeave = -1;
      cutNet(false);
      canvas.dataset.hoopShot = "idle";
      paint();
    };
    const tick = (now: number) => {
      frame = 0;
      if (!settled()) { stop(); return; }
      // Keep to real time through a dropped frame; only a long stall pauses it.
      dt = Math.min(now - (last || now - 1000 / 60), 100) / 1000;
      state.clock += dt;
      last = now;
      const { shot, clock } = state;
      if (shot && clock >= shot.startedAt + shot.entersRim && state.netEnter < shot.startedAt) {
        state.netEnter = shot.startedAt + shot.entersRim;
        state.netLeave = shot.startedAt + shot.leavesNet;
      }
      if (shot && clock >= shot.startedAt + shot.duration) { land(); canvas.dataset.hoopShot = "idle"; }
      if (!state.shot && !ringing() && !flipping()) { stop(); return; }
      paint();
      frame = requestAnimationFrame(tick);
    };
    const wake = () => { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } };
    // Put a new sheet on the canvas once, so the first tap can't stall on it.
    const ready = (which: "lit" | "dark") => load(which).then(sheet => {
      if (disposed) return sheet;
      context.drawImage(sheet, AREA[0], AREA[1], 1, 1);
      if (!frame) paint();
      return sheet;
    });

    const launch = () => {
      const pose = poseNow();
      state.moved = true;
      state.shot = { ...planShot(pose, chooseLanding(pose)), startedAt: state.clock };
      canvas.dataset.hoopShot = "flying";
      // Paint now, in the tap's own frame: the response is immediate.
      dt = 1 / 60;
      paint();
      wake();
    };
    shootRef.current = () => {
      if (motion.matches) { handlers.current.onUnavailable(); return; }
      if (!settled()) return;
      // Once it's out of the net it can be shot again, even mid-bounce, as
      // soon as it's far enough out from under the rim to arc back up.
      const { shot, clock } = state;
      if (shot && (clock < shot.startedAt + shot.leavesNet || distanceFromRim(poseNow()) < SHOOTS_FROM)) return;
      if (state.loaded[variant()]) launch();
      else ready(variant()).then(() => { if (!disposed && settled() && !state.shot) launch(); }, () => handlers.current.onUnavailable());
    };

    // Fetch the layers as soon as someone settles on the island, so a tap is instant.
    let idle: ReturnType<typeof setTimeout> | undefined;
    const prepare = () => {
      clearTimeout(idle);
      if (!settled()) { if (state.shot || frame) stop(); return; }
      if (connection?.saveData || motion.matches) return;
      idle = setTimeout(() => { if (settled()) void ready(variant()).catch(() => {}); }, 300);
    };
    const reach = (event: Event) => { if ((event as CustomEvent).detail === "projects") void ready(lightsOn("projects") ? "dark" : "lit").catch(() => {}); };
    const flip = () => { void ready(variant()).catch(() => {}); if (state.moved) wake(); };
    const parallax = () => { if (state.moved && !frame) paint(); };
    const observer = new MutationObserver(prepare);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    document.addEventListener("visibilitychange", prepare);
    window.addEventListener(ROOM_LIGHTS_INTENT, reach);
    window.addEventListener(ROOM_LIGHTS_EVENT, flip);
    visual.addEventListener(ARTWORK_PARALLAX_EVENT, parallax);
    prepare();
    // Back on the page or resized: the ball's where it was, and a shot carries on.
    if (state.moved) void ready(variant()).catch(() => {});
    if (state.shot || ringing()) wake(); else paint();
    return () => {
      disposed = true;
      clearTimeout(idle);
      observer.disconnect();
      document.removeEventListener("visibilitychange", prepare);
      window.removeEventListener(ROOM_LIGHTS_INTENT, reach);
      window.removeEventListener(ROOM_LIGHTS_EVENT, flip);
      visual.removeEventListener(ARTWORK_PARALLAX_EVENT, parallax);
      shootRef.current = () => {};
      cancelAnimationFrame(frame);
      cutNet(false);
    };
  }, [scale, visual]);

  // Centred on the island's box as its contained still is, and inside the
  // island itself: the ball stays on the court when the camera moves off.
  return createPortal(<canvas ref={canvasRef} className={styles.hoopShot} aria-hidden="true" data-hoop-shot="idle"
    style={{ left: `calc(50% + ${(AREA[0] - 600) * scale}px)`, top: `calc(50% + ${(AREA[1] - 400) * scale}px)`, width: AREA[2] * scale, height: AREA[3] * scale }} />, visual);
}
