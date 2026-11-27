"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import { ownEssays } from "@/content/portfolio";
import openings from "@/content/essay-openings.json";
import { useIslandDialog } from "@/lib/use-island-dialog";
import type { NoteOrigin } from "@/lib/use-note-stack-motion";
import styles from "./EssayBoard.module.css";

type Essay = (typeof ownEssays)[number];
const slugOf = (essay: Essay) => new URL(essay.href).pathname.split("/").filter(Boolean).pop()!;
const openingOf = (essay: Essay) => (openings as Record<string, string>)[slugOf(essay)] ?? "";
// Newest first, so the latest essay is the first thing pinned up.
const ESSAYS = [...ownEssays].sort((a, b) => Date.parse(`${b.date} UTC`) - Date.parse(`${a.date} UTC`));
// Each card hangs a little crooked, the same way every visit.
const TILTS = [-2.2, 1.4, -.8, 2, -1.6, 1, -2.4, 1.7];
const PINS = ["#b8412f", "#c9a14a", "#3f6f8f", "#b8412f", "#c9a14a", "#4c7a52"];
const position = (essay: Essay) => (essay as Essay & { imagePosition?: string }).imagePosition ?? "50% 50%";

// The Writing page's essays, pinned to a corkboard. Clicking one lifts it off
// the board into a reading sheet: its cover, date, title and subtitle, how it
// begins, and the way on to Substack.
export default function EssayBoard() {
  const [open, setOpen] = useState<{ index: number; from: DOMRect | null } | null>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback((last: number) => {
    setOpen(null);
    // Back on the board, focus rests on the essay you were last reading.
    requestAnimationFrame(() => cards.current[last]?.focus({ preventScroll: true }));
  }, []);

  return (
    <section className={styles.board} aria-label="Essays">
      <div className={styles.cork}>
        <ol className={styles.row}>
          {ESSAYS.map((essay, index) => (
            <li key={essay.href} className={styles.slot} style={{ "--tilt": `${TILTS[index % TILTS.length]}deg` } as CSSProperties}>
              <button ref={element => { cards.current[index] = element; }} type="button" className={styles.card} aria-haspopup="dialog"
                aria-label={`${essay.title}, ${essay.date}`}
                onClick={event => setOpen({ index, from: event.currentTarget.getBoundingClientRect() })}>
                <span className={styles.pin} style={{ "--pin": PINS[index % PINS.length] } as CSSProperties} aria-hidden="true" />
                <span className={styles.cover}>
                  <Image src={essay.image} alt="" fill sizes="(max-width: 700px) 45vw, 280px" style={{ objectPosition: position(essay) }} />
                </span>
                <span className={styles.date}>{essay.date}</span>
                <span className={styles.title}>{essay.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <TweetPad />
      </div>
      {open ? <ReadingSheet start={open.index} from={open.from} onClose={close} /> : null}
    </section>
  );
}

type Reader = typeof import("./ThoughtCollection").default;

// In the board's corner, a pad of sticky notes with the tweets on it. Opening
// it brings up the same tweet reader as the Writing island.
function TweetPad() {
  const button = useRef<HTMLButtonElement>(null);
  const [Reader, setReader] = useState<Reader | null>(null);
  const [origin, setOrigin] = useState<NoteOrigin | null>(null);
  const returning = useRef(false);
  // Closing the reader puts focus back on the pad, before the dialog
  // hands it anywhere else (Safari never focused the button on the tap).
  useLayoutEffect(() => {
    if (!origin && returning.current) { returning.current = false; button.current?.focus({ preventScroll: true }); }
  }, [origin]);
  const warm = useCallback(() => {
    if (!Reader) void import("./ThoughtCollection").then(module => setReader(() => module.default)).catch(() => {});
  }, [Reader]);

  return <>
    <button ref={button} type="button" className={styles.pad} aria-haspopup="dialog" data-open={origin ? "" : undefined}
      onPointerEnter={warm} onFocus={warm}
      onClick={event => {
        const box = event.currentTarget.getBoundingClientRect();
        warm();
        setOrigin({ x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width });
      }}>
      <span className={styles.note} aria-hidden="true" />
      <span className={styles.note} aria-hidden="true" />
      <span className={styles.note} aria-hidden="true" />
      <span className={styles.pin} style={{ "--pin": "#b8412f" } as CSSProperties} aria-hidden="true" />
      <span className={styles.padLabel}>some of my tweets</span>
    </button>
    {origin && Reader ? <Reader initialId={null} origin={origin} onClose={() => { returning.current = true; setOrigin(null); }} /> : null}
  </>;
}

type Phase = "lifting" | "open" | "leaving";

function ReadingSheet({ start, from, onClose }: { start: number; from: DOMRect | null; onClose: (last: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [turn, setTurn] = useState<"next" | "prev" | null>(null);
  const [phase, setPhase] = useState<Phase>("lifting");
  const [lift, setLift] = useState<CSSProperties>({});
  useIslandDialog(dialog, closeButton);
  const essay = ESSAYS[index];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The card lifts off the board and grows into the sheet.
  useLayoutEffect(() => {
    const element = sheet.current;
    if (!element || !from || reduced()) { setPhase("open"); return; }
    const rest = element.getBoundingClientRect();
    setLift({
      transform: `translate(${from.x + from.width / 2 - (rest.x + rest.width / 2)}px, ${from.y + from.height / 2 - (rest.y + rest.height / 2)}px) scale(${from.width / rest.width})`,
      opacity: .6,
      transition: "none",
    });
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => { setLift({}); setPhase("open"); }));
    return () => cancelAnimationFrame(frame);
  }, [from]);

  const leave = useCallback(() => {
    if (phase === "leaving") return;
    setPhase("leaving");
    setTimeout(() => onClose(index), reduced() ? 0 : 200);
  }, [index, onClose, phase]);
  const go = useCallback((by: 1 | -1) => {
    const next = index + by;
    if (next < 0 || next >= ESSAYS.length) return;
    setTurn(by > 0 ? "next" : "prev");
    setIndex(next);
    page.current?.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // A sideways swipe turns to the next or previous essay. Touch events, not
  // pointer events: iOS Safari cancels the pointer once a swipe starts moving.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const down = (event: ReactTouchEvent) => {
    const touch = event.touches[0];
    swipe.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const up = (event: ReactTouchEvent) => {
    const start = swipe.current; swipe.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
      swiped.current = true;
      setTimeout(() => { swiped.current = false; }, 0);
    }
  };

  const prev = ESSAYS[index - 1], next = ESSAYS[index + 1];
  return (
    <dialog ref={dialog} className={styles.dialog} data-phase={phase} aria-label={essay.title}
      onCancel={event => { event.preventDefault(); leave(); }}
      onClick={event => {
        const target = event.target as HTMLElement;
        if (!swiped.current && (target === event.currentTarget || target.hasAttribute("data-sheet-stage"))) leave();
      }}
      onTouchStart={down} onTouchEnd={up}>
      <div className={styles.stage} data-sheet-stage>
        <p className={styles.count} aria-live="polite">{index + 1} of {ESSAYS.length}</p>
        <button ref={closeButton} type="button" className={styles.close} aria-label="Back to the board" onClick={leave}>×</button>
        <button type="button" className={`${styles.turn} ${styles.prev}`} disabled={!prev} onClick={() => go(-1)}
          aria-label={prev ? `Previous essay, ${prev.title}` : "Previous essay"}>
          <Chevron path="m15 18-6-6 6-6" />
          {prev ? <span className={styles.turnTitle} aria-hidden="true">{prev.title}</span> : null}
        </button>
        <article ref={sheet} className={styles.sheet} style={lift}>
          <span className={styles.pin} style={{ "--pin": PINS[index % PINS.length] } as CSSProperties} aria-hidden="true" />
          <div ref={page} className={styles.page}>
            <div key={essay.href} className={styles.leaf} data-turn={turn ?? undefined}>
              <div className={styles.hero}>
                <Image src={essay.image} alt="" fill sizes="(max-width: 760px) 100vw, 720px" style={{ objectPosition: position(essay) }} />
              </div>
              <div className={styles.body}>
                <p className={styles.sheetDate}><time>{essay.date}</time></p>
                <h2 className={styles.sheetTitle}>{essay.title}</h2>
                <p className={styles.subtitle}>{essay.subtitle}</p>
                {openingOf(essay) ? (
                  <div className={styles.opening}>
                    {openingOf(essay).split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>)}
                  </div>
                ) : null}
                <div className={styles.actions}>
                  <a className={styles.read} href={essay.href} target="_blank" rel="noopener noreferrer">
                    Keep reading on Substack <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </article>
        <button type="button" className={`${styles.turn} ${styles.next}`} disabled={!next} onClick={() => go(1)}
          aria-label={next ? `Next essay, ${next.title}` : "Next essay"}>
          <Chevron path="m9 18 6-6-6-6" />
          {next ? <span className={styles.turnTitle} aria-hidden="true">{next.title}</span> : null}
        </button>
      </div>
    </dialog>
  );
}

const Chevron = ({ path }: { path: string }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
    <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
