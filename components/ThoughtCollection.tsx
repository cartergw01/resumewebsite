"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import thoughts from "@/content/thoughts.json";
import { useNoteStackMotion, type NoteOrigin } from "@/lib/use-note-stack-motion";
import { useIslandDialog } from "@/lib/use-island-dialog";
import styles from "./ThoughtCollection.module.css";

const LAST_KEY = "carter-thoughts-last-v1";
const ids = new Set(thoughts.map(thought => thought.id));
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Taipei" });
const readLast = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };
const randomThought = (except: string | null) => {
  const candidates = thoughts.filter(thought => thought.id !== except);
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)].id : thoughts[0].id;
};

export default function ThoughtCollection({ initialId, origin, onClose }: { initialId: string | null; origin: NoteOrigin | null; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() =>
    initialId && ids.has(initialId) ? initialId : randomThought(readLast())
  );
  const current = thoughts.find(thought => thought.id === selected) ?? thoughts[0];
  const index = thoughts.indexOf(current);

  // Remember only to avoid immediately repeating a post on the next opening.
  useEffect(() => {
    try { localStorage.setItem(LAST_KEY, selected); } catch { /* Reading works without storage. */ }
  }, [selected]);

  useIslandDialog(dialog, closeButton);
  const dismiss = useNoteStackMotion(dialog, stack, origin, onClose);
  const choose = (id: string) => {
    setSelected(id);
    if (scroll.current) scroll.current.scrollTop = 0;
  };

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-label="Posts by Carter" data-direct-navigation data-thought-collection
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <div className={styles.dismiss}>
      <button ref={closeButton} className={styles.close} type="button" aria-label="Close thoughts" onClick={dismiss} autoFocus>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
      </button>
    </div>
    <div ref={stack} className={styles.stack} data-note-stack>
      <span className={styles.sheet} data-note-sheet="back" aria-hidden="true" />
      <span className={styles.sheet} data-note-sheet="middle" aria-hidden="true" />
      <div className={styles.reader}>
        <header className={styles.header}>
          <a className={styles.profile} href="https://x.com/CarterKoWang" target="_blank" rel="noopener noreferrer" aria-label="Carter, verified account, @CarterKoWang on X">
            <span className={styles.avatar}><Image src="/x-profile.jpg" alt="" width={40} height={40} sizes="40px" /></span>
            <span className={styles.identity}>
              <span className={styles.name}><strong>Carter</strong><svg viewBox="0 0 22 22" width="18" height="18" className={styles.verified} aria-hidden="true"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" /></svg></span>
              <span className={styles.handle}>@CarterKoWang</span>
            </span>
          </a>
          <a className={styles.xLink} href={current.source} target="_blank" rel="noopener noreferrer" aria-label="View on X" title="View on X">
            <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 23.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932zM17.61 21.644h2.039L6.486 3.24H4.298z" /></svg>
          </a>
        </header>
        <div ref={scroll} className={styles.scroll} tabIndex={0} aria-label="Post content">
          <article key={current.id} className={styles.post} data-thought-id={current.id}>
            <div className={styles.text}>
              {current.text.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            </div>
            <footer className={styles.source}>
              <time dateTime={current.date}>{dateFormat.format(new Date(current.date))}</time>
            </footer>
          </article>
        </div>
        <footer className={styles.browse}>
          <button type="button" aria-label="Previous thought" disabled={thoughts.length < 2} onClick={() => choose(thoughts[(index - 1 + thoughts.length) % thoughts.length].id)}>Previous</button>
          <button type="button" aria-label="Shuffle thoughts" disabled={thoughts.length < 2} onClick={() => choose(randomThought(current.id))}>Shuffle</button>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{index + 1} of {thoughts.length}</span>
          <button type="button" aria-label="Next thought" disabled={thoughts.length < 2} onClick={() => choose(thoughts[(index + 1) % thoughts.length].id)}>Next</button>
        </footer>
      </div>
    </div>
  </dialog>, document.body);
}
