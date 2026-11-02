"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { projects } from "@/content/portfolio";
import objects from "@/lib/workshop-objects.json";
import { ARTWORK_PARALLAX_EVENT } from "@/lib/artwork-perspective";
import type { ParallaxState } from "./IslandLife";
import PokerChallenge from "./PokerChallenge";
import styles from "./WorkshopObjects.module.css";
import { curios, curiosityClip } from "@/lib/workshop-discoveries";

const WorkshopDiscovery = dynamic(() => import("./WorkshopDiscovery"), { ssr: false });
const allPoints = [...Object.values(objects), ...curios].map(object => object.point);
const known = new Set([...projects, ...curios].map(object => object.id));
const FOUND_KEY = "carter-workshop-discoveries-v1";

const descriptions: Record<string, string> = {
  "taipei-run": "Play Taipei Run at the arcade",
  "taipei-flix": "Explore TaipeiFlix on the cinema poster",
  "poker-odds": "Play the poker odds challenge",
  stocker: "Open Stocker on the research terminal",
  "taipei-guide": "Explore Carter's Taipei Guide on the map",
  "886-studios": "Visit 886 Studios from the studio plaque",
  "ikigai-timer": "Open the ikigai Timer",
  "night-night-ko": "Open Night night, Ko from the moon clock",
};

export default function WorkshopObjects() {
  const layerRef = useRef<HTMLSpanElement>(null);
  const pokerButton = useRef<HTMLButtonElement>(null);
  const pokerOrigin = useRef<HTMLElement | null>(null);
  const [scale, setScale] = useState(0);
  const [challenge, setChallenge] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
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
  const inspect = (id: string, source: HTMLElement) => { opener.current = source; select(id); };

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

  const close = () => {
    setChallenge(false);
    requestAnimationFrame(() => (pokerOrigin.current ?? pokerButton.current)?.focus({ preventScroll: true }));
  };
  const closeDiscovery = () => { setSelected(null); requestAnimationFrame(() => opener.current?.focus({ preventScroll: true })); };
  const playPoker = () => { pokerOrigin.current = selected ? opener.current : pokerButton.current; discover("poker-odds"); setSelected(null); setChallenge(true); };

  return <>
    <span ref={layerRef} className={styles.objects} data-workshop-objects data-direct-navigation
      role="group" aria-label="Explore the workshop projects">
      {/* A contained HTML frame matches the image's 3:2 projection. Native
          HTML also avoids WebKit's transformed foreignObject hit-test bug. */}
      <span className={styles.frame} style={{ width: scale * 1200, height: scale * 800 }}>
      {scale > 0 && projects.map(project => {
        const object = objects[project.id as keyof typeof objects];
        if (!object) return null;
        const [px, py] = object.point;
        const [bx, by, bw, bh] = object.bounds;
        const width = Math.max((bw + 10) * scale, 28), height = Math.max((bh + 10) * scale, 28);
        const x = (bx + bw / 2) * scale - width / 2, y = (by + bh / 2) * scale - height / 2;
        const label = descriptions[project.id];
        const contents = <span className={styles.pin} style={{ left: px * scale - x, top: py * scale - y }}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label} aria-hidden="true">{project.id === "poker-odds" ? "Poker odds challenge" : project.title}</span>
        </span>;
        return <span key={project.id} className={styles.position} data-object-position={project.id}
          style={{ left: x, top: y, width, height }}>
            {project.id === "poker-odds" ?
              <button ref={pokerButton} type="button" className={styles.target} data-workshop-object={project.id}
                aria-label={label} aria-haspopup="dialog" data-tip={label} onClick={playPoker}>{contents}</button> :
              <a className={styles.target} data-workshop-object={project.id} href={project.href} target="_blank" rel="noopener noreferrer"
                aria-label={`${label} (opens in a new tab)`} data-tip={label} onClick={() => discover(project.id)}>{contents}</a>}
        </span>;
      })}
      {scale > 0 && curios.map(object => {
        const [px,py]=object.point;
        const width=Math.max(28,Math.min(object.bounds[2]*scale,64)), height=Math.max(28,Math.min(object.bounds[3]*scale,64));
        const x=px*scale-width/2,y=py*scale-height/2;
        const clip=curiosityClip(object.point,[x/scale,y/scale,width/scale,height/scale],allPoints);
        return <span key={object.id} className={`${styles.position} ${styles.curio}`} data-object-position={object.id} data-found={found.includes(object.id)}
          style={{left:x,top:y,width,height}}>
          <button type="button" className={styles.target} data-curio={object.id} aria-label={`Pick up ${object.name}`} aria-haspopup="dialog"
            data-tip={object.name} style={{clipPath:clip}} onClick={event=>inspect(object.id,event.currentTarget)}>
            <span className={styles.pin} style={{left:"50%",top:"50%"}}><span className={styles.dot} aria-hidden="true" /></span>
          </button>
          <span className={styles.curioLabel} aria-hidden="true">{object.name}</span>
        </span>;
      })}
      </span>
    </span>
    {selected && <WorkshopDiscovery selected={selected} found={found} onSelect={select} onFound={discover} onClose={closeDiscovery} onPoker={playPoker} />}
    {challenge && <PokerChallenge onClose={close} />}
  </>;
}
