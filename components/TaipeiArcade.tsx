"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIslandDialog } from "@/lib/use-island-dialog";
import styles from "./TaipeiArcade.module.css";

export default function TaipeiArcade({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"loading" | "slow" | "loaded">("loading");
  useIslandDialog(dialog, closeButton);
  useEffect(() => {
    const timer = window.setTimeout(() => setPhase(value => value === "loading" ? "slow" : value), 12_000);
    return () => clearTimeout(timer);
  }, [attempt]);
  const retry = () => { setPhase("loading"); setAttempt(value => value + 1); };

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="arcade-title" data-arcade data-direct-navigation
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.cabinet}>
      <header className={styles.marquee}>
        <h2 id="arcade-title">Taipei <span>Run</span></h2>
        <button ref={closeButton} type="button" className={styles.close} onClick={onClose} aria-label="Close arcade" title="Close" autoFocus>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
        </button>
      </header>
      <div className={styles.bezel}>
        <div className={styles.screen}>
          <iframe key={attempt} src="https://taipeirun.com/" title="Taipei Run game" allow="autoplay; fullscreen; gamepad" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-orientation-lock allow-presentation allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => setPhase("loaded")} onError={() => setPhase("slow")} />
          {phase !== "loaded" && <div className={styles.loading}>
            <span className={styles.power} aria-hidden="true" />
            <p role="status">{phase === "slow" ? "Still loading." : "Loading…"}</p>
            {phase === "slow" && <div className={styles.recovery}><button type="button" onClick={retry}>Retry</button><a href="https://taipeirun.com/" target="_blank" rel="noopener noreferrer">Open game</a></div>}
          </div>}
        </div>
      </div>
      <footer className={styles.deck}>
        <span className={styles.speaker} aria-hidden="true" />
        <div className={styles.controls}>
          <button type="button" className={styles.restart} onClick={retry} aria-label="Reload game" title="Restart">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M19 7a8 8 0 1 0 1 8M19 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <a href="https://taipeirun.com/" target="_blank" rel="noopener noreferrer" className={styles.open} aria-label="Open Taipei Run in a new tab" title="Open game">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        </div>
        <span className={styles.speaker} aria-hidden="true" />
      </footer>
    </div>
  </dialog>, document.body);
}
