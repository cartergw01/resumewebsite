"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { islandProjects as projects } from "@/content/portfolio";
import objects from "@/lib/workshop-objects.json";
import { ARTWORK_PARALLAX_EVENT } from "@/lib/artwork-perspective";
import type { ParallaxState } from "./IslandLife";
import PokerChallenge from "./PokerChallenge";
import styles from "./WorkshopObjects.module.css";
import { curios, curiosityClip } from "@/lib/workshop-discoveries";
import { useIslandCue } from "@/lib/use-island-cue";
import ProjectCue from "./ProjectCue";

const TaipeiArcade = dynamic(() => import("./TaipeiArcade"), { ssr: false });
const WorkshopDiscovery = dynamic(() => import("./WorkshopDiscovery"), { ssr: false });
const DeclarationScroll = dynamic(() => import("./DeclarationScroll"), { ssr: false });
// The chip case opens Poker Odds directly. Its inspectable model remains in
// the object directory, without a second target sitting over the project.
const islandCurios = curios.filter(object => object.id !== "poker-set");
const allPoints = [...projects.map(project => objects[project.id as keyof typeof objects]), ...islandCurios].map(object => object.point);
const known = new Set([...projects, ...curios].map(object => object.id));
const FOUND_KEY = "carter-workshop-discoveries-v1";

const labels: Record<string, string> = {
  "poker-odds": "Poker Odds",
  "taipei-guide": "Taipei Guide",
};

export default function WorkshopObjects() {
  const layerRef = useRef<HTMLSpanElement>(null);
  useIslandCue(layerRef);
  const arcadeButton = useRef<HTMLButtonElement>(null);
  const arcadeOrigin = useRef<HTMLElement | null>(null);
  const [arcade, setArcade] = useState(false);
  const pokerButton = useRef<HTMLButtonElement>(null);
  const pokerOrigin = useRef<HTMLElement | null>(null);
  const restorePokerFocus = useRef(false);
  const [scale, setScale] = useState(0);
  const [challenge, setChallenge] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [declaration, setDeclaration] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const [found, setFound] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(FOUND_KEY) ?? "[]");
      return Array.isArray(saved) ? [...new Set(saved.filter(id => typeof id === "string" && known.has(id)))] : [];
    } catch { return []; }
  });
  const discover = (id: string) => setFound(previous => {
    if (previous.includes(id)) return previous;
    const next = [...previous, id];
    try { sessionStorage.setItem(FOUND_KEY, JSON.stringify(next)); } catch { /* Discovery still works without storage. */ }
    return next;
  });
  const select = (id: string) => { if (id !== "directory") discover(id); setSelected(id); };
  const inspect = (id: string, source: HTMLElement) => {
    opener.current = source;
    if (id === "shield") { discover(id); setDeclaration(true); }
    else select(id);
  };

  useEffect(() => {
    if (new URL(location.href).searchParams.get("play") === "taipei-run") setArcade(true);
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const visual = layer?.closest<HTMLElement>("[data-island-visual]") as (HTMLElement & { parallax?: ParallaxState }) | null;
    if (!layer || !visual) return;
    const resize = () => setScale(Math.max(.15, Math.min(visual.clientWidth / 1200, visual.clientHeight / 800)));
    // Use the same depth displacement as the rendered surface. Targets move
    // with their physical objects when the pointer changes the perspective.
    const move = () => {
      const p = visual.parallax;
      for (const group of layer.querySelectorAll<HTMLElement>("[data-object-position]")) {
        const id = group.dataset.objectPosition;
        const object = objects[id as keyof typeof objects] ?? curios.find(object => object.id === id);
        if (!object) continue;
        const [x, y] = object.point;
        const depth = p?.depth ? p.depth(x, y) - p.focus : 0;
        group.style.transform = `translate(${-1200 * (p?.x ?? 0) * depth * scale}px, ${-800 * (p?.y ?? 0) * depth * scale}px)`;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(visual);
    visual.addEventListener(ARTWORK_PARALLAX_EVENT, move);
    resize(); move();
    return () => { observer.disconnect(); visual.removeEventListener(ARTWORK_PARALLAX_EVENT, move); };
  }, [scale]);

  const closeArcade = () => {
    setArcade(false);
    const url = new URL(location.href);
    if (url.searchParams.get("play") === "taipei-run") { url.searchParams.delete("play"); history.replaceState(history.state, "", url); }
    requestAnimationFrame(() => (arcadeOrigin.current ?? arcadeButton.current)?.focus({ preventScroll: true }));
  };
  const playArcade = () => { arcadeOrigin.current = selected ? opener.current : arcadeButton.current; discover("taipei-run"); setSelected(null); setArcade(true); };
  useLayoutEffect(() => {
    if (!challenge && restorePokerFocus.current) {
      restorePokerFocus.current = false;
      (pokerOrigin.current ?? pokerButton.current)?.focus({ preventScroll: true });
    }
  }, [challenge]);
  const close = () => {
    restorePokerFocus.current = true;
    setChallenge(false);
  };
  const closeDiscovery = () => { setSelected(null); requestAnimationFrame(() => opener.current?.focus({ preventScroll: true })); };
  const closeDeclaration = () => { setDeclaration(false); requestAnimationFrame(() => opener.current?.focus({ preventScroll: true })); };
  const playPoker = () => { pokerOrigin.current = selected ? opener.current : pokerButton.current; discover("poker-odds"); setSelected(null); setChallenge(true); };

  return <>
    <span ref={layerRef} className={styles.objects} data-workshop-objects data-direct-navigation
      role="group" aria-label="Explore the workshop projects">
      {/* A contained HTML frame matches the image's 3:2 projection. Native
          HTML also avoids WebKit's transformed foreignObject hit-test bug. */}
      <span className={styles.frame} style={{ width: scale * 1200, height: scale * 800 }}>
      {scale > 0 && projects.map((project, index) => {
        const object = objects[project.id as keyof typeof objects];
        if (!object) return null;
        const [px, py] = object.point;
        const [bx, by, bw, bh] = object.bounds;
        const width = Math.max((bw + 10) * scale, 44), height = Math.max((bh + 10) * scale, 44);
        const x = (bx + bw / 2) * scale - width / 2, y = (by + bh / 2) * scale - height / 2;
        const label = labels[project.id] ?? project.title;
        const contents = <><span className={styles.pin} style={{ left: px * scale - x, top: py * scale - y }}>
          <span className={styles.label} aria-hidden="true">{label}</span>
        </span><ProjectCue id={project.id} bounds={object.bounds} style={{ left: bx * scale - x, top: by * scale - y, width: bw * scale, height: bh * scale }} /></>;
        return <span key={project.id} className={styles.position} data-object-position={project.id}
          style={{ left: x, top: y, width, height, "--cue-delay": `${index * 160}ms` } as CSSProperties}>
            {project.id === "poker-odds" || project.id === "taipei-run" ?
              <button ref={project.id === "poker-odds" ? pokerButton : arcadeButton} type="button" className={styles.target} data-workshop-object={project.id}
                aria-label={label} aria-haspopup="dialog" data-tip={label} onClick={project.id === "poker-odds" ? playPoker : playArcade}>{contents}</button> :
              <a className={styles.target} data-workshop-object={project.id} href={project.href} target="_blank" rel="noopener noreferrer"
                aria-label={`${label} (opens in a new tab)`} data-tip={label} onClick={() => discover(project.id)}>{contents}</a>}
        </span>;
      })}
      {scale > 0 && islandCurios.map(object => {
        const [px,py]=object.point;
        const width=Math.max(28,Math.min(object.bounds[2]*scale,64)), height=Math.max(28,Math.min(object.bounds[3]*scale,64));
        const x=px*scale-width/2,y=py*scale-height/2;
        const clip=curiosityClip(object.point,[x/scale,y/scale,width/scale,height/scale],allPoints);
        return <span key={object.id} className={`${styles.position} ${styles.curio}`} data-object-position={object.id} data-found={found.includes(object.id)}
          style={{left:x,top:y,width,height}}>
          <button type="button" className={styles.target} data-curio={object.id} aria-label={object.id === "shield" ? "Read the Declaration of Independence" : `Pick up ${object.name}`} aria-haspopup="dialog"
            style={{clipPath:clip}} onClick={event=>inspect(object.id,event.currentTarget)}>
            <span className={styles.pin} style={{left:"50%",top:"50%"}}><span className={styles.dot} aria-hidden="true" /></span>
          </button>
          <span className={styles.curioLabel} aria-hidden="true">{object.name}</span>
        </span>;
      })}
      </span>
    </span>
    {selected && <WorkshopDiscovery selected={selected} onSelect={select} onFound={discover} onClose={closeDiscovery} onPoker={playPoker} onArcade={playArcade} />}
    {arcade && <TaipeiArcade onClose={closeArcade} />}
    {challenge && <PokerChallenge onClose={close} />}
    {declaration && <DeclarationScroll onClose={closeDeclaration} />}
  </>;
}
