"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import IslandLink from "./IslandLink";
import styles from "./IslandHome.module.css";
import motionStyles from "./LivingIsland.module.css";

const artwork = {
  work: { title: "Work", prompt: "learn about my work", src: "/world-work-cutout-v1.webp", width: 960, height: 540 },
  projects: { title: "Projects", prompt: "see what I’ve built", src: "/world-projects-workshop-v4.webp", width: 1200, height: 800 },
};

export default function LivingIsland({ world, preview }: { world: keyof typeof artwork; preview?: string }) {
  const visualRef = useRef<HTMLSpanElement>(null);
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
      visual.dataset.motionRunning = String(allowed && stage.dataset.ambientPaused !== "true" && !document.hidden && scene.dataset.active === "true" && !stage.dataset.entering);
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering", "data-ambient-paused"] });
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
  }, []);

  return <>
    <IslandLink href={`/${world}`} title={island.title} prompt={island.prompt} workshop={world === "projects"}>
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
          <svg className={motionStyles.details} viewBox="0 0 1200 800" aria-hidden="true">
            <g className={motionStyles.screen} fill="#b4dcff">
              <circle cx="677" cy="271" r="2.5" />
              <circle cx="653" cy="268" r="1.5" />
            </g>
            <g className={motionStyles.lamp} fill="#ffd38b">
              <ellipse cx="626" cy="215" rx="20" ry="7" transform="rotate(-12 626 215)" />
              <ellipse cx="653" cy="294" rx="62" ry="12" />
            </g>
            <g className={motionStyles.bulbs} fill="#fff0c6">
              <ellipse cx="421" cy="98" rx="3" ry="6" />
              <ellipse cx="596" cy="95" rx="3" ry="6" />
              <ellipse cx="794" cy="123" rx="3" ry="6" />
              <ellipse cx="910" cy="160" rx="3" ry="6" />
            </g>
          </svg>
        )}
        {world === "work" ? <svg className={motionStyles.cityDetails} viewBox="0 0 960 540" aria-hidden="true">
          <g className={motionStyles.cityBlocks} fill="#ffda95">
            <path d="M236 204h3v10h-3zm5 14h3v8h-3zm87-20h4v15h-4zm7 7h3v11h-3zm99-18h4v10h-4zm10 13h3v9h-3zm66-8h3v10h-3zm114 30h4v10h-4zm62 15h3v8h-3z" />
          </g>
          <g className={motionStyles.towerWelcome} fill="#dfecff">
            <path d="M558 102h4v2h-4zm0 30h4v2h-4zm2 42h4v2h-4z" />
          </g>
          <g className={motionStyles.citySign} transform="translate(449 272) skewY(-7)">
            <rect x="0" y="-18" width="96" height="34" rx="2" fill="#151716" stroke="#b58c56" strokeWidth="0.5" />
            <text x="48" y="-5" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8" letterSpacing="2" fill="#e7c998">TAIPEI</text>
            <text x="48" y="8" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fill="#ffdfaa">886 Studios</text>
          </g>
        </svg> : null}
        {world === "projects" && preview ? <svg className={motionStyles.screenResponse} viewBox="0 0 1200 800" aria-hidden="true">
          <defs>
            <radialGradient id="workshop-screen-spill"><stop stopColor="#f5dcc2" stopOpacity="0.48" /><stop offset="1" stopColor="#e5b989" stopOpacity="0" /></radialGradient>
          </defs>
          <ellipse className={motionStyles.screenSpill} cx="831" cy="316" rx="74" ry="23" fill="url(#workshop-screen-spill)" />
          <g transform="matrix(0.121875 -0.028125 -0.06 0.19 831 270)">
            <image className={motionStyles.screenPreview} data-workshop-screen href={preview} width="320" height="200" preserveAspectRatio="xMidYMin slice" />
            <rect className={motionStyles.screenRim} width="320" height="200" rx="3" fill="none" stroke="#ffe2ba" strokeWidth="5" />
          </g>
        </svg> : null}
      </span>
    </IslandLink>
  </>;
}
