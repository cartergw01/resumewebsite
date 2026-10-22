"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import IslandLink from "./IslandLink";
import ParallaxStill, { type LightMasks } from "./ParallaxStill";
import IslandLife, { type Life } from "./IslandLife";
import { artworkOutline } from "@/lib/artwork-perspective";
import type { IslandArtworks, IslandLandmark } from "@/lib/island-artwork";
import StudyClock from "./StudyClock";
import { ROOM_LIGHTS_INTENT, storedLightsOn } from "@/lib/room-lights";
import type { NotebookEssay } from "@/lib/workshop-entry";
import styles from "./IslandHome.module.css";

export default function WritingIsland({ artwork: island, landmark, pages }: { artwork: IslandArtworks["writing"]; landmark: IslandLandmark; pages: NotebookEssay[] }) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const [warm, setWarm] = useState(false);
  // The desk without its notebook, shown while the Writing entry lifts the
  // notebook off it, loads when someone reaches for the island.
  const [liftWanted, setLiftWanted] = useState(false);
  useEffect(() => {
    const link = visualRef.current?.closest<HTMLElement>("[data-island-link]");
    if (!link) return;
    const want = () => setLiftWanted(true);
    const intents = ["pointerenter", "pointerdown", "focusin", "touchstart"] as const;
    intents.forEach(type => link.addEventListener(type, want, { passive: true, once: true }));
    return () => intents.forEach(type => link.removeEventListener(type, want));
  }, []);
  // The lights-off still loads when someone reaches for the switch, or at once
  // if they left the study dark last time.
  const [darkWanted, setDarkWanted] = useState(false);
  useEffect(() => {
    if (!storedLightsOn("writing")) setDarkWanted(true);
    const want = (event: Event) => { if ((event as CustomEvent).detail === "writing") setDarkWanted(true); };
    window.addEventListener(ROOM_LIGHTS_INTENT, want);
    return () => window.removeEventListener(ROOM_LIGHTS_INTENT, want);
  }, []);

  // The full still loads on the first sign of travel, like the other islands.
  useEffect(() => {
    const stage = visualRef.current?.closest<HTMLElement>("[data-island-stage]");
    if (!stage) return;
    const sync = () => { if (stage.dataset.warm === "true") setWarm(true); };
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-warm"] });
    sync();
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <IslandLink href="/writing" title="Writing" prompt="click to read my writing" landmark={landmark} book>
        <span ref={visualRef} className={`${styles.island} ${styles.writingMedia}`} data-island-visual data-reads="island-light:filter">
          {warm ? <Image
            src={island.src} alt="" width={island.width} height={island.height}
            sizes="(max-width: 760px) 115vw, 68vw" loading="eager" quality={75} draggable={false}
            className={styles.writingPoster} data-lights-on="writing"
          /> : null}
          {warm && darkWanted && "darkSrc" in island && island.darkSrc ? <Image
            src={island.darkSrc as string} alt="" width={island.width} height={island.height}
            sizes="(max-width: 760px) 115vw, 68vw" loading="eager" quality={75} draggable={false}
            className={styles.writingPoster} data-lights-off="writing"
          /> : null}
          {warm && liftWanted && "liftedSrc" in island && island.liftedSrc ? <Image
            src={island.liftedSrc as string} alt="" width={island.width} height={island.height}
            sizes="(max-width: 760px) 115vw, 68vw" loading="eager" quality={75} draggable={false}
            className={styles.writingPoster} data-book-lifted="lit"
          /> : null}
          {warm && liftWanted && darkWanted && "liftedDarkSrc" in island && island.liftedDarkSrc ? <Image
            src={island.liftedDarkSrc as string} alt="" width={island.width} height={island.height}
            sizes="(max-width: 760px) 115vw, 68vw" loading="eager" quality={75} draggable={false}
            className={styles.writingPoster} data-book-lifted="dark"
          /> : null}
          {warm && island.depthSrc ? <ParallaxStill depthSrc={island.depthSrc} focus={island.landmark} room="writing"
            masks={"lightMasks" in island ? island.lightMasks as LightMasks : undefined} className={styles.parallax} /> : null}
          {warm && island.life ? <IslandLife world="writing" life={island.life as Life} className={styles.life} /> : null}
          {warm && (island.life as Life)?.clock ? <StudyClock face={(island.life as Life).clock!} className={styles.bookDetails} /> : null}
          <svg className={styles.bookDetails} viewBox="0 0 1200 800" aria-hidden="true">
            <defs>
              <radialGradient id="reading-lamp-light"><stop stopColor="#ffdc8b" stopOpacity="0.7" /><stop offset="1" stopColor="#ffdc8b" stopOpacity="0" /></radialGradient>
            </defs>
            <ellipse className={styles.readingLamp} data-reads="reading-lamp:opacity:.4" data-room-light="writing" cx={island.lamp[0]} cy={island.lamp[1]} rx="33" ry="18" fill="url(#reading-lamp-light)" />
            {/* An invisible entry anchor; paper and ink belong to the rendered book. */}
            <path data-book-spread data-corners={JSON.stringify(island.spread)} data-essays={JSON.stringify(pages)} fill="none" d={artworkOutline(island.spread)} />
          </svg>
        </span>
      </IslandLink>
    </>
  );
}
