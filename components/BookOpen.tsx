"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useIslandDialog } from "@/lib/use-island-dialog";
import styles from "./BookOpen.module.css";

export type OpenBook = {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  href: string;
  image: StaticImageData;
  spine: { top: string; bottom: string; accent: string };
  opening: string;
};

type Phase = "lifting" | "held" | "open" | "leaving";

// A book taken down from the shelf: it flies from where it stood to the middle
// of the screen and its cover swings open on how the essay begins. The arrows
// (or the arrow keys, or a swipe) turn to the next book on the shelf without
// putting this one back. The letter slot hands over a letter with the
// subscribe form instead.
export default function BookOpen({ books, start, letters, from, onClose }: {
  books: OpenBook[];
  start: number;
  letters: boolean;
  from: DOMRect | null;
  onClose: (last: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const thing = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("lifting");
  const [flight, setFlight] = useState<CSSProperties>({});
  const [index, setIndex] = useState(start);
  const [turn, setTurn] = useState<"next" | "prev" | null>(null);
  useIslandDialog(dialog, close);
  const book = letters ? null : books[index] ?? null;

  // Measure where it rests in the middle, then start it from the shelf.
  useLayoutEffect(() => {
    const element = thing.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!element || !from || reduced) { setPhase(letters ? "held" : "open"); return; }
    const rest = element.getBoundingClientRect();
    setFlight({
      transform: `translate(${from.x + from.width / 2 - (rest.x + rest.width / 2)}px, ${from.y + from.height / 2 - (rest.y + rest.height / 2)}px) scale(${from.width / rest.width})`,
      transition: "none",
    });
    const lift = requestAnimationFrame(() => requestAnimationFrame(() => { setFlight({}); setPhase("held"); }));
    return () => cancelAnimationFrame(lift);
  }, [from, letters]);
  useEffect(() => {
    if (phase !== "held" || letters) return;
    const timer = setTimeout(() => setPhase("open"), 520);
    return () => clearTimeout(timer);
  }, [phase, letters]);

  const leave = useCallback(() => {
    if (phase === "leaving") return;
    setPhase("leaving");
    setTimeout(() => onClose(index), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
  }, [index, onClose, phase]);
  const go = useCallback((by: 1 | -1) => {
    if (letters || phase !== "open") return;
    const next = index + by;
    if (next < 0 || next >= books.length) return;
    setTurn(by > 0 ? "next" : "prev");
    setIndex(next);
  }, [books.length, index, letters, phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // A sideways swipe turns the page.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const down = (event: ReactPointerEvent) => { swipe.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY }; };
  const up = (event: ReactPointerEvent) => {
    const from = swipe.current; swipe.current = null;
    if (!from) return;
    const dx = event.clientX - from.x, dy = event.clientY - from.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
      // A swipe that ends off the book isn't a tap outside it.
      swiped.current = true;
      setTimeout(() => { swiped.current = false; }, 0);
    }
  };
  const swiped = useRef(false);

  const cloth = book ? `rgb(${book.spine.bottom})` : undefined;
  const foil = book ? `rgb(${book.spine.accent})` : undefined;
  return (
    <dialog ref={dialog} className={styles.dialog} data-phase={phase} aria-label={book ? book.title : "Newsletter"}
      onCancel={event => { event.preventDefault(); leave(); }}
      onClick={event => { if (event.target === event.currentTarget && !swiped.current) leave(); }}
      onPointerDown={down} onPointerUp={up} onPointerCancel={() => { swipe.current = null; }}>
      <button ref={close} type="button" className={styles.close} aria-label="Put it back" onClick={leave}>×</button>
      {book ? <>
        <div ref={thing} className={styles.book} style={{ "--cloth": cloth, "--foil": foil, ...flight } as CSSProperties}>
          <div className={styles.page}>
            <div key={book.slug} className={styles.leaf} data-turn={turn ?? undefined}>
              {/* On a phone the cover swings away, so its art heads the page. */}
              <div className={styles.pageArt} aria-hidden="true"><Image src={book.image} alt="" fill sizes="330px" /></div>
              <p className={styles.date}><time>{book.date}</time></p>
              <h2 className={styles.title}>{book.title}</h2>
              <p className={styles.subtitle}>{book.subtitle}</p>
              {book.opening ? (
                <div className={styles.opening}>
                  {book.opening.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>)}
                </div>
              ) : <div className={styles.opening} />}
              <a className={styles.read} href={book.href} target="_blank" rel="noopener noreferrer" tabIndex={phase === "open" ? 0 : -1}>
                Keep reading on Substack <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <div className={styles.cover} aria-hidden="true">
            <div className={styles.front}>
              <div className={styles.plate}><Image src={book.image} alt="" fill sizes="360px" /></div>
              <span className={styles.stamp}>{book.title}</span>
            </div>
            <div className={styles.back}>
              <div key={book.slug} className={styles.frontispiece} data-turn={turn ?? undefined}><Image src={book.image} alt="" fill sizes="360px" /></div>
            </div>
          </div>
        </div>
        <div className={styles.turns} data-shown={phase === "open"}>
          <button type="button" className={styles.turn} aria-label="Previous book" disabled={index === 0} onClick={() => go(-1)}>←</button>
          <span className={styles.count} aria-live="polite">{index + 1} / {books.length}</span>
          <button type="button" className={styles.turn} aria-label="Next book" disabled={index === books.length - 1} onClick={() => go(1)}>→</button>
        </div>
      </> : (
        <div ref={thing} className={styles.letter} style={flight}>
          <Letters />
        </div>
      )}
    </dialog>
  );
}

// What came through the letter slot: the same hand-off to Substack as the
// subscribe card further down the page.
function Letters() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const url = `https://carterko.substack.com/subscribe?email=${encodeURIComponent(email.trim())}`;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setSent(true);
  };
  return <form className={styles.form} onSubmit={submit}>
    <p className={styles.name}>flying Arrows</p>
    <p className={styles.subtitle}>essays on tech, culture, and human nature.</p>
    <p className={styles.subtitle}>Subscribe to keep up to date on new essays.</p>
    <div className={styles.field}>
      <label className="sr-only" htmlFor="bookshop-email">Email address</label>
      <input id="bookshop-email" type="email" required placeholder="your@email.com" value={email} autoComplete="email" inputMode="email"
        onChange={event => { setEmail(event.target.value); setSent(false); }} />
      <button type="submit" className={styles.read}>Subscribe</button>
    </div>
    {sent ? <p className={styles.date} role="status"><a href={url} data-native-navigation>Continue on Substack</a> to finish subscribing.</p> : null}
  </form>;
}
