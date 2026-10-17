"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import IslandLink from "./IslandLink";
import IslandOrbit from "./IslandOrbit";
import ParallaxStill from "./ParallaxStill";
import IslandLife, { type Life } from "./IslandLife";
import orbitAssets from "@/lib/island-orbit-assets.json";
import PerspectiveArtwork from "./PerspectiveArtwork";
import { artworkOutline } from "@/lib/artwork-perspective";
import type { IslandArtworks, IslandLandmark } from "@/lib/island-artwork";
import EssayLeaf, { type EssayPreview } from "./EssayLeaf";
import RoomLightSwitch from "./RoomLightSwitch";
import { ROOM_LIGHTS_INTENT, storedLightsOn } from "@/lib/room-lights";
import type { NotebookEssay } from "@/lib/workshop-entry";
import styles from "./IslandHome.module.css";

export default function WritingIsland({ artwork: island, landmark, essay, pages }: { artwork: IslandArtworks["writing"]; landmark: IslandLandmark; essay: EssayPreview; pages: NotebookEssay[] }) {
  const orbitAnchors = useMemo(() => ({ landmark: [island.landmark], spread: island.spread }), [island]);
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
          {warm && island.depthSrc ? <ParallaxStill depthSrc={island.depthSrc} focus={island.landmark} room="writing" className={styles.parallax} /> : null}
          {warm && island.life ? <IslandLife world="writing" life={island.life as Life} className={styles.life} /> : null}
          <svg className={styles.bookResponse} viewBox="0 0 1200 800" aria-hidden="true" data-book-response data-book-surface>
            <defs>
              <linearGradient id="book-page-light" x1="0" y1="0" x2="0.85" y2="1">
                <stop stopColor="#fff3c6" stopOpacity="0.05" /><stop offset="1" stopColor="#ffe6a1" stopOpacity="0.5" />
              </linearGradient>
              <radialGradient id="reading-lamp-light"><stop stopColor="#ffdc8b" stopOpacity="0.7" /><stop offset="1" stopColor="#ffdc8b" stopOpacity="0" /></radialGradient>
            </defs>
            <path className={styles.pageLight} data-reads="reading-paper:opacity:.15" data-room-light="writing" d={artworkOutline(island.spread)} fill="url(#book-page-light)" />
            <g className={styles.pageEdges} fill="none" stroke="#ffe5a6" strokeWidth="1.25" strokeLinecap="round">
              <path d={artworkOutline(island.spread)} />
            </g>
          </svg>
          <svg className={styles.bookDetails} viewBox="0 0 1200 800" aria-hidden="true">
            <ellipse className={styles.readingLamp} data-reads="reading-lamp:opacity:.4" data-room-light="writing" cx={island.lamp[0]} cy={island.lamp[1]} rx="33" ry="18" fill="url(#reading-lamp-light)" />
            {/* These planes are projected from the actual Blender notebook. */}
            <path data-book-spread data-corners={JSON.stringify(island.spread)} data-essays={JSON.stringify(pages)} fill="none" d={artworkOutline(island.spread)} />
            <g className={styles.printedPage} data-reads="reading-paper:opacity:.22:.78" data-room-dim="writing" data-book-surface>
              <PerspectiveArtwork corners={island.page} width={320} height={400}>
                <svg data-book-page viewBox="0 0 320 400" width="320" height="400"><EssayLeaf essay={essay} /></svg>
              </PerspectiveArtwork>
            </g>
          </svg>
          <svg className={styles.touchSurface} viewBox="0 0 1200 800" aria-hidden="true">
            <path data-touch-surface="spread" d={artworkOutline(island.spread)} />
          </svg>
          {warm ? <IslandOrbit world="writing" asset={orbitAssets.writing} anchors={orbitAnchors} /> : null}
        </span>
      </IslandLink>
      <RoomLightSwitch world="writing" />
    </>
  );
}
