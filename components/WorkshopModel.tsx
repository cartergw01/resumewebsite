"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelState, WorkshopViewer } from "@/lib/workshop-viewer";
import islands from "@/lib/blender-islands.json";
import styles from "./WorkshopDiscovery.module.css";

export default function WorkshopModel({ src, name, bounds, glow = false }: { src: string; name: string; bounds: number[]; glow?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<WorkshopViewer | null>(null);
  const [loaded, setLoaded] = useState<{ src:string; state:ModelState }>({src, state:"loading"});
  const [attempt, setAttempt] = useState(0);
  const [turns, setTurns] = useState(0);
  const [zoom, setZoom] = useState(100);
  const state = loaded.src === src ? loaded.state : "loading";
  useEffect(() => {
    let cancelled = false;
    setTurns(0); setZoom(100);
    const report = (state: ModelState) => { if (!cancelled) setLoaded({src,state}); };
    report("loading");
    import("@/lib/workshop-viewer").then(async ({ mountWorkshopViewer }) => {
      // Paint the dialog and loading preview before creating GPU resources.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled || !host.current) return;
      try {
        viewer.current ??= mountWorkshopViewer(host.current);
        void viewer.current.load(src, report);
      } catch { report("error"); }
    }).catch(() => report("error"));
    return () => { cancelled = true; viewer.current?.cancel(); };
  }, [src, attempt]);
  useEffect(() => () => { viewer.current?.dispose(); viewer.current = null; }, []);
  useEffect(() => { if (state === "ready") viewer.current?.glow(glow); }, [glow, state, src]);
  const turn = (direction: number) => { viewer.current?.rotate(direction); setTurns(value => value + direction); };
  return <div className={styles.model} data-model-state={state} data-model-turns={turns} aria-busy={state === "loading"}>
    {state !== "ready" && <svg className={styles.fallback} viewBox={`${bounds[0]-8} ${bounds[1]-8} ${bounds[2]+16} ${bounds[3]+16}`} role="img" aria-label={`${name} on the island`}><image href={islands.projects.src} width="1200" height="800" /></svg>}
    <div ref={host} className={styles.canvas} role="img" aria-label={`Rotatable 3D model of ${name}`} />
    {state !== "ready" && <div className={styles.modelStatus}><p role="status">{state === "loading" ? "Loading…" : "Preview unavailable."}</p>{state === "error" && <button type="button" className={styles.primary} onClick={() => {
      viewer.current?.dispose(); viewer.current = null; setAttempt(value => value + 1);
    }}>Retry</button>}</div>}
    <div className={styles.modelControls} aria-label="Model controls">
      <button type="button" disabled={state !== "ready"} aria-label="Rotate model left" onClick={() => turn(-1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M5 7a8 8 0 1 1-1 8M5 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      <button type="button" disabled={state !== "ready"} aria-label="Rotate model right" onClick={() => turn(1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M19 7a8 8 0 1 0 1 8M19 3v5h-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      <button type="button" disabled={state !== "ready"} aria-label="Reset view" onClick={() => { viewer.current?.reset(); setTurns(0); setZoom(100); }}>Reset</button>
      <label className={styles.zoom}><span className="sr-only">Zoom</span><input type="range" min="75" max="170" value={zoom} disabled={state!=="ready"} onChange={event=>{setZoom(Number(event.target.value));viewer.current?.zoom(Number(event.target.value)/100);}} /></label>
    </div>
  </div>;
}
