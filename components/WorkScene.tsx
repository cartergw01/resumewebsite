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

// Each act moves the camera to a different corner of the room:
// the desk, the Taipei 101 window, then the armchair.
const focus = ["desk", "window", "chair"] as const;
// Keep in sync with the pinned-stage media query in WorkRoom.module.css.
const PINNED = "(min-width: 761px) and (min-height: 640px)";

export default function WorkScene({ company, href, roles, acts }: WorkSceneProps) {
  const sceneRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const pinned = window.matchMedia(PINNED);
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!pinned.matches) {
        scene.style.removeProperty("--act-progress");
        return;
      }
      const rect = scene.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel)) * acts.length;
      const index = Math.min(acts.length - 1, Math.floor(progress));
      scene.style.setProperty("--act-progress", String(Math.min(1, progress - index)));
      setActive(index);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    pinned.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      pinned.removeEventListener("change", schedule);
    };
  }, [acts.length]);

  const goTo = (index: number) => {
    const scene = sceneRef.current;
    if (!scene || !window.matchMedia(PINNED).matches) return;
    const top = scene.getBoundingClientRect().top + window.scrollY;
    const travel = scene.offsetHeight - window.innerHeight;
    // Land a little inside the act so rounding never shows the previous one.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + ((index + 0.08) / acts.length) * travel, behavior: reduce ? "instant" : "smooth" });
  };

  return (
    <section ref={sceneRef} className={styles.scene} data-focus={focus[active]} aria-labelledby="current-work-title" data-work-scene>
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

          <ol className={styles.acts}>
            {acts.map((act, index) => (
              <li key={act.title} className={styles.act} data-active={index === active} data-done={index < active}>
                <button type="button" className={styles.actTab} onClick={() => goTo(index)} aria-current={index === active ? "step" : undefined}>
                  <span>{act.title}</span>
                  <span className={styles.actMeter} aria-hidden="true" />
                </button>
                <div className={styles.actBody}>
                  <div>
                    <h2>{act.headline}</h2>
                    <p>{act.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
