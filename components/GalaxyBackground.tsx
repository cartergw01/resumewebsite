"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./IslandHome.module.css";

export default function GalaxyBackground({ page = false, playbackRate = 1 }: { page?: boolean; playbackRate?: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

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
    // Some in-app browsers on iPhone (Arc, social apps) play every video
    // fullscreen in the system player, ignoring playsinline. They also refuse
    // muted autoplay, so the first attempt, made outside any gesture, tells:
    // if it is refused, the loop never tries again (a later attempt during a
    // scroll would be allowed, and would throw the visitor into a fullscreen
    // player). Low Power Mode in Safari refuses too, and keeps the still.
    let inlineRefused = false;
    const refuse = () => {
      inlineRefused = true;
      video.pause();
      setReady(false);
    };
    // A last guard: if playback goes fullscreen anyway, leave it at once.
    const leaveFullscreen = () => {
      (video as HTMLVideoElement & { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
      refuse();
    };
    video.addEventListener("webkitbeginfullscreen", leaveFullscreen);
    video.setAttribute("webkit-playsinline", "");
    // The 240KB loop waits until the page has loaded and gone idle: its poster
    // is the same frame, and on a phone the download would otherwise compete
    // with the islands and fonts that make up the first view.
    let settled = false;
    let idle = 0;
    const settle = () => {
      const go = () => { if (!disposed) { settled = true; sync(); } };
      // Safari has no requestIdleCallback.
      if (typeof requestIdleCallback === "function") idle = requestIdleCallback(go, { timeout: 2500 });
      else idle = setTimeout(go, 800) as unknown as number;
    };
    if (document.readyState === "complete") settle(); else window.addEventListener("load", settle, { once: true });
    // No manual pause control: the video only stills for reduced motion,
    // data saver, a hidden tab, or while entering an island.
    const prefersStill = () => motion.matches || Boolean(connection?.saveData);
    const shouldPlay = () => !prefersStill() && !document.hidden && !stage.dataset.entering;
    const sync = () => {
      // Keep the real video running while reading, with more energy in flight.
      const rate = (!page && stage.dataset.travelling !== "true" && stage.dataset.engaged !== "true" ? 0.55 : 1) * playbackRate;
      // Loading or switching the portrait source restores the default rate.
      video.defaultPlaybackRate = rate;
      video.playbackRate = rate;
      if (!shouldPlay() || inlineRefused) {
        video.pause();
        if (prefersStill()) setReady(false);
        return;
      }
      if (!settled) return;
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
      }).catch((error: unknown) => {
        // Autoplay refused: keep the poster, and never retry from a gesture.
        if (error instanceof DOMException && error.name === "NotAllowedError") refuse();
      }).finally(() => { if (attempt === generation) attempting = false; });
    };
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-entering", "data-travelling", "data-engaged"] });
    motion.addEventListener("change", sync);
    portrait.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true;
      window.removeEventListener("load", settle);
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(idle); else clearTimeout(idle);
      observer.disconnect();
      motion.removeEventListener("change", sync);
      portrait.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      video.removeEventListener("webkitbeginfullscreen", leaveFullscreen);
      video.pause();
    };
  }, [page, playbackRate]);

  return (
    <>
      <div className={`${styles.galaxySpace} ${page ? styles.pageGalaxy : ""}`} data-galaxy-background aria-hidden="true">
        <div className={styles.galaxy} data-galaxy-camera>
          <div className={styles.starfieldMedia} data-background-visual data-video-ready={ready}>
            <picture className={styles.starfieldPoster}>
              <source media="(max-aspect-ratio: 1/1)" srcSet="/starfield-loop-mobile-poster-v1.webp" />
              <img src="/starfield-loop-desktop-poster-v1.webp" alt="" decoding="async" fetchPriority="high" draggable={false} />
            </picture>
            <video
              ref={videoRef} className={styles.starfieldVideo} data-background-video
              muted loop playsInline preload="none" disablePictureInPicture tabIndex={-1}
              onPlaying={() => setReady(true)}
              onError={() => setReady(false)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
