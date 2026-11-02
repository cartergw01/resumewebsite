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
    {state !== "ready" && <div className={styles.modelStatus}><p role="status">{state === "loading" ? "Picking it up…" : "3D preview unavailable. You can still explore below."}</p>{state === "error" && <button type="button" className={styles.primary} onClick={() => {
      viewer.current?.dispose(); viewer.current = null; setAttempt(value => value + 1);
    }}>Try 3D again</button>}</div>}
    <div className={styles.modelControls} aria-label="Model controls">
      <button type="button" disabled={state !== "ready"} aria-label="Rotate model left" onClick={() => turn(-1)}>↶</button>
      <span>Drag sideways to turn</span>
      <button type="button" disabled={state !== "ready"} aria-label="Rotate model right" onClick={() => turn(1)}>↷</button>
      <button type="button" disabled={state !== "ready"} onClick={() => { viewer.current?.reset(); setTurns(0); setZoom(100); }}>Reset view</button>
    </div>
    <label className={styles.zoom}>Zoom<input type="range" min="75" max="170" value={zoom} disabled={state!=="ready"} onChange={event=>{setZoom(Number(event.target.value));viewer.current?.zoom(Number(event.target.value)/100);}} /></label>
  </div>;
}
