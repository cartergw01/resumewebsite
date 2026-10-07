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
import styles from "./IslandHome.module.css";

export default function WritingIsland({ artwork: island, landmark, essay, titles }: { artwork: IslandArtworks["writing"]; landmark: IslandLandmark; essay: EssayPreview; titles: string[] }) {
  const orbitAnchors = useMemo(() => ({ landmark: [island.landmark], spread: island.spread }), [island]);
  const visualRef = useRef<HTMLSpanElement>(null);
  const [warm, setWarm] = useState(false);

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
      <IslandLink href="/writing" title="Writing" prompt="read my writing" landmark={landmark} book>
        <span ref={visualRef} className={`${styles.island} ${styles.writingMedia}`} data-island-visual>
          {warm ? <Image
            src={island.src} alt="" width={island.width} height={island.height}
            sizes="(max-width: 760px) 100vw, 68vw" loading="eager" unoptimized draggable={false}
            className={styles.writingPoster}
          /> : null}
          {warm && island.depthSrc ? <ParallaxStill depthSrc={island.depthSrc} focus={island.landmark} className={styles.parallax} /> : null}
          {warm && island.life ? <IslandLife world="writing" life={island.life as Life} className={styles.life} /> : null}
          <svg className={styles.bookResponse} viewBox="0 0 1200 800" aria-hidden="true" data-book-response>
            <defs>
              <linearGradient id="book-page-light" x1="0" y1="0" x2="0.85" y2="1">
                <stop stopColor="#fff3c6" stopOpacity="0.05" /><stop offset="1" stopColor="#ffe6a1" stopOpacity="0.5" />
              </linearGradient>
              <radialGradient id="reading-lamp-light"><stop stopColor="#ffdc8b" stopOpacity="0.7" /><stop offset="1" stopColor="#ffdc8b" stopOpacity="0" /></radialGradient>
            </defs>
            <path className={styles.pageLight} d={artworkOutline(island.spread)} fill="url(#book-page-light)" />
            <g className={styles.pageEdges} fill="none" stroke="#ffe5a6" strokeWidth="1.25" strokeLinecap="round">
              <path d={artworkOutline(island.spread)} />
            </g>
          </svg>
          <svg className={styles.bookDetails} viewBox="0 0 1200 800" aria-hidden="true">
            <ellipse className={styles.readingLamp} cx={island.lamp[0]} cy={island.lamp[1]} rx="33" ry="18" fill="url(#reading-lamp-light)" />
            {/* These planes are projected from the actual Blender notebook. */}
            <path data-book-spread data-corners={JSON.stringify(island.spread)} data-titles={JSON.stringify(titles)} fill="none" d={artworkOutline(island.spread)} />
            <g className={styles.printedPage}>
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
    </>
  );
}
