"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import IslandLink from "./IslandLink";
import EssayLeaf, { type EssayPreview } from "./EssayLeaf";
import styles from "./IslandHome.module.css";

export default function WritingIsland({ essay }: { essay: EssayPreview }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [still, setStill] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    const scene = video?.closest<HTMLElement>("[data-island-scene]");
    const stage = video?.closest<HTMLElement>("[data-island-stage]");
    if (!video || !scene || !stage) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let disposed = false;
    let attempting = false;
    const shouldPlay = () => !motion.matches && !connection?.saveData && stage.dataset.ambientPaused !== "true"
      && scene.dataset.active === "true" && !stage.dataset.entering && !document.hidden;
    const sync = () => {
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
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering", "data-ambient-paused", "data-travelling", "data-engaged"] });
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
      <IslandLink href="/writing" title="Writing" prompt="read my writing" book>
        <span className={`${styles.island} ${styles.writingMedia}`} data-island-visual data-video-ready={ready && !still}>
          <Image
            src="/world-writing-cutout-v1.webp" alt="" width={960} height={529}
            sizes="(max-width: 760px) 100vw, 68vw" loading="eager" unoptimized draggable={false}
            className={styles.writingPoster}
          />
          <video
            ref={videoRef} className={styles.writingVideo} muted loop playsInline preload="none"
            aria-hidden="true" disablePictureInPicture
            onPlaying={() => setReady(true)} onError={() => setReady(false)}
          >
            <source src="/writing-island-loop-v1.mov" type={'video/quicktime; codecs="hvc1"'} />
            <source src="/writing-island-loop-v1.webm" type={'video/webm; codecs="vp9"'} />
          </video>
          <svg className={styles.bookResponse} viewBox="0 0 960 529" aria-hidden="true" data-book-response>
            <defs>
              <linearGradient id="book-page-light" x1="0" y1="0" x2="0.85" y2="1">
                <stop stopColor="#fff3c6" stopOpacity="0.05" /><stop offset="1" stopColor="#ffe6a1" stopOpacity="0.5" />
              </linearGradient>
              <radialGradient id="reading-lamp-light"><stop stopColor="#ffdc8b" stopOpacity="0.7" /><stop offset="1" stopColor="#ffdc8b" stopOpacity="0" /></radialGradient>
            </defs>
            <path className={styles.pageLight} d="M330 222Q380 196 449 196Q483 205 519 266Q458 272 397 290Z M461 196Q498 179 527 188Q567 206 621 243Q564 239 527 265Q504 218 461 196Z" fill="url(#book-page-light)" />
            <g className={styles.pageEdges} fill="none" stroke="#ffe5a6" strokeWidth="1.25" strokeLinecap="round">
              <path d="M331 226Q360 264 397 290Q460 272 515 268 M530 267Q574 246 629 251" />
              <path d="M455 199Q494 219 521 264" opacity="0.6" />
            </g>
          </svg>
          <svg className={styles.bookDetails} viewBox="0 0 960 529" aria-hidden="true">
            <ellipse className={styles.readingLamp} cx="308" cy="108" rx="33" ry="15" fill="url(#reading-lamp-light)" />
            <g className={styles.printedPage} transform="matrix(0.22 -0.02 0.205 0.16 464 196)">
              <svg data-book-page viewBox="0 0 320 400" width="320" height="400"><EssayLeaf essay={essay} /></svg>
            </g>
          </svg>
        </span>
      </IslandLink>
    </>
  );
}
