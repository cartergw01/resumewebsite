"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ARTWORK_PARALLAX_EVENT } from "@/lib/artwork-perspective";
import type { ParallaxState } from "./IslandLife";
import type { NoteOrigin } from "@/lib/use-note-stack-motion";
import styles from "./ThoughtCards.module.css";
import { useIslandCue } from "@/lib/use-island-cue";
import { createBirdFlight, FOLDED_WING, wingPath } from "@/lib/bird-flight";

type Collection = typeof import("./ThoughtCollection").default;
// Rendered directly once loaded: going through lazy/Suspense would hold the first
// opening back by React's 300ms reveal throttle, even with the code already here.
const loadCollection = () => import("./ThoughtCollection").then(module => module.default);
const point = [447, 431] as const;
const birdPoint = [1033, 275] as const;
const birdFeet = [40, 58] as const; // in the bird's 78x68 art
const birdRestingWing = wingPath(FOLDED_WING);

export default function ThoughtCards() {
  const layer = useRef<HTMLSpanElement>(null);
  const position = useRef<HTMLSpanElement>(null);
  const birdPosition = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useIslandCue(layer);
  const restoreFocus = useRef(false);
  const flyer = useRef<SVGSVGElement>(null);
  const nearWing = useRef<SVGPathElement>(null);
  const farWing = useRef<SVGPathElement>(null);
  const legs = useRef<SVGPathElement>(null);
  const birdButton = useRef<HTMLButtonElement>(null);
  const flight = useRef<ReturnType<typeof createBirdFlight> | null>(null);
  const birdOut = useRef(false);
  const birdHeading = useRef(false);
  const returnTimer = useRef(0);
  const [scale, setScale] = useState(0);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<NoteOrigin | null>(null);
  const [initialId, setInitialId] = useState<string | null>(null);
  const [ThoughtCollection, setThoughtCollection] = useState<Collection | null>(null);
  const warmCollection = useCallback(() => {
    void loadCollection().then(loaded => setThoughtCollection(() => loaded)).catch(() => {});
  }, []);
  useEffect(() => { if (open) warmCollection(); }, [open, warmCollection]);

  // Focus rings are for people moving by keyboard. Reading by touch or mouse also
  // moves focus (into the reader and back to its opener), and that shouldn't draw one.
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => { root.dataset.pointerInput = ""; };
    const key = (event: KeyboardEvent) => { if (event.key === "Tab") delete root.dataset.pointerInput; };
    window.addEventListener("pointerdown", pointer, { capture: true, passive: true });
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", key, true);
      delete root.dataset.pointerInput;
    };
  }, []);
  useEffect(() => () => { clearTimeout(returnTimer.current); flight.current?.dispose(); }, []);
  useEffect(() => {
    const id = new URL(location.href).searchParams.get("thought");
    if (id && /^\d{19}$/.test(id)) {
      // Nobody has touched the page yet, but the reader opening by itself isn't
      // keyboard use: no ring on the close button until a Tab says otherwise.
      document.documentElement.dataset.pointerInput = "";
      setInitialId(id);
      setOpen(true);
    }
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
    // Back to the branch once the reader has cleared the view.
    if (birdOut.current) returnTimer.current = window.setTimeout(birdHome, 120);
  };
  const birdHome = () => {
    birdOut.current = false;
    flight.current?.fly({ x: 0, y: 0 }, () => { if (!birdOut.current) delete birdButton.current?.dataset.flying; });
  };
  const read = (source: HTMLButtonElement) => {
    opener.current = source;
    // Both entrances lift the same notes from the desk.
    const box = button.current?.getBoundingClientRect() ?? source.getBoundingClientRect();
    setOrigin({ x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width });
    setOpen(true);
  };

  // The bird carries the visitor to the notes: it flies down to the pile, and the
  // pile lifts into the reader as it lands.
  const flyToNotes = (source: HTMLButtonElement) => {
    if (birdHeading.current) return;
    const parts = { flyer: flyer.current, nearWing: nearWing.current, farWing: farWing.current, legs: legs.current };
    const notes = button.current?.getBoundingClientRect();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !notes || !parts.flyer || !parts.nearWing || !parts.farWing || !parts.legs) { read(source); return; }
    clearTimeout(returnTimer.current);
    flight.current ??= createBirdFlight(parts as Parameters<typeof createBirdFlight>[0]);
    const perch = source.getBoundingClientRect();
    source.dataset.flying = "";
    birdHeading.current = true;
    birdOut.current = true;
    flight.current.fly({
      x: notes.x + notes.width / 2 - (perch.x + perch.width * birdFeet[0] / 78),
      y: notes.y + notes.height / 2 - (perch.y + perch.height * birdFeet[1] / 68),
    }, () => {
      birdHeading.current = false;
      // If the visitor moved on mid-flight, the bird just goes home.
      if (layer.current?.closest<HTMLElement>("[data-island-scene]")?.dataset.active === "true") read(source);
      else birdHome();
    });
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
          {scale > 0 && <button ref={birdButton} type="button" className={styles.birdTarget} data-thought-bird aria-label="some of my tweets" aria-haspopup="dialog"
            style={{ left: birdPoint[0] * scale, top: birdPoint[1] * scale, width: Math.max(44, 78 * scale), height: Math.max(44, 68 * scale) }}
            data-tip="some of my tweets" data-tip-side="e" onPointerEnter={warmCollection} onPointerDown={warmCollection} onFocus={warmCollection} onClick={event => flyToNotes(event.currentTarget)}>
            <svg viewBox="0 0 78 68" aria-hidden="true" className={styles.birdArt}>
              <path d="m-33 42 36 17 46-2m-33 2-9-9" fill="none" stroke="#63513c" strokeWidth="3.5" strokeLinecap="round" />
              <path d="m-32 41 36 17 44-2" fill="none" stroke="#a28c68" strokeWidth=".8" strokeLinecap="round" />
            </svg>
            <svg ref={flyer} viewBox="0 0 78 68" aria-hidden="true" className={`${styles.birdArt} ${styles.birdFlyer}`} data-bird-flyer>
              <g className={styles.birdBody}>
                <path ref={legs} d="m37 47-1 10m8-10 1 11m-13-1 8 1m1 0 8 1" stroke="#b39a70" strokeWidth="1.8" strokeLinecap="round" />
                <path ref={farWing} className={styles.birdFarWing} d={birdRestingWing} fill="#2a78a8" />
                <path d="m48 36 21-10-7 15 9-2-17 13Z" fill="#3184b6" />
                <path d="M22 21c-1-8 5-14 12-14 8 0 13 5 14 13 9 4 15 12 12 20-3 10-15 14-25 10-9-3-14-13-13-22Z" fill="#55b3e0" />
                <path d="M25 31c1 12 9 20 19 20 7 0 13-3 16-8-12 5-24-1-28-14Z" fill="#298ac0" />
                <path ref={nearWing} className={styles.birdWing} d={birdRestingWing} fill="#378fc4" stroke="#73c7e9" strokeWidth=".8" />
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
    {open && ThoughtCollection && <ThoughtCollection initialId={initialId} origin={origin} onClose={close} />}
  </>;
}
