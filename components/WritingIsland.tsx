"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import IslandLink from "./IslandLink";
import PerspectiveArtwork from "./PerspectiveArtwork";
import { artworkOutline } from "@/lib/artwork-perspective";
import type { IslandArtworks, IslandLandmark } from "@/lib/island-artwork";
import EssayLeaf, { type EssayPreview } from "./EssayLeaf";
import styles from "./IslandHome.module.css";

export default function WritingIsland({ artwork: island, landmark, essay, titles }: { artwork: IslandArtworks["writing"]; landmark: IslandLandmark; essay: EssayPreview; titles: string[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [still, setStill] = useState(true);
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const scene = video?.closest<HTMLElement>("[data-island-scene]");
    const stage = video?.closest<HTMLElement>("[data-island-stage]");
    if (!video || !scene || !stage) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let disposed = false;
    let attempting = false;
    const shouldPlay = () => !motion.matches && !connection?.saveData
      && scene.dataset.active === "true" && !stage.dataset.entering && !document.hidden;
    const sync = () => {
      if (stage.dataset.warm === "true") setWarm(true);
      const rate = stage.dataset.travelling === "true" || stage.dataset.engaged === "true" ? 1 : 0.65;
      video.defaultPlaybackRate = rate;
      video.playbackRate = rate;
      setStill(motion.matches || Boolean(connection?.saveData));
      if (!shouldPlay()) {
        video.pause();
      } else if (video.paused && !attempting) {
        attempting = true;
        video.muted = true;
        void video.play().then(() => {
          if (disposed || !shouldPlay()) video.pause();
        }).catch(() => {
          // The original artwork remains available if playback is blocked.
        }).finally(() => { attempting = false; });
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering", "data-travelling", "data-engaged", "data-warm"] });
    motion.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true;
      observer.disconnect();
      motion.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, []);

  return (
    <>
      <IslandLink href="/writing" title="Writing" prompt="read my writing" landmark={landmark} book>
        <span className={`${styles.island} ${styles.writingMedia}`} data-island-visual data-video-ready={ready && !still}>
          {warm ? <Image
            src={island.src} alt="" width={island.width} height={island.height}
            sizes="(max-width: 760px) 100vw, 68vw" loading="eager" unoptimized draggable={false}
            className={styles.writingPoster}
          /> : null}
          <video
            ref={videoRef} className={styles.writingVideo} muted loop playsInline preload="none"
            aria-hidden="true" disablePictureInPicture
            onPlaying={() => setReady(true)} onError={() => setReady(false)}
          >
            <source src={island.video.mov} type={'video/quicktime; codecs="hvc1"'} />
            <source src={island.video.webm} type={'video/webm; codecs="vp9"'} />
          </video>
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
        </span>
      </IslandLink>
    </>
  );
}
