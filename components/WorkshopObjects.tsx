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
import HoopShot, { type HoopShotHandle } from "./HoopShot";
import { hoopShot as shotData, project } from "@/lib/hoop-shot";

const TaipeiArcade = dynamic(() => import("./TaipeiArcade"), { ssr: false });
const DeclarationScroll = dynamic(() => import("./DeclarationScroll"), { ssr: false });
// Only things that open something real are clickable on the island: the
// project links, the chip case (Poker Odds), the arcade, and the shield (the
// Declaration). Every other prop is scenery, so a tap on it reads as the island.
const islandCurios = curios.filter(object => object.id === "shield");
// Where the still shows the basketball. It isn't an object to inspect: tapping it
// only ever shoots it.
const ballHome = (({ x, y }) => [x, y])(project(shotData.world.ball));
const allPoints = [...projects.map(project => objects[project.id as keyof typeof objects]), ...islandCurios].map(object => object.point).concat([ballHome]);
// The court and hoop answer to nothing but the ball: these outlines keep a tap on
// them from falling through to the island's link. The court, with its slab's near
// faces; then the hoop's board, net and pole.
const outline = (points: number[][]) => points.map(point => project(point));
const courtOutline = (() => {
  const [left, right, near, far] = shotData.world.court, top = shotData.world.floor, base = -.06;
  return outline([[left, far, top], [right, far, top], [right, far, base], [right, near, base], [left, near, base], [left, near, top]]);
})();
// Generous around the pole, which is only a few pixels wide on a phone.
const hoopOutline = (() => {
  const [x, rim, z] = shotData.world.rim, board = rim + .3, pole = rim + .68, net = z - shotData.world.netDepth;
  return outline([[x - .84, board, z + .86], [x + .84, board, z + .86], [x + .84, board, z - .13], [x + .42, rim, net], [x + .34, pole, 0], [x - .34, pole, 0], [x - .42, rim, net], [x - .84, board, z - .13]]);
})();
const clipTo = (points: { x: number; y: number }[], scale: number) => `polygon(${points.map(({ x, y }) => `${x * scale}px ${y * scale}px`).join(",")})`;
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
  const [arcade, setArcade] = useState(false);
  const pokerButton = useRef<HTMLButtonElement>(null);
  const restorePokerFocus = useRef(false);
  const [scale, setScale] = useState(0);
  const [challenge, setChallenge] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const hoopShot = useRef<HoopShotHandle>(null);
  const [visual, setVisual] = useState<HTMLElement | null>(null);
  // Where the ball is now, once it has left the spot the still shows it on.
  const ballPoint = useRef<number[] | null>(null);
  const [ballMoved, setBallMoved] = useState(false);
  const reposition = useRef<() => void>(() => {});
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
  const readDeclaration = (source: HTMLElement) => { opener.current = source; discover("shield"); setDeclaration(true); };

  useEffect(() => {
    if (new URL(location.href).searchParams.get("play") === "taipei-run") setArcade(true);
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const visual = layer?.closest<HTMLElement>("[data-island-visual]") as (HTMLElement & { parallax?: ParallaxState }) | null;
    if (!layer || !visual) return;
    setVisual(visual);
    const resize = () => setScale(Math.max(.15, Math.min(visual.clientWidth / 1200, visual.clientHeight / 800)));
    // Use the same depth displacement as the rendered surface. Targets move
    // with their physical objects when the pointer changes the perspective.
    const move = () => {
      const p = visual.parallax;
      for (const group of layer.querySelectorAll<HTMLElement>("[data-object-position]")) {
        const id = group.dataset.objectPosition;
        const home = id === "basketball" ? ballHome : (objects[id as keyof typeof objects] ?? curios.find(object => object.id === id))?.point;
        if (!home) continue;
        const [x, y] = id === "basketball" && ballPoint.current ? ballPoint.current : home;
        const depth = p?.depth ? p.depth(x, y) - p.focus : 0;
        group.style.transform = `translate(${(x - home[0] - 1200 * (p?.x ?? 0) * depth) * scale}px, ${(y - home[1] - 800 * (p?.y ?? 0) * depth) * scale}px)`;
      }
    };
    reposition.current = move;
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
    requestAnimationFrame(() => arcadeButton.current?.focus({ preventScroll: true }));
  };
  const playArcade = () => { discover("taipei-run"); setArcade(true); };
  useLayoutEffect(() => {
    if (!challenge && restorePokerFocus.current) {
      restorePokerFocus.current = false;
      pokerButton.current?.focus({ preventScroll: true });
    }
  }, [challenge]);
  const close = () => {
    restorePokerFocus.current = true;
    setChallenge(false);
  };
  const closeDeclaration = () => { setDeclaration(false); requestAnimationFrame(() => opener.current?.focus({ preventScroll: true })); };
  const playPoker = () => { discover("poker-odds"); setChallenge(true); };

  return <>
    <span ref={layerRef} className={styles.objects} data-workshop-objects data-direct-navigation
      role="group" aria-label="Explore the workshop projects">
      {/* A contained HTML frame matches the image's 3:2 projection. Native
          HTML also avoids WebKit's transformed foreignObject hit-test bug. */}
      <span className={styles.frame} style={{ width: scale * 1200, height: scale * 800 }}>
      {scale > 0 && visual && <HoopShot ref={hoopShot} scale={scale} visual={visual}
        onBall={(x, y) => { ballPoint.current = [x, y]; setBallMoved(true); reposition.current(); }} />}
      {scale > 0 && <span className={styles.inert} data-court-floor style={{ clipPath: clipTo(courtOutline, scale) }} />}
      {scale > 0 && <span className={styles.inert} data-hoop-inert style={{ clipPath: clipTo(hoopOutline, scale) }} />}
      {scale > 0 && projects.map((project, index) => {
        const object = objects[project.id as keyof typeof objects];
        if (!object) return null;
        const [px, py] = object.point;
        const [bx, by, bw, bh] = object.bounds;
        const width = Math.max((bw + 10) * scale, 44), height = Math.max((bh + 10) * scale, 44);
        const x = (bx + bw / 2) * scale - width / 2, y = (by + bh / 2) * scale - height / 2;
        const label = labels[project.id] ?? project.title;
        const contents = <><span className={styles.pin} style={{ left: px * scale - x, top: py * scale - y }} /><ProjectCue id={project.id} bounds={object.bounds} style={{ left: bx * scale - x, top: by * scale - y, width: bw * scale, height: bh * scale }} /></>;
        return <span key={project.id} className={styles.position} data-object-position={project.id}
          style={{ left: x, top: y, width, height, "--cue-delay": `${index * 160}ms` } as CSSProperties}>
            {project.id === "poker-odds" || project.id === "taipei-run" ?
              <button ref={project.id === "poker-odds" ? pokerButton : arcadeButton} type="button" className={styles.target} data-workshop-object={project.id}
                aria-label={label} aria-haspopup="dialog" onClick={project.id === "poker-odds" ? playPoker : playArcade}>{contents}</button> :
              <a className={styles.target} data-workshop-object={project.id} href={project.href} target="_blank" rel="noopener noreferrer"
                aria-label={`${label} (opens in a new tab)`} onClick={() => discover(project.id)}>{contents}</a>}
        </span>;
      })}
      {scale > 0 && (() => {
        // Out on the open court, with nothing near it, the ball can take a full-size target.
        const size=Math.max(ballMoved?44:28,Math.min(shotData.regions.ball[2]*scale,64));
        const x=ballHome[0]*scale-size/2,y=ballHome[1]*scale-size/2;
        const clip=curiosityClip(ballHome,[x/scale,y/scale,size/scale,size/scale],allPoints);
        return <span className={`${styles.position} ${styles.curio}`} data-object-position="basketball" style={{left:x,top:y,width:size,height:size,zIndex:ballMoved?2:undefined}}>
          <button type="button" className={styles.target} data-workshop-ball aria-label="Shoot the basketball"
            style={{clipPath:ballMoved?undefined:clip}} onClick={()=>hoopShot.current?.shoot()}>
            <span className={styles.pin} style={{left:"50%",top:"50%"}}><span className={styles.dot} aria-hidden="true" /></span>
          </button>
        </span>;
      })()}
      {scale > 0 && islandCurios.map(object => {
        const [px,py]=object.point;
        const width=Math.max(28,Math.min(object.bounds[2]*scale,64)), height=Math.max(28,Math.min(object.bounds[3]*scale,64));
        const x=px*scale-width/2,y=py*scale-height/2;
        const clip=curiosityClip(object.point,[x/scale,y/scale,width/scale,height/scale],allPoints);
        return <span key={object.id} className={`${styles.position} ${styles.curio}`} data-object-position={object.id} data-found={found.includes(object.id)}
          style={{left:x,top:y,width,height}}>
          <button type="button" className={styles.target} data-curio={object.id} aria-label="Read the Declaration of Independence" aria-haspopup="dialog"
            style={{clipPath:clip}} onClick={event=>readDeclaration(event.currentTarget)}>
            <span className={styles.pin} style={{left:"50%",top:"50%"}}><span className={styles.dot} aria-hidden="true" /></span>
          </button>
        </span>;
      })}
      </span>
    </span>
    {arcade && <TaipeiArcade onClose={closeArcade} />}
    {challenge && <PokerChallenge onClose={close} />}
    {declaration && <DeclarationScroll onClose={closeDeclaration} />}
  </>;
}
