"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OrbitAsset, OrbitProjection, createIslandOrbit } from "@/lib/island-orbit";
import { registerWindowCamera } from "@/lib/island-orbit-bridge";
import { artworkOutline } from "@/lib/artwork-perspective";
import { landmarkArrow } from "./IslandLink";
import styles from "./IslandOrbit.module.css";

type Engine = Awaited<ReturnType<typeof createIslandOrbit>>;

export default function IslandOrbit({ world, asset, anchors }: { world: string; asset: OrbitAsset; anchors: OrbitProjection }) {
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
    let unregisterCamera: (() => void) | undefined;
    let disposed = false;
    let loading = false;
    let loadController: AbortController | null = null;
    let failed = false;
    let live = false;
    let drag: { id: number; x: number; y: number; lastX: number; lastY: number; moved: boolean; touch: boolean } | null = null;
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
      loadController?.abort();
      unregisterCamera?.();
      restore();
      engineRef.current?.dispose();
      engineRef.current = null;
      delete canvas.dataset.orbitReady;
      link.removeAttribute("aria-describedby");
      setHost(null);
    };
    const sync = async () => {
      if (scene.dataset.active !== "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering) {
        if (engineRef.current) unload();
        else loadController?.abort();
      }
      if (loading || failed || disposed || engineRef.current || scene.dataset.active !== "true" || stage.dataset.travelling === "true" || stage.dataset.entering) return;
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (connection?.saveData) return;
      loading = true;
      const controller = new AbortController();
      loadController = controller;
      try {
        const { createIslandOrbit } = await import("@/lib/island-orbit");
        if (disposed) return;
        const engine = await createIslandOrbit(canvas, asset, anchors, project, visual.querySelector<HTMLElement>("[data-workshop-screen]")?.dataset.src, controller.signal);
        if (disposed || (scene.dataset.active !== "true" && stage.dataset.travelling !== "true")) { engine.dispose(); return; }
        engineRef.current = engine;
        if (engine.beginWindowFlight) unregisterCamera = registerWindowCamera(visual, engine.beginWindowFlight);
        canvas.dataset.orbitReady = "true";
        link.setAttribute("aria-describedby", `${world}-orbit-instructions`);
        setHost(canvas.closest<HTMLElement>("[data-scene-art]"));
      } catch { failed = !controller.signal.aborted; /* Keep the original render and entry links usable. */ }
      finally {
        loading = false;
        if (loadController === controller) loadController = null;
        if (controller.signal.aborted && !disposed) void sync();
      }
    };
    const rotate = (dx: number, dy: number) => {
      activate();
      engineRef.current?.rotate(dx, dy);
      setTurned(true);
    };
    const reset = () => {
      restore();
      engineRef.current?.reset();
    };
    resetRef.current = reset;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary || stage.dataset.entering) return;
      suppressClick = false;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, touch: event.pointerType === "touch" };
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved) {
        if (drag.touch && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) { suppressClick = true; drag = null; return; }
        if (Math.hypot(dx, dy) < 7) return;
        drag.moved = true;
        suppressClick = true;
        canvas.setPointerCapture(event.pointerId);
        canvas.dataset.orbitDragging = "true";
      }
      event.preventDefault();
      if (engineRef.current) rotate(-(event.clientX - drag.lastX) * 0.0032, drag.touch ? 0 : -(event.clientY - drag.lastY) * 0.0016);
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
    };
    const up = () => { drag = null; delete canvas.dataset.orbitDragging; };
    const cancel = () => { suppressClick = true; up(); };
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
      if (event.target !== link || !engineRef.current || stage.dataset.entering || event.metaKey || event.ctrlKey || event.altKey) return;
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
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    const resize = new ResizeObserver(() => engineRef.current?.resize());
    resize.observe(visual);
    link.addEventListener("pointerdown", down);
    link.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    link.addEventListener("pointercancel", cancel);
    canvas.addEventListener("webglcontextlost", lost);
    window.addEventListener("click", click, true);
    link.addEventListener("keydown", key);
    void sync();
    return () => {
      disposed = true;
      observer.disconnect();
      resize.disconnect();
      link.removeEventListener("pointerdown", down);
      link.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      link.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("click", click, true);
      link.removeEventListener("keydown", key);
      unload();
    };
  }, [asset, anchors, world]);

  return <>
    <canvas ref={canvasRef} className={styles.canvas} data-island-orbit={world} aria-hidden="true" />
    {host && createPortal(<div className={styles.controls}>
      <span aria-hidden="true">drag to look around</span>
      <span id={`${world}-orbit-instructions`} className={styles.instructions}>Drag to turn the island. On a keyboard, use the arrow keys to look around, R to reset, and Enter to visit {world}.</span>
      {turned && <button type="button" aria-label={`Reset ${world} island view`} onClick={event => { event.preventDefault(); event.stopPropagation(); resetRef.current(); }}>reset view</button>}
    </div>, host)}
  </>;
}
