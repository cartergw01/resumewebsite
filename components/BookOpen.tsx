"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useIslandDialog } from "@/lib/use-island-dialog";
import styles from "./BookOpen.module.css";

export type OpenBook = {
  title: string;
  subtitle: string;
  date: string;
  href: string;
  image: StaticImageData;
  spine: { top: string; bottom: string; accent: string };
};

type Phase = "lifting" | "held" | "open" | "leaving";

// A book taken down from the shelf: it flies from where it stood to the middle
// of the screen, then its cover swings open on the date, title and subtitle.
// The letter slot hands over a letter with the subscribe form instead.
export default function BookOpen({ book, letters, from, onClose }: { book: OpenBook | null; letters: boolean; from: DOMRect | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const thing = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("lifting");
  const [start, setStart] = useState<CSSProperties>({});
  useIslandDialog(dialog, close);

  // Measure where it rests in the middle, then start it from the shelf.
  useLayoutEffect(() => {
    const element = thing.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!element || !from || reduced) { setPhase(letters ? "held" : "open"); return; }
    const rest = element.getBoundingClientRect();
    const scale = from.width / rest.width;
    setStart({
      transform: `translate(${from.x + from.width / 2 - (rest.x + rest.width / 2)}px, ${from.y + from.height / 2 - (rest.y + rest.height / 2)}px) scale(${scale})`,
      transition: "none",
    });
    const lift = requestAnimationFrame(() => requestAnimationFrame(() => { setStart({}); setPhase("held"); }));
    return () => cancelAnimationFrame(lift);
  }, [from, letters]);
  useEffect(() => {
    if (phase !== "held" || letters) return;
    const timer = setTimeout(() => setPhase("open"), 520);
    return () => clearTimeout(timer);
  }, [phase, letters]);

  const leave = () => {
    if (phase === "leaving") return;
    setPhase("leaving");
    setTimeout(onClose, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
  };

  const cloth = book ? `rgb(${book.spine.bottom})` : undefined;
  const foil = book ? `rgb(${book.spine.accent})` : undefined;
  return (
    <dialog ref={dialog} className={styles.dialog} data-phase={phase} aria-label={book ? book.title : "Newsletter"}
      onCancel={event => { event.preventDefault(); leave(); }}
      onClick={event => { if (event.target === event.currentTarget) leave(); }}>
      <button ref={close} type="button" className={styles.close} aria-label="Put it back" onClick={leave}>×</button>
      {book ? (
        <div ref={thing} className={styles.book} style={{ "--cloth": cloth, "--foil": foil, ...start } as CSSProperties}>
          <div className={styles.page}>
            {/* On a phone the cover swings away, so its art heads the page. */}
            <div className={styles.pageArt} aria-hidden="true"><Image src={book.image} alt="" fill sizes="330px" /></div>
            <p className={styles.date}><time>{book.date}</time></p>
            <h2 className={styles.title}>{book.title}</h2>
            <p className={styles.subtitle}>{book.subtitle}</p>
            <a className={styles.read} href={book.href} target="_blank" rel="noopener noreferrer" tabIndex={phase === "open" ? 0 : -1}>
              Read on Substack <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className={styles.cover} aria-hidden="true">
            <div className={styles.front}>
              <div className={styles.plate}><Image src={book.image} alt="" fill sizes="360px" /></div>
              <span className={styles.stamp}>{book.title}</span>
            </div>
            <div className={styles.back}>
              <div className={styles.frontispiece}><Image src={book.image} alt="" fill sizes="360px" /></div>
            </div>
          </div>
        </div>
      ) : (
        <div ref={thing} className={styles.letter} style={start}>
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
