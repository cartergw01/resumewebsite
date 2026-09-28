"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import IslandReturnLink from "@/components/IslandReturnLink";
import roomImage from "@/public/workroom-v1.png";
import styles from "./WorkRoom.module.css";

export type WorkAct = {
  title: string;
  headline: ReactNode;
  detail: ReactNode;
};

type WorkSceneProps = {
  company: string;
  href: string;
  roles: { title: string; dates: string }[];
  acts: WorkAct[];
};

// Keep in sync with the pinned-stage media query in WorkRoom.module.css.
const PINNED = "(min-width: 761px) and (min-height: 640px)";
// The camera visits the desk, the Taipei 101 window, then the armchair.
const CAMERA = [
  { pan: 0, zoom: 1.04, y: 0 },
  { pan: 0.72, zoom: 1.12, y: -2 },
  { pan: 1, zoom: 1.04, y: 1 },
];
// Share of each act's scroll spent holding still before the next begins.
const HOLD = 0.3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function cameraAt(position: number) {
  const index = clamp(Math.floor(position), 0, CAMERA.length - 2);
  const t = clamp(position - index, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const from = CAMERA[index];
  const to = CAMERA[index + 1];
  return {
    pan: from.pan + (to.pan - from.pan) * eased,
    zoom: from.zoom + (to.zoom - from.zoom) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
}

export default function WorkScene({ company, href, roles, acts }: WorkSceneProps) {
  const sceneRef = useRef<HTMLElement>(null);
  const actRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const pinned = window.matchMedia(PINNED);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const last = acts.length - 1;
    let frame = 0;
    let target = 0;
    let shown = -1;

    const clear = () => {
      scene.style.removeProperty("--pan");
      scene.style.removeProperty("--zoom");
      scene.style.removeProperty("--lift");
      actRefs.current.forEach((act) => ["--o", "--y", "--b"].forEach((name) => act?.style.removeProperty(name)));
    };

    const paint = () => {
      frame = 0;
      if (!pinned.matches) {
        clear();
        shown = -1;
        return;
      }
      // Ease toward the scroll position so the room glides rather than jumps.
      const next = reduce.matches || shown < 0 ? target : shown + (target - shown) * 0.14;
      shown = Math.abs(target - next) < 0.0005 ? target : next;
      const camera = cameraAt(shown);
      scene.style.setProperty("--pan", camera.pan.toFixed(4));
      scene.style.setProperty("--zoom", camera.zoom.toFixed(4));
      scene.style.setProperty("--lift", `${camera.y.toFixed(3)}%`);
      actRefs.current.forEach((act, index) => {
        if (!act) return;
        // Distance from this act: 0 is centered, ±1 is a neighbour.
        const d = shown - index;
        const away = Math.abs(d);
        act.style.setProperty("--o", clamp(1 - (away - 0.2) / 0.3, 0, 1).toFixed(3));
        act.style.setProperty("--y", reduce.matches ? "0px" : `${(-d * 56).toFixed(2)}px`);
        act.style.setProperty("--b", reduce.matches ? "0px" : `${Math.max(0, away - 0.15) * 12}px`);
      });
      setActive(clamp(Math.round(shown), 0, last));
      if (shown !== target) frame = requestAnimationFrame(paint);
    };

    const measure = () => {
      const rect = scene.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = clamp(-rect.top / travel, 0, 1);
      // Map scroll to act positions 0..last, holding still at each end.
      target = clamp(progress * (last + 2 * HOLD) - HOLD, 0, last);
      if (!frame) frame = requestAnimationFrame(paint);
    };

    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    pinned.addEventListener("change", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      pinned.removeEventListener("change", measure);
      clear();
    };
  }, [acts.length]);

  const goTo = (index: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const last = acts.length - 1;
    const top = scene.getBoundingClientRect().top + window.scrollY;
    const travel = scene.offsetHeight - window.innerHeight;
    const progress = (index + HOLD) / (last + 2 * HOLD);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + progress * travel, behavior: reduce ? "instant" : "smooth" });
  };

  return (
    <section ref={sceneRef} className={styles.scene} aria-labelledby="current-work-title" data-work-scene>
      <div className={styles.stage}>
        <div className={styles.frame} aria-hidden="true">
          <div className={styles.room}>
            <Image src={roomImage} alt="" fill priority sizes="(min-width: 761px) 110vw, 180vw" placeholder="blur" />
          </div>
        </div>
        <div className={styles.returnLink}><IslandReturnLink island="work" /></div>
        <div className={styles.stageCopy}>
          <header className={styles.intro}>
            <h1 id="current-work-title">
              <a href={href} target="_blank" rel="noopener noreferrer">{company}</a>
            </h1>
            <dl className={styles.roles} aria-label={`Roles at ${company}`}>
              {roles.map((role) => (
                <div key={role.title}><dt>{role.title}</dt><dd>{role.dates}</dd></div>
              ))}
            </dl>
          </header>

          <nav className={styles.actNav} aria-label={`Parts of the ${company} role`}>
            {acts.map((act, index) => (
              <button key={act.title} type="button" onClick={() => goTo(index)} aria-current={index === active ? "step" : undefined}>
                {act.title}
              </button>
            ))}
          </nav>

          <ol className={styles.acts}>
            {acts.map((act, index) => (
              <li key={act.title} ref={(node) => { actRefs.current[index] = node; }} className={styles.act} data-active={index === active}>
                <h2>{act.headline}</h2>
                <p>{act.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
