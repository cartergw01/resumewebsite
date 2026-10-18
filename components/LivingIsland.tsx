"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import IslandLink from "./IslandLink";
import PerspectiveArtwork from "./PerspectiveArtwork";
import { artworkOutline } from "@/lib/artwork-perspective";
import { towerFloors, type IslandArtworks, type IslandLandmark } from "@/lib/island-artwork";
import styles from "./IslandHome.module.css";
import motionStyles from "./LivingIsland.module.css";
import CityTimeToggle from "./CityTimeToggle";
import RoomLightSwitch from "./RoomLightSwitch";
import { ROOM_LIGHTS_INTENT, storedLightsOn } from "@/lib/room-lights";
import { CITY_DAY_INTENT, currentCityTime, storedCityTime } from "@/lib/city-time";
import { prepareWorkEntry } from "@/lib/work-entry";
import CityFireworks from "./CityFireworks";
import ParallaxStill, { type LightMasks } from "./ParallaxStill";
import IslandLife, { type Life } from "./IslandLife";

export default function LivingIsland({ artwork, landmark, world, preview, posters }: { artwork: Pick<IslandArtworks, "work" | "projects">; landmark: IslandLandmark; world: "work" | "projects"; preview?: string; posters?: string[] }) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const island = artwork[world];
  const city = artwork.work;
  const workshop = artwork.projects;
  const traffic = city.traffic;
  // The opening view shows light previews; full islands wait for travel.
  const [warm, setWarm] = useState(false);
  // Taipei's daytime still waits until day is chosen, or someone reaches for
  // the switch; most visits never leave the night.
  const [dayWanted, setDayWanted] = useState(false);
  useEffect(() => {
    if (world !== "work") return;
    const want = () => setDayWanted(true);
    if (currentCityTime() === "day" || storedCityTime() === "day") want();
    window.addEventListener(CITY_DAY_INTENT, want);
    return () => window.removeEventListener(CITY_DAY_INTENT, want);
  }, [world]);
  // The workshop's lights-off still loads when someone reaches for its
  // switch, or at once if they left the lights off last time.
  const [darkWanted, setDarkWanted] = useState(false);
  useEffect(() => {
    if (world !== "projects") return;
    if (!storedLightsOn("projects")) setDarkWanted(true);
    const want = (event: Event) => { if ((event as CustomEvent).detail === "projects") setDarkWanted(true); };
    window.addEventListener(ROOM_LIGHTS_INTENT, want);
    return () => window.removeEventListener(ROOM_LIGHTS_INTENT, want);
  }, [world]);

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
    let lingerTimer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      if (stage.dataset.warm === "true") setWarm(true);
      preloadNext();
      // Lingering on Taipei is intent too: fetch the full render its entry
      // pushes into, so a quick tap on a phone still lands sharp.
      clearTimeout(lingerTimer);
      if (world === "work" && canPreload()) lingerTimer = setTimeout(() => { if (canPreload()) prepareWorkEntry(visual); }, 1500);
      const allowed = !motion.matches && !connection?.saveData;
      // Ambient SVG motion rests while the camera travels: it would restyle
      // and repaint the island on every frame of the crossing.
      visual.dataset.motionRunning = String(allowed && !document.hidden && scene.dataset.active === "true" && !stage.dataset.entering && stage.dataset.travelling !== "true");
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
      clearTimeout(lingerTimer);
      if (pendingPoster) pendingPoster.onload = pendingPoster.onerror = null;
      motion.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [posters, world]);

  return <>
    <IslandLink href={`/${world}`} title={island.title} prompt={island.prompt} landmark={landmark} workshop={world === "projects"}>
      <span ref={visualRef} className={`${styles.island} ${motionStyles.artwork}`} data-island-visual data-reads="island-light:filter" data-living-island={world} data-motion-running="false">
        {/* On phones the island overhangs the screen by 3rem each side, so it
            shows at ~115vw; asking for 90vw made phones upscale a smaller file. */}
        {warm ? <Image src={island.src} alt="" width={island.width} height={island.height}
          sizes="(max-width: 760px) 115vw, 68vw" loading="eager"
          quality={75} draggable={false} className={`${motionStyles.image} ${world === "work" ? motionStyles.nightImage : ""}`}
          data-lights-on={world === "projects" ? "projects" : undefined} /> : null}
        {world === "projects" && warm && darkWanted && "darkSrc" in island && island.darkSrc ? <Image src={island.darkSrc as string} alt="" width={island.width} height={island.height}
          sizes="(max-width: 760px) 115vw, 68vw" loading="eager" data-lights-off="projects"
          quality={75} draggable={false} className={motionStyles.image} /> : null}
        {world === "work" && warm && dayWanted && "daySrc" in city && city.daySrc ? <Image src={city.daySrc as string} alt="" width={island.width} height={island.height}
          sizes="(max-width: 760px) 115vw, 68vw" loading="lazy" data-city-time="day"
          quality={75} draggable={false} className={`${motionStyles.image} ${motionStyles.dayImage}`} /> : null}
        {warm && "depthSrc" in island && island.depthSrc ? <ParallaxStill depthSrc={island.depthSrc as string} focus={island.landmark} room={world === "projects" ? "projects" : undefined}
          masks={world === "projects" && "lightMasks" in island ? island.lightMasks as LightMasks : undefined} className={styles.parallax} /> : null}
        {warm && "life" in island && island.life ? <IslandLife world={world} life={island.life as Life} className={styles.life} /> : null}
        {world === "work" ? <>
          <svg className={`${motionStyles.details} ${motionStyles.nightOnly}`} data-reads="island-lights:opacity:.4" viewBox="0 0 1200 800" aria-hidden="true">
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
            <g className={`${motionStyles.towerWelcome} ${motionStyles.nightOnly}`} data-reads="city-tower:opacity" fill="#dfecff">
              <circle cx={city.tower[0]} cy={city.tower[1]} r="1.1" />
            </g>
            {/* The Work entry spells its heading down Taipei 101 in light, as
                the real tower spells its messages (lib/work-entry.ts). */}
            {"Work".split("").map((letter, index) => <text key={letter} className={motionStyles.towerLetter} data-tower-letter={index}
              x={towerFloors[index].x} y={towerFloors[index].y} fontSize={towerFloors[index].height * .72} textAnchor="middle" dominantBaseline="central">{letter}</text>)}
            <g data-city-entry-window data-corners={JSON.stringify(city.entryWindow)}>
              <path className={motionStyles.entryWindow} d={artworkOutline(city.entryWindow)} fill="#eacd96" />
            </g>
          </svg>
          {warm ? <CityFireworks tower={city.tower} launch={"life" in city ? (city.life as Life).fireworks : undefined} className={`${motionStyles.fireworks} ${motionStyles.nightOnly}`} /> : null}
        </> : <svg className={motionStyles.details} data-reads="island-lights:opacity:.4" viewBox="0 0 1200 800" aria-hidden="true">
          <g className={motionStyles.lamp} fill="#ffd38b" data-room-light="projects">
            <ellipse cx={workshop.lamp[0]} cy={workshop.lamp[1]} rx="15" ry="8" />
          </g>
          <g className={motionStyles.bulbs} fill="#fff0c6" data-room-light="projects">
            {workshop.bulbs.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="0.9" />)}
          </g>
        </svg>}
        {world === "projects" && preview && warm ? <svg className={motionStyles.screenResponse} viewBox="0 0 1200 800" aria-hidden="true">
          <defs>
            <radialGradient id="workshop-screen-spill"><stop stopColor="#f5dcc2" stopOpacity="0.48" /><stop offset="1" stopColor="#e5b989" stopOpacity="0" /></radialGradient>
          </defs>
          <ellipse className={motionStyles.screenSpill} cx={workshop.screenGlow[0]} cy={workshop.screenGlow[1]} rx="64" ry="24" fill="url(#workshop-screen-spill)" />
          <g className={motionStyles.screenPreview} data-reads="workshop-screen:opacity" data-workshop-screen data-src={posters?.[0] ?? preview} data-corners={JSON.stringify(workshop.screen)} data-posters={JSON.stringify(posters ?? [preview])}>
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
      </span>
    </IslandLink>
    {world === "work" ? <CityTimeToggle /> : <RoomLightSwitch world="projects" />}
  </>;
}
