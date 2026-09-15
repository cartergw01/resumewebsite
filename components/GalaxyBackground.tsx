"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./IslandHome.module.css";

// Sparse foreground stars move independently from the more distant galaxy.
const stars = [
  [7, 17, 1, 11], [16, 70, 1, 14], [24, 9, 1.5, 9], [32, 34, 1, 13],
  [43, 15, 1, 12], [52, 77, 1.5, 15], [61, 8, 1, 10], [69, 48, 1, 16],
  [77, 17, 2, 13], [88, 37, 1, 11], [94, 68, 1.5, 14], [36, 88, 1, 12],
  [12, 43, 1, 16], [57, 41, 1, 14], [82, 83, 1, 10], [92, 10, 1, 15],
];

export default function GalaxyBackground() {
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <>
      <div className={styles.galaxySpace} data-galaxy-background data-ambient-paused={paused || hidden} aria-hidden="true">
        <div className={styles.galaxy} data-galaxy-camera>
          <picture className={styles.galaxyImage} data-galaxy-image>
            <source media="(max-aspect-ratio: 1/1)" srcSet="/galaxy-alive-mobile-small-v1.webp 640w, /galaxy-alive-mobile-v1.webp 941w" sizes="116vw" />
            {/* Native picture selection keeps the mobile crop from also loading the desktop asset. */}
            <img src="/galaxy-alive-desktop-v1.webp" srcSet="/galaxy-alive-desktop-small-v1.webp 1280w, /galaxy-alive-desktop-v1.webp 1672w" sizes="116vw" alt="" decoding="async" fetchPriority="high" draggable={false} />
          </picture>
        </div>
        <div className={styles.stars}>
          {stars.map(([x, y, size, duration], index) => (
            <span
              key={index} className={styles.ambientStar} data-ambient-star
              style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, "--glimmer-duration": `${duration}s`, "--glimmer-delay": `${-index * 1.7}s` } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <button
        type="button" className={styles.galaxyToggle} aria-label={`${paused ? "Play" : "Pause"} galaxy animation`}
        title={`${paused ? "Play" : "Pause"} galaxy animation`} onClick={() => setPaused(!paused)}
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {paused ? <path d="m7 4 9 6-9 6V4Z" fill="currentColor" /> : <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
        </svg>
      </button>
    </>
  );
}
