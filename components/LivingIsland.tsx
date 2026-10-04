"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import IslandLink from "./IslandLink";
import PerspectiveArtwork from "./PerspectiveArtwork";
import { artworkOutline } from "@/lib/artwork-perspective";
import type { IslandArtworks, IslandLandmark } from "@/lib/island-artwork";
import styles from "./IslandHome.module.css";
import motionStyles from "./LivingIsland.module.css";
import IslandOrbit from "./IslandOrbit";
import type { OrbitProjection } from "@/lib/island-orbit";
import orbitAssets from "@/lib/island-orbit-assets.json";

export default function LivingIsland({ artwork, landmark, world, preview, posters }: { artwork: Pick<IslandArtworks, "work" | "projects">; landmark: IslandLandmark; world: "work" | "projects"; preview?: string; posters?: string[] }) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const island = artwork[world];
  const city = artwork.work;
  const workshop = artwork.projects;
  const traffic = city.traffic;
  const orbitAnchors = useMemo(() => {
    const anchors: OrbitProjection = { landmark: [island.landmark] };
    anchors[world === "work" ? "entryWindow" : "screen"] = world === "work" ? city.entryWindow : workshop.screen;
    return anchors;
  }, [city, island, workshop, world]);
  // The opening view shows light previews; full islands wait for travel.
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    const visual = visualRef.current;
    const scene = visual?.closest<HTMLElement>("[data-island-scene]");
    const stage = visual?.closest<HTMLElement>("[data-island-stage]");
    if (!visual || !scene || !stage) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let posterIndex = 0;
    let posterTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingPoster: HTMLImageElement | undefined;
    const canPreload = () => !document.hidden && !connection?.saveData && scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering;
    const preloadNext = () => {
      if (!posters || posterIndex >= posters.length || posterTimer || pendingPoster || !canPreload()) return;
      posterTimer = setTimeout(() => {
        posterTimer = undefined;
        if (!canPreload()) return;
        const image = new window.Image();
        pendingPoster = image;
        image.decoding = "async";
        image.fetchPriority = "low";
        image.onload = image.onerror = () => { pendingPoster = undefined; preloadNext(); };
        image.src = posters[posterIndex++];
      }, 180);
    };
    const sync = () => {
      if (stage.dataset.warm === "true") setWarm(true);
      preloadNext();
      const allowed = !motion.matches && !connection?.saveData;
      visual.dataset.motionRunning = String(allowed && !document.hidden && scene.dataset.active === "true" && !stage.dataset.entering);
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering", "data-warm", "data-travelling"] });
    motion.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      clearTimeout(posterTimer);
      if (pendingPoster) pendingPoster.onload = pendingPoster.onerror = null;
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
            {traffic?.length === 2 ? <g className={motionStyles.traffic} data-island-traffic
              style={{ "--traffic-x": `${traffic[1][0] - traffic[0][0]}px`, "--traffic-y": `${traffic[1][1] - traffic[0][1]}px` } as CSSProperties}>
              <circle cx={traffic[0][0]} cy={traffic[0][1]} r="0.8" fill="#ffe4ad" />
              <circle cx={traffic[0][0] - 1.8} cy={traffic[0][1]} r="0.5" fill="#d89b70" />
            </g> : null}
          </svg>
          <svg className={motionStyles.cityDetails} viewBox="0 0 1200 800" aria-hidden="true">
            <g className={motionStyles.towerWelcome} fill="#dfecff">
              <circle cx={city.tower[0]} cy={city.tower[1]} r="1.1" />
            </g>
            <g data-city-entry-window data-corners={JSON.stringify(city.entryWindow)}>
              <path className={motionStyles.entryWindow} d={artworkOutline(city.entryWindow)} fill="#eacd96" />
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
            <g className={motionStyles.screenRefresh} data-screen-light>
              <PerspectiveArtwork corners={workshop.screen} width={320} height={200}>
                <image href={preview} width="320" height="200" preserveAspectRatio="xMidYMin slice" />
              </PerspectiveArtwork>
            </g>
          </g>
          <path className={motionStyles.screenRim} d={artworkOutline(workshop.screen)} fill="none" stroke="#ffe2ba" strokeWidth="0.6" />
        </svg> : null}
        <svg className={styles.touchSurface} viewBox="0 0 1200 800" aria-hidden="true">
          <path data-touch-surface={world === "work" ? "entryWindow" : "screen"} d={artworkOutline(world === "work" ? city.entryWindow : workshop.screen)} />
        </svg>
        {warm ? <IslandOrbit world={world} asset={orbitAssets[world]} anchors={orbitAnchors} /> : null}
      </span>
    </IslandLink>
  </>;
}
