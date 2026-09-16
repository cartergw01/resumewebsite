"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import IslandLink from "./IslandLink";
import styles from "./IslandHome.module.css";

export default function WritingIsland() {
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
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering", "data-ambient-paused"] });
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
      <IslandLink href="/writing" title="Writing" prompt="read my writing">
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
        </span>
      </IslandLink>
    </>
  );
}
