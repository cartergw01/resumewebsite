"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./IslandHome.module.css";

export default function GalaxyBackground({ page = false }: { page?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intentRef = useRef<"auto" | "play" | "pause">("auto");
  const syncRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const stage = video?.closest<HTMLElement>("[data-island-stage], [data-island-page]");
    if (!video || !stage) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const portrait = window.matchMedia("(max-aspect-ratio: 1/1)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let disposed = false;
    let attempting = false;
    let generation = 0;
    const prefersStill = () => intentRef.current === "auto" && (motion.matches || Boolean(connection?.saveData));
    const shouldPlay = () => intentRef.current !== "pause" && !prefersStill() && !document.hidden && !stage.dataset.entering;
    const sync = () => {
      stage.dataset.ambientPaused = String(intentRef.current === "pause");
      if (!shouldPlay()) {
        video.pause();
        if (prefersStill()) setReady(false);
        return;
      }
      const source = `/starfield-loop-${portrait.matches ? "mobile" : "desktop"}-v1.mp4`;
      if (video.getAttribute("src") !== source) {
        setReady(false);
        generation++;
        attempting = false;
        video.src = source;
        video.load();
      }
      if (attempting || !video.paused) return;
      attempting = true;
      const attempt = ++generation;
      video.muted = true;
      void video.play().then(() => {
        if (disposed || !shouldPlay()) video.pause();
      }).catch(() => {
        // Keep the poster and Play control if browser autoplay is blocked.
      }).finally(() => { if (attempt === generation) attempting = false; });
    };
    syncRef.current = sync;
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering"] });
    motion.addEventListener("change", sync);
    portrait.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true;
      observer.disconnect();
      motion.removeEventListener("change", sync);
      portrait.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      syncRef.current = () => {};
      video.pause();
    };
  }, []);

  return (
    <>
      <div className={`${styles.galaxySpace} ${page ? styles.pageGalaxy : ""}`} data-galaxy-background data-ambient-paused={!playing} aria-hidden="true">
        <div className={styles.galaxy} data-galaxy-camera>
          <div className={styles.starfieldMedia} data-background-visual data-video-ready={ready}>
            <picture className={styles.starfieldPoster}>
              <source media="(max-aspect-ratio: 1/1)" srcSet="/starfield-loop-mobile-poster-v1.webp" />
              <img src="/starfield-loop-desktop-poster-v1.webp" alt="" decoding="async" fetchPriority="high" draggable={false} />
            </picture>
            <video
              ref={videoRef} className={styles.starfieldVideo} data-background-video
              autoPlay muted loop playsInline preload="none" disablePictureInPicture tabIndex={-1}
              onPlaying={() => { setReady(true); setPlaying(true); }}
              onPause={() => setPlaying(false)}
              onError={() => { setReady(false); setPlaying(false); }}
            />
          </div>
        </div>
      </div>
      <button
        type="button" className={`${styles.galaxyToggle} ${page ? styles.pageGalaxyToggle : ""}`} aria-label={`${playing ? "Pause" : "Play"} background video`}
        title={`${playing ? "Pause" : "Play"} background video`}
        onClick={() => {
          intentRef.current = playing ? "pause" : "play";
          syncRef.current();
        }}
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {playing ? <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : <path d="m7 4 9 6-9 6V4Z" fill="currentColor" />}
        </svg>
      </button>
    </>
  );
}
