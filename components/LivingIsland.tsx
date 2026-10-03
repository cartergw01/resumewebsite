"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import IslandLink from "./IslandLink";
import PerspectiveArtwork from "./PerspectiveArtwork";
import { artworkOutline } from "@/lib/artwork-perspective";
import type { IslandArtworks, IslandLandmark } from "@/lib/island-artwork";
import styles from "./IslandHome.module.css";
import motionStyles from "./LivingIsland.module.css";

export default function LivingIsland({ artwork, landmark, world, preview, posters }: { artwork: Pick<IslandArtworks, "work" | "projects">; landmark: IslandLandmark; world: "work" | "projects"; preview?: string; posters?: string[] }) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const island = artwork[world];
  const city = artwork.work;
  const workshop = artwork.projects;
  // The opening view shows light previews; full islands wait for travel.
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    const visual = visualRef.current;
    const scene = visual?.closest<HTMLElement>("[data-island-scene]");
    const stage = visual?.closest<HTMLElement>("[data-island-stage]");
    if (!visual || !scene || !stage) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let postersLoaded = false;
    const sync = () => {
      if (stage.dataset.warm === "true") setWarm(true);
      if (!postersLoaded && posters && scene.dataset.active === "true") {
        postersLoaded = true;
        for (const src of posters) { const image = document.createElement("img"); image.decoding = "async"; image.src = src; }
      }
      const allowed = !motion.matches && !connection?.saveData;
      visual.dataset.motionRunning = String(allowed && !document.hidden && scene.dataset.active === "true" && !stage.dataset.entering);
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering", "data-warm"] });
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
  }, [posters]);

  return <>
    <IslandLink href={`/${world}`} title={island.title} prompt={island.prompt} landmark={landmark} workshop={world === "projects"}>
      <span ref={visualRef} className={`${styles.island} ${motionStyles.artwork}`} data-island-visual data-living-island={world} data-motion-running="false">
        {warm ? <Image src={island.src} alt="" width={island.width} height={island.height}
          sizes="(max-width: 760px) 110vw, 68vw" loading="eager"
          unoptimized draggable={false} className={motionStyles.image} /> : null}
        {world === "work" ? <>
          <svg className={motionStyles.details} viewBox="0 0 1200 800" aria-hidden="true">
            <g className={motionStyles.windows} fill="#ffd69b">
              {city.windows.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="0.65" />)}
            </g>
          </svg>
          <svg className={motionStyles.cityDetails} viewBox="0 0 1200 800" aria-hidden="true">
            <g className={motionStyles.towerWelcome} fill="#dfecff">
              <circle cx={city.tower[0]} cy={city.tower[1]} r="1.1" />
            </g>
          </svg>
        </> : <svg className={motionStyles.details} viewBox="0 0 1200 800" aria-hidden="true">
          <g className={motionStyles.lamp} fill="#ffd38b">
            <ellipse cx={workshop.lamp[0]} cy={workshop.lamp[1]} rx="15" ry="8" />
          </g>
          <g className={motionStyles.bulbs} fill="#fff0c6">
            {workshop.bulbs.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="0.9" />)}
          </g>
        </svg>}
        {world === "projects" && preview && warm ? <svg className={motionStyles.screenResponse} viewBox="0 0 1200 800" aria-hidden="true">
          <defs>
            <radialGradient id="workshop-screen-spill"><stop stopColor="#f5dcc2" stopOpacity="0.48" /><stop offset="1" stopColor="#e5b989" stopOpacity="0" /></radialGradient>
          </defs>
          <ellipse className={motionStyles.screenSpill} cx={workshop.screenGlow[0]} cy={workshop.screenGlow[1]} rx="64" ry="24" fill="url(#workshop-screen-spill)" />
          <g className={motionStyles.screenPreview} data-workshop-screen data-src={preview} data-corners={JSON.stringify(workshop.screen)} data-posters={JSON.stringify(posters ?? [preview])}>
            <PerspectiveArtwork corners={workshop.screen} width={320} height={200}>
              <image href={preview} width="320" height="200" preserveAspectRatio="xMidYMin slice" />
            </PerspectiveArtwork>
          </g>
          <path className={motionStyles.screenRim} d={artworkOutline(workshop.screen)} fill="none" stroke="#ffe2ba" strokeWidth="0.6" />
        </svg> : null}
      </span>
    </IslandLink>
  </>;
}
