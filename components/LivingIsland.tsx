"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import IslandLink from "./IslandLink";
import styles from "./IslandHome.module.css";
import motionStyles from "./LivingIsland.module.css";

const artwork = {
  work: { title: "Work", prompt: "learn about my work", src: "/world-work-cutout-v1.webp", width: 960, height: 540 },
  projects: { title: "Projects", prompt: "see what I’ve built", src: "/world-projects-workshop-v3.webp", width: 1200, height: 800 },
};

export default function LivingIsland({ world }: { world: keyof typeof artwork }) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const [available, setAvailable] = useState(false);
  const island = artwork[world];

  useEffect(() => {
    const visual = visualRef.current;
    const scene = visual?.closest<HTMLElement>("[data-island-scene]");
    const stage = visual?.closest<HTMLElement>("[data-island-stage]");
    if (!visual || !scene || !stage) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const sync = () => {
      const allowed = !motion.matches && !connection?.saveData;
      setAvailable(allowed);
      visual.dataset.motionRunning = String(allowed && !paused && !document.hidden && scene.dataset.active === "true" && !stage.dataset.entering);
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering"] });
    motion.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused]);

  return <>
    <IslandLink href={`/${world}`} title={island.title} prompt={island.prompt}>
      <span ref={visualRef} className={`${styles.island} ${motionStyles.artwork}`} data-island-visual data-living-island={world} data-motion-running="false">
        <Image src={island.src} alt="" width={island.width} height={island.height}
          sizes="(max-width: 760px) 110vw, 68vw" priority={world === "work"} loading={world === "work" ? undefined : "eager"}
          unoptimized draggable={false} className={motionStyles.image} />
        {world === "work" ? (
          <svg className={motionStyles.details} viewBox="0 0 960 540" aria-hidden="true">
            <g className={motionStyles.windows} fill="#ffd69b">
              <path d="M237 209h2v4h-2zm5 11h2v3h-2zm88-18h3v3h-3zm5 8h2v3h-2zm101-18h3v3h-3zm8 12h3v3h-3zm66-7h2v3h-2zm4 13h2v4h-2zm111 16h3v3h-3zm8 8h3v3h-3zm54 8h2v3h-2zm4 8h3v3h-3z" />
            </g>
            <g className={motionStyles.windowsLate} fill="#d3ecff">
              <path d="M558 102h4v2h-4zm0 30h4v2h-4zm2 42h4v2h-4zm-54-7h3v2h-3zm-92 65h3v3h-3zm43-66h2v3h-2zm222 80h3v3h-3z" />
            </g>
          </svg>
        ) : (
          <svg className={motionStyles.details} viewBox="0 0 1536 1024" aria-hidden="true">
            <g className={motionStyles.screen} fill="#b4dcff">
              <path d="m723 269 151 9-4 89-150-11z" />
              <path d="m934 339 81 10-14 53-78-14z" />
            </g>
            <g className={motionStyles.lamp} fill="#ffd38b">
              <ellipse cx="675" cy="290" rx="40" ry="18" />
              <ellipse cx="657" cy="379" rx="74" ry="13" />
            </g>
            <g className={motionStyles.bulbs} fill="#fff0c6">
              <ellipse cx="580" cy="149" rx="3" ry="6" />
              <ellipse cx="780" cy="144" rx="3" ry="6" />
              <ellipse cx="1013" cy="178" rx="3" ry="6" />
            </g>
          </svg>
        )}
      </span>
    </IslandLink>
    {available && <button type="button" className={styles.motionToggle} onClick={() => setPaused(!paused)}
      aria-label={`${paused ? "Play" : "Pause"} ${world} island animation`} title={`${paused ? "Play" : "Pause"} island animation`}>
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {paused ? <path d="m7 4 9 6-9 6V4Z" fill="currentColor" /> : <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
      </svg>
    </button>}
  </>;
}
