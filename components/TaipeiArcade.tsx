"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIslandDialog } from "@/lib/use-island-dialog";
import styles from "./TaipeiArcade.module.css";

export default function TaipeiArcade({ onClose }: { onClose: () => void }) {
  const backButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"loading" | "slow" | "loaded">("loading");
  useIslandDialog(dialog, backButton);
  useEffect(() => {
    const timer = window.setTimeout(() => setPhase(value => value === "loading" ? "slow" : value), 12_000);
    return () => clearTimeout(timer);
  }, [attempt]);
  const retry = () => { setPhase("loading"); setAttempt(value => value + 1); };

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="arcade-title" data-arcade data-direct-navigation
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className={styles.header}>
      <button ref={backButton} type="button" className={styles.back} onClick={onClose} autoFocus>← <span>Back to workshop</span></button>
      <h2 id="arcade-title">Taipei Run<span>Arcade session</span></h2>
      <div className={styles.tools}>
        <button type="button" onClick={retry} aria-label="Reload game" title="Reload game">↻</button>
        <a href="https://taipeirun.com/" target="_blank" rel="noopener noreferrer" aria-label="Open Taipei Run in a new tab" title="Open full game">↗</a>
      </div>
    </header>
    <div className={styles.screen}>
      <iframe key={attempt} src="https://taipeirun.com/" title="Taipei Run game" allow="autoplay; fullscreen; gamepad" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-orientation-lock allow-presentation allow-popups allow-popups-to-escape-sandbox"
        onLoad={() => setPhase("loaded")} onError={() => setPhase("slow")} />
      {phase !== "loaded" && <div className={styles.loading} role="status">
        <span className={styles.coin} aria-hidden="true">玩</span>
        <p>{phase === "slow" ? "The arcade is taking a little longer." : "Starting the arcade…"}</p>
        <span>{phase === "slow" ? "Try again, or open the full game in a new tab." : "Next stop, Taipei."}</span>
        {phase === "slow" && <div><button type="button" onClick={retry}>Try again</button><a href="https://taipeirun.com/" target="_blank" rel="noopener noreferrer">Open full game ↗</a></div>}
      </div>}
    </div>
  </dialog>, document.body);
}
