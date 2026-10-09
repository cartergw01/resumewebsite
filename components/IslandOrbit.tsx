"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OrbitAsset, OrbitProjection, createIslandOrbit } from "@/lib/island-orbit";
import { artworkOutline } from "@/lib/artwork-perspective";
import { CITY_TIME_EVENT, currentCityTime } from "@/lib/city-time";
import { landmarkArrow } from "./IslandLink";
import styles from "./IslandOrbit.module.css";

type Engine = Awaited<ReturnType<typeof createIslandOrbit>>;

export default function IslandOrbit({ world, asset, anchors, interactive = true }: { world: string; asset: OrbitAsset; anchors: OrbitProjection; interactive?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [turned, setTurned] = useState(false);
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const visual = canvas.closest<HTMLElement>("[data-island-visual]")!;
    const scene = canvas.closest<HTMLElement>("[data-island-scene]")!;
    const stage = canvas.closest<HTMLElement>("[data-island-stage]")!;
    const link = canvas.closest<HTMLAnchorElement>("[data-island-link]")!;
    let disposed = false;
    let loading = false;
    let loadController: AbortController | null = null;
    let failed = false;
    let live = false;
    // Rotatable models load on intent, not on arrival: hovering or focusing an
    // island, or the first swipe on a phone. Only Taipei preloads, and only on
    // desktop, because its click flies through the real model.
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    let interested = interactive && fine && world === "work";
    let prepared = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let idleLoad: number | undefined;
    let hintDelay: ReturnType<typeof setTimeout> | undefined;
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const cancelScheduledLoad = () => {
      clearTimeout(loadTimer);
      loadTimer = undefined;
      if (idleLoad !== undefined) window.cancelIdleCallback(idleLoad);
      idleLoad = undefined;
    };
    const canLoad = () => interested && (interactive || !motion.matches) && !disposed && !document.hidden && !connection?.saveData && scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.scrolling && !stage.dataset.navigating && !stage.dataset.entering;
    const interactiveSceneReady = () => scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering;
    const clearHint = () => {
      clearTimeout(hintDelay);
      clearTimeout(hintTimer);
      hintDelay = hintTimer = undefined;
      delete link.dataset.orbitHint;
    };
    const suggestRotation = () => {
      // Phones show the swipe hint before the model exists; the swipe loads it.
      const ready = () => engineRef.current ? canLoad() : !fine && interactiveSceneReady() && !document.hidden;
      if (!interactive || !ready() || stage.dataset.orbitHintSeen || stage.dataset.orbitLearned || hintDelay || hintTimer) return;
      // Borrow the existing annotation once, after visitors have seen where
      // the island leads. No extra label, icon, or permanent instruction row.
      hintDelay = setTimeout(() => {
        hintDelay = undefined;
        if (!ready() || stage.dataset.orbitHintSeen || stage.dataset.orbitLearned) return;
        stage.dataset.orbitHintSeen = "true";
        link.dataset.orbitHint = "true";
        hintTimer = setTimeout(clearHint, 3500);
      }, 1400);
    };
    let drag: { id: number; x: number; y: number; lastX: number; lastY: number; moved: boolean; touch: boolean; samples: [number, number, number][] } | null = null;
    let suppressClick = false;
    const title = world[0].toUpperCase() + world.slice(1);
    const project = (points: OrbitProjection) => {
      if (!live) return;
      const [x, y] = points.landmark[0];
      visual.dataset.orbitLandmark = JSON.stringify({ x: x / 1200, y: y / 800 });
      link.querySelector("[data-island-cue] path")?.setAttribute("d", landmarkArrow(title, { x: x / 1200, y: y / 800, name: title }));
      for (const [name, selector] of [["entryWindow", "[data-city-entry-window]"], ["screen", "[data-workshop-screen]"], ["spread", "[data-book-spread]"]] as const) {
        const surface = visual.querySelector<SVGGraphicsElement>(selector);
        if (surface && points[name]) {
          surface.dataset.corners = JSON.stringify(points[name]);
          const path = surface.tagName === "path" ? surface : surface.querySelector("path");
          path?.setAttribute("d", artworkOutline(points[name]));
        }
        if (points[name]) visual.querySelector(`[data-touch-surface="${name}"]`)?.setAttribute("d", artworkOutline(points[name]));
      }
    };
    const activate = () => {
      if (live) return;
      live = true;
      visual.dataset.orbitLive = "true";
      canvas.dataset.orbitLive = "true";
    };
    const restore = () => {
      // The poster, video and page-entry surfaces share their original anchors.
      // Restore all of them together on reset, context loss or leaving a world.
      live = true;
      project(anchors);
      live = false;
      delete visual.dataset.orbitLive;
      delete visual.dataset.orbitLandmark;
      delete canvas.dataset.orbitLive;
      delete canvas.dataset.orbitDragging;
      setTurned(false);
    };
    const unload = () => {
      clearHint();
      cancelScheduledLoad();
      loadController?.abort();
      restore();
      engineRef.current?.dispose();
      engineRef.current = null;
      delete canvas.dataset.orbitReady;
      link.removeAttribute("aria-describedby");
      setHost(null);
    };
    const load = async () => {
      if (loading || failed || engineRef.current || !canLoad()) return;
      loading = true;
      const controller = new AbortController();
      loadController = controller;
      try {
        const { createIslandOrbit } = await import("@/lib/island-orbit");
        if (disposed || controller.signal.aborted) return;
        const engine = await createIslandOrbit(canvas, asset, anchors, project, visual.querySelector<HTMLElement>("[data-workshop-screen]")?.dataset.src, controller.signal);
        if (disposed || controller.signal.aborted || (scene.dataset.active !== "true" && stage.dataset.travelling !== "true")) { engine.dispose(); return; }
        engineRef.current = engine;
        if (world === "work") engine.setDaylight(currentCityTime() === "day", false);
        canvas.dataset.orbitReady = "true";
        if (interactive) {
          link.setAttribute("aria-describedby", `${world}-orbit-instructions`);
          setHost(canvas.closest<HTMLElement>("[data-scene-art]"));
          suggestRotation();
        }
      } catch { failed = !controller.signal.aborted; /* Keep the original render and entry links usable. */ }
      finally {
        loading = false;
        if (loadController === controller) loadController = null;
        if (controller.signal.aborted && !disposed) void sync();
      }
    };
    const sync = () => {
      if (scene.dataset.active !== "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering) {
        if (engineRef.current) unload();
        else loadController?.abort();
      }
      if (!canLoad()) {
        cancelScheduledLoad();
        if (!fine && interactive && !engineRef.current && interactiveSceneReady()) suggestRotation(); else clearHint();
        if (document.hidden || connection?.saveData || stage.dataset.travelling === "true" || stage.dataset.scrolling || stage.dataset.navigating || stage.dataset.entering) loadController?.abort();
        return;
      }
      if (engineRef.current) { suggestRotation(); return; }
      if (loading || failed || loadTimer !== undefined || idleLoad !== undefined) return;
      // Let arrival paint before decoding a model. Fast passes through a world
      // and background tabs should not start megabytes of optional 3D work,
      // and its decode must not land on the next scroll; hovering or focusing
      // the island still loads it at once. Work's entry flies the real model,
      // so it loads promptly once the camera has landed there.
      loadTimer = setTimeout(() => {
        loadTimer = undefined;
        if ("requestIdleCallback" in window) idleLoad = window.requestIdleCallback(() => { idleLoad = undefined; void load(); }, { timeout: 2000 });
        else void load();
      }, prepared ? 0 : world === "work" ? 250 : 900);
    };
    const markTurned = () => {
      clearHint();
      activate();
      stage.dataset.orbitLearned = "true";
      setTurned(true);
    };
    const rotate = (dx: number, dy: number) => { markTurned(); engineRef.current?.rotate(dx, dy); };
    const turn = (dx: number, dy: number) => { markTurned(); engineRef.current?.drag(dx, dy); };
    const reset = () => {
      restore();
      engineRef.current?.reset();
    };
    resetRef.current = reset;
    const prepareEntry = () => { interested = true; prepared = true; sync(); };
    const down = (event: PointerEvent) => {
      if (!interactive || event.button !== 0 || !event.isPrimary || stage.dataset.entering) return;
      suppressClick = false;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, touch: event.pointerType === "touch", samples: [] };
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved) {
        if (drag.touch && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) { suppressClick = true; drag = null; return; }
        if (Math.hypot(dx, dy) < 7) return;
        drag.moved = true;
        suppressClick = true;
        if (!engineRef.current && !interested) { interested = prepared = true; sync(); }
        canvas.setPointerCapture(event.pointerId);
        canvas.dataset.orbitDragging = "true";
      }
      event.preventDefault();
      if (engineRef.current) turn(-(event.clientX - drag.lastX) * 0.0032, drag.touch ? 0 : -(event.clientY - drag.lastY) * 0.0016);
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      // The last ~80ms of movement set the release velocity.
      const now = event.timeStamp;
      drag.samples.push([now, event.clientX, event.clientY]);
      while (drag.samples.length > 2 && now - drag.samples[0][0] > 80) drag.samples.shift();
    };
    const up = (event?: PointerEvent) => {
      const released = drag;
      drag = null;
      delete canvas.dataset.orbitDragging;
      const engine = engineRef.current;
      if (!released?.moved || !engine) return;
      const [first] = released.samples, last = released.samples.at(-1);
      // A pointer that stopped before letting go has no momentum.
      const elapsed = first && last ? last[0] - first[0] : 0;
      const idle = event && last ? event.timeStamp - last[0] > 60 : false;
      const coast = elapsed >= 8 && !idle && !motion.matches;
      // Capped, so a twitch measured over a few milliseconds can't spin it.
      const speed = (value: number) => Math.max(-0.0025, Math.min(0.0025, value));
      engine.release(
        coast ? speed(-(last![1] - first[1]) / elapsed * 0.0032) : 0,
        coast && !released.touch ? speed(-(last![2] - first[2]) / elapsed * 0.0016) : 0,
      );
    };
    // A cancelled pointer (the page took the gesture) stops dead and settles.
    const cancel = () => { suppressClick = true; if (drag) drag.samples = []; up(); };
    const click = (event: MouseEvent) => {
      if (!suppressClick || !link.contains(event.target as Node)) return;
      // Capture on window, ahead of the rocket and router: releasing a drag
      // must never launch or navigate. Keyboard Enter stays a normal entry.
      if (event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const key = (event: KeyboardEvent) => {
      if (!interactive || event.target !== link || !engineRef.current || stage.dataset.entering || event.metaKey || event.ctrlKey || event.altKey) return;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.035], ArrowDown: [0, 0.035] };
      if (moves[event.key]) { event.preventDefault(); event.stopPropagation(); rotate(...moves[event.key]); }
      else if (event.key.toLowerCase() === "r") { event.preventDefault(); reset(); }
    };
    const lost = (event: Event) => {
      event.preventDefault();
      failed = true;
      unload();
    };
    const observer = new MutationObserver(() => void sync());
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-scrolling", "data-entering", "data-navigating"] });
    const resize = new ResizeObserver(() => engineRef.current?.resize());
    resize.observe(visual);
    // A turned view relights with the stills: the same quick crossfade.
    const relight = () => {
      const engine = engineRef.current;
      if (world !== "work" || !engine) return;
      void engine.setDaylight(currentCityTime() === "day", true);
    };
    window.addEventListener(CITY_TIME_EVENT, relight);
    link.addEventListener("pointerenter", prepareEntry);
    link.addEventListener("focusin", prepareEntry);
    link.addEventListener("pointerdown", down);
    link.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    link.addEventListener("pointercancel", cancel);
    canvas.addEventListener("webglcontextlost", lost);
    window.addEventListener("click", click, true);
    link.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", sync);
    connection?.addEventListener("change", sync);
    void sync();
    return () => {
      disposed = true;
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener(CITY_TIME_EVENT, relight);
      link.removeEventListener("pointerenter", prepareEntry);
      link.removeEventListener("focusin", prepareEntry);
      link.removeEventListener("pointerdown", down);
      link.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      link.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("click", click, true);
      link.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", sync);
      connection?.removeEventListener("change", sync);
      unload();
    };
  }, [asset, anchors, interactive, world]);

  return <>
    <canvas ref={canvasRef} className={styles.canvas} data-island-orbit={interactive ? world : undefined} data-entry-camera={interactive ? undefined : world} aria-hidden="true" />
    {host && createPortal(<>
      <span id={`${world}-orbit-instructions`} className={styles.instructions}>Drag to look around the island. On a touchscreen, swipe left or right to turn it, swipe up or down to scroll, and tap to visit {world}. On a keyboard, use the arrow keys to look around, R to reset, and Enter to visit {world}.</span>
      {turned && <div className={styles.controls} data-orbit-controls><button type="button" aria-label={`Reset ${world} island view`} onClick={event => { event.preventDefault(); event.stopPropagation(); resetRef.current(); }}>reset view</button></div>}
    </>, host)}
  </>;
}
