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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const current = thoughts.find(thought => thought.id === selected) ?? thoughts[0];
  const index = thoughts.indexOf(current);
  const shareUrl = `${location.origin}/?thought=${current.id}#writing`;

  useIslandDialog(dialog, closeButton);
  const choose = (id: string) => {
    setSelected(id); setCopyState("idle");
    if (scroll.current) scroll.current.scrollTop = 0;
    try { localStorage.setItem(LAST_KEY, id); } catch { /* Reading works without storage. */ }
  };

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="thoughts-title" data-direct-navigation data-thought-collection
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.reader}>
      <header className={styles.header}>
        <h2 id="thoughts-title">A stream of consciousness</h2>
        <button ref={closeButton} className={styles.close} type="button" aria-label="Close thoughts" onClick={onClose} autoFocus>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </header>
      <div ref={scroll} className={styles.scroll} tabIndex={0} aria-label="Post content">
        <article key={current.id} className={styles.post} data-thought-id={current.id}>
          <header className={styles.author}>
            <a className={styles.profile} href="https://x.com/carterkowang" target="_blank" rel="noopener noreferrer" aria-label="Carter Wang, @carterkowang on X">
              <span className={styles.avatar}><Image src="/x-profile.jpg" alt="" width={44} height={44} sizes="44px" /></span>
              <span className={styles.identity}><strong>Carter Wang</strong><span>@carterkowang</span></span>
            </a>
            <svg className={styles.xMark} viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l8.2-9.4L.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L6.4 3.9H4.6L17.8 20Z" /></svg>
          </header>
          <div className={styles.text}>
            {current.text.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          </div>
          <time className={styles.date} dateTime={current.date}>{dateFormat.format(new Date(current.date))}</time>
          <footer className={styles.actions}>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setCopyState("copied"); } catch { setCopyState("fallback"); } }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="m10 13 4-4m-6 6-1 1a4.24 4.24 0 0 1-6-6l4-4a4.24 4.24 0 0 1 6 0m2 2 1-1a4.24 4.24 0 0 1 6 6l-4 4a4.24 4.24 0 0 1-6 0" transform="translate(1 1)" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>{copyState === "copied" ? "Copied" : "Copy link"}
            </button>
            <a href={current.source} target="_blank" rel="noopener noreferrer">View on X</a>
          </footer>
          {copyState === "fallback" && <label className={styles.copy}>Copy this link<input aria-label="Link to this thought" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} /></label>}
          <span className="sr-only" role="status">{copyState === "copied" ? "Link copied to clipboard." : ""}</span>
        </article>
      </div>
      <footer className={styles.browse}>
        <button type="button" aria-label="Previous thought" disabled={thoughts.length < 2} onClick={() => choose(thoughts[(index - 1 + thoughts.length) % thoughts.length].id)}>Previous</button>
        <div className={styles.browseMiddle}>
          <span className={styles.count} role="status" aria-live="polite">{index + 1} of {thoughts.length}</span>
          <button type="button" disabled={thoughts.length < 2} onClick={() => choose(thoughts[(index + 1 + Math.floor(Math.random() * (thoughts.length - 1))) % thoughts.length].id)}>Shuffle</button>
        </div>
        <button type="button" aria-label="Next thought" disabled={thoughts.length < 2} onClick={() => choose(thoughts[(index + 1) % thoughts.length].id)}>Next</button>
      </footer>
    </div>
  </dialog>, document.body);
}
