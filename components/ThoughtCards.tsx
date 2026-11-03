"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ARTWORK_PARALLAX_EVENT } from "@/lib/artwork-perspective";
import type { ParallaxState } from "./IslandLife";
import type { NoteOrigin } from "@/lib/use-note-stack-motion";
import styles from "./ThoughtCards.module.css";
import { useIslandCue } from "@/lib/use-island-cue";

const loadCollection = () => import("./ThoughtCollection");
const ThoughtCollection = dynamic(loadCollection, { ssr: false });
const warmCollection = () => { void loadCollection().catch(() => {}); };
const point = [447, 431] as const;
const birdPoint = [1033, 275] as const;

export default function ThoughtCards() {
  const layer = useRef<HTMLSpanElement>(null);
  const position = useRef<HTMLSpanElement>(null);
  const birdPosition = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useIslandCue(layer);
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
      for (const [ref, anchor] of [[position, point], [birdPosition, birdPoint]] as const) {
        const depth = p?.depth ? p.depth(anchor[0], anchor[1]) - p.focus : 0;
        if (ref.current) ref.current.style.transform = `translate(${-1200 * (p?.x ?? 0) * depth * scale}px, ${-800 * (p?.y ?? 0) * depth * scale}px)`;
      }
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
      (opener.current ?? button.current)?.focus({ preventScroll: true });
    }
  }, [open]);
  const close = () => {
    restoreFocus.current = true;
    setOpen(false); setInitialId(null); setOrigin(null);
    const url = new URL(location.href);
    if (url.searchParams.has("thought")) { url.searchParams.delete("thought"); history.replaceState(history.state, "", url); }
  };
  const read = (source: HTMLButtonElement) => {
    opener.current = source;
    // Both entrances lift the same notes from the desk.
    const box = button.current?.getBoundingClientRect() ?? source.getBoundingClientRect();
    setOrigin({ x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width });
    setOpen(true);
  };

  return <>
    <span ref={layer} className={styles.layer} data-thought-cues data-direct-navigation>
      <span className={styles.frame} style={{ width: 1200 * scale, height: 800 * scale }}>
        <span ref={position} className={styles.position}>
          <svg viewBox="0 0 1200 800" className={styles.art} aria-hidden="true">
            <path d="M416 441 472 446 482 426 427 422Z" fill="#291908" opacity=".4" />
            <path d="M420 437 470 442 475 425 425 421Z" fill="#b7a382" stroke="#655238" strokeWidth=".8" />
            <path d="M418 434 469 440 477 423 426 418Z" fill="#d0bc95" stroke="#867052" strokeWidth=".7" />
            <g className={styles.noteTop}>
            <path d="M421 433 472 438 478 420 427 416Z" fill="#f2deb4" stroke="#c8b088" strokeWidth=".7" />
            <path d="M427 421 470 425 M426 425 465 429 M425 429 452 432" stroke="#8b7960" strokeWidth=".7" opacity=".8" />
            <path d="M464 420 471 421 470 426 463 425Z" fill="#af664a" />
            </g>
          </svg>
          {scale > 0 && <button ref={button} className={styles.target} type="button" data-thought-cards
            style={{ left: point[0] * scale, top: point[1] * scale }} aria-label="Read some of my tweets" aria-haspopup="dialog"
            data-tip="some of my tweets" onPointerEnter={warmCollection} onPointerDown={warmCollection} onFocus={warmCollection}
            onClick={event => read(event.currentTarget)}>
            <span className={styles.dot} aria-hidden="true" /><span className={styles.hint} aria-hidden="true">some of my tweets</span>
          </button>}
        </span>
        <span ref={birdPosition} className={styles.birdPosition}>
          {scale > 0 && <button type="button" className={styles.birdTarget} data-thought-bird aria-label="some of my tweets" aria-haspopup="dialog"
            style={{ left: birdPoint[0] * scale, top: birdPoint[1] * scale, width: Math.max(44, 78 * scale), height: Math.max(44, 68 * scale) }}
            data-tip="some of my tweets" onPointerEnter={warmCollection} onPointerDown={warmCollection} onFocus={warmCollection} onClick={event => read(event.currentTarget)}>
            <svg viewBox="0 0 78 68" aria-hidden="true" className={styles.birdArt}>
              <path d="m-33 42 36 17 46-2m-33 2-9-9" fill="none" stroke="#63513c" strokeWidth="3.5" strokeLinecap="round" />
              <path d="m-32 41 36 17 44-2" fill="none" stroke="#a28c68" strokeWidth=".8" strokeLinecap="round" />
              <g className={styles.birdBody}>
                <path d="m37 47-1 10m8-10 1 11m-13-1 8 1m1 0 8 1" stroke="#b39a70" strokeWidth="1.8" strokeLinecap="round" />
                <path d="m48 36 21-10-7 15 9-2-17 13Z" fill="#3184b6" />
                <path d="M22 21c-1-8 5-14 12-14 8 0 13 5 14 13 9 4 15 12 12 20-3 10-15 14-25 10-9-3-14-13-13-22Z" fill="#55b3e0" />
                <path d="M25 31c1 12 9 20 19 20 7 0 13-3 16-8-12 5-24-1-28-14Z" fill="#298ac0" />
                <path className={styles.birdWing} d="M39 25c9-1 17 4 20 10-8 7-19 6-24-3Z" fill="#378fc4" stroke="#73c7e9" strokeWidth=".8" />
                <path d="m22 23-11 3 11 4Z" fill="#d8ae70" />
                <path d="M27 13c4-3 9-3 12-1" fill="none" stroke="#9bd8ed" strokeWidth="2" strokeLinecap="round" />
                <circle cx="28" cy="20" r="2" fill="#102a3c" /><circle cx="27.5" cy="19.5" r=".65" fill="#f1f9f7" />
              </g>
            </svg>
            <span className={styles.hint} aria-hidden="true">some of my tweets</span>
          </button>}
        </span>
      </span>
    </span>
    {open && <ThoughtCollection initialId={initialId} origin={origin} onClose={close} />}
  </>;
}
