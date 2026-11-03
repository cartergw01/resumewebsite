"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ARTWORK_PARALLAX_EVENT } from "@/lib/artwork-perspective";
import type { ParallaxState } from "./IslandLife";
import type { NoteOrigin } from "@/lib/use-note-stack-motion";
import styles from "./ThoughtCards.module.css";

const loadCollection = () => import("./ThoughtCollection");
const ThoughtCollection = dynamic(loadCollection, { ssr: false });
const warmCollection = () => { void loadCollection().catch(() => {}); };
const point = [447, 431] as const;

export default function ThoughtCards() {
  const layer = useRef<HTMLSpanElement>(null);
  const position = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [scale, setScale] = useState(0);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<NoteOrigin | null>(null);
  const [initialId, setInitialId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URL(location.href).searchParams.get("thought");
    if (id && /^\d{19}$/.test(id)) { setInitialId(id); setOpen(true); }
  }, []);
  useEffect(() => {
    const visual = layer.current?.closest<HTMLElement>("[data-island-visual]") as (HTMLElement & { parallax?: ParallaxState }) | null;
    if (!visual) return;
    const resize = () => setScale(Math.min(visual.clientWidth / 1200, visual.clientHeight / 800));
    const move = () => {
      const p = visual.parallax;
      const depth = p?.depth ? p.depth(...point) - p.focus : 0;
      if (position.current) position.current.style.transform = `translate(${-1200 * (p?.x ?? 0) * depth * scale}px, ${-800 * (p?.y ?? 0) * depth * scale}px)`;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(visual);
    visual.addEventListener(ARTWORK_PARALLAX_EVENT, move);
    resize(); move();
    return () => { observer.disconnect(); visual.removeEventListener(ARTWORK_PARALLAX_EVENT, move); };
  }, [scale]);
  useLayoutEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      button.current?.focus({ preventScroll: true });
    }
  }, [open]);
  const close = () => {
    restoreFocus.current = true;
    setOpen(false); setInitialId(null); setOrigin(null);
    const url = new URL(location.href);
    if (url.searchParams.has("thought")) { url.searchParams.delete("thought"); history.replaceState(history.state, "", url); }
  };

  return <>
    <span ref={layer} className={styles.layer} data-direct-navigation>
      <span className={styles.frame} style={{ width: 1200 * scale, height: 800 * scale }}>
        <span ref={position} className={styles.position}>
          <svg viewBox="0 0 1200 800" className={styles.art} aria-hidden="true">
            <path d="M416 441 472 446 482 426 427 422Z" fill="#291908" opacity=".4" />
            <path d="M420 437 470 442 475 425 425 421Z" fill="#b7a382" stroke="#655238" strokeWidth=".8" />
            <path d="M418 434 469 440 477 423 426 418Z" fill="#d0bc95" stroke="#867052" strokeWidth=".7" />
            <path d="M421 433 472 438 478 420 427 416Z" fill="#f2deb4" stroke="#c8b088" strokeWidth=".7" />
            <path d="M427 421 470 425 M426 425 465 429 M425 429 452 432" stroke="#8b7960" strokeWidth=".7" opacity=".8" />
            <path d="M464 420 471 421 470 426 463 425Z" fill="#af664a" />
          </svg>
          {scale > 0 && <button ref={button} className={styles.target} type="button" data-thought-cards
            style={{ left: point[0] * scale, top: point[1] * scale }} aria-label="Read Carter's thoughts" aria-haspopup="dialog"
            data-tip="A stream of consciousness" onPointerEnter={warmCollection} onPointerDown={warmCollection} onFocus={warmCollection}
            onClick={event => {
              const box = event.currentTarget.getBoundingClientRect();
              setOrigin({ x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width });
              setOpen(true);
            }}>
            <span className={styles.dot} aria-hidden="true" /><span className={styles.hint} aria-hidden="true">A stream of consciousness</span>
          </button>}
        </span>
      </span>
    </span>
    {open && <ThoughtCollection initialId={initialId} origin={origin} onClose={close} />}
  </>;
}
