"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import thoughts from "@/content/thoughts.json";
import { useIslandDialog } from "@/lib/use-island-dialog";
import styles from "./ThoughtCollection.module.css";

const LAST_KEY = "carter-thoughts-last-v1";
const ids = new Set(thoughts.map(thought => thought.id));
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Taipei" });
const readLast = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };

export default function ThoughtCollection({ initialId, onClose }: { initialId: string | null; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => {
    const id = initialId ?? readLast();
    return id && ids.has(id) ? id : thoughts[0].id;
  });
  const current = thoughts.find(thought => thought.id === selected) ?? thoughts[0];
  const index = thoughts.indexOf(current);

  useIslandDialog(dialog, closeButton);
  const choose = (id: string) => {
    setSelected(id);
    if (scroll.current) scroll.current.scrollTop = 0;
    try { localStorage.setItem(LAST_KEY, id); } catch { /* Reading works without storage. */ }
  };

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="thoughts-title" data-direct-navigation data-thought-collection
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.reader}>
      <h2 id="thoughts-title" className="sr-only">A stream of consciousness</h2>
      <header className={styles.header}>
        <a className={styles.profile} href="https://x.com/carterkowang" target="_blank" rel="noopener noreferrer" aria-label="Carter Wang, @carterkowang on X">
          <span className={styles.avatar}><Image src="/x-profile.jpg" alt="" width={44} height={44} sizes="44px" /></span>
          <span className={styles.identity}><strong>Carter Wang</strong><span>@carterkowang</span></span>
        </a>
        <button ref={closeButton} className={styles.close} type="button" aria-label="Close thoughts" onClick={onClose} autoFocus>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </header>
      <div ref={scroll} className={styles.scroll} tabIndex={0} aria-label="Post content">
        <article key={current.id} className={styles.post} data-thought-id={current.id}>
          <div className={styles.text}>
            {current.text.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          </div>
          <footer className={styles.source}>
            <time dateTime={current.date}>{dateFormat.format(new Date(current.date))}</time>
            <a href={current.source} target="_blank" rel="noopener noreferrer">View on X</a>
          </footer>
        </article>
      </div>
      <footer className={styles.browse}>
        <button type="button" aria-label="Previous thought" disabled={thoughts.length < 2} onClick={() => choose(thoughts[(index - 1 + thoughts.length) % thoughts.length].id)}>Previous</button>
        <span className={styles.count} role="status" aria-live="polite">{index + 1} of {thoughts.length}</span>
        <button type="button" aria-label="Next thought" disabled={thoughts.length < 2} onClick={() => choose(thoughts[(index + 1) % thoughts.length].id)}>Next</button>
      </footer>
    </div>
  </dialog>, document.body);
}
