"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import EssayBoard from "./EssayBoard";
import heading from "./PageHeading.module.css";
import styles from "./WritingViews.module.css";

type View = "board" | "list";

// The Writing page's two ways in, like Work's "Tour the office" and "Read as a
// list": the bulletin board of essays, or the plain archive. One at a time.
export default function WritingViews({ title, line, list }: { title: ReactNode; line: ReactNode; list: ReactNode }) {
  const [view, setView] = useState<View>("board");
  const pick = (next: View) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail) event.currentTarget.blur();
    setView(next);
  };

  return <>
    <header className={`${heading.header} ${styles.header}`} data-book-reveal>
      <div className={styles.heading}>{title}{line}</div>
      <div className={styles.modes} role="group" aria-label="How to read this page">
        <button type="button" aria-pressed={view === "board"} onClick={pick("board")}><BoardIcon />Bulletin</button>
        <button type="button" aria-pressed={view === "list"} onClick={pick("list")}><ListIcon />Read as a list</button>
      </div>
    </header>
    {view === "board" ? <EssayBoard /> : list}
  </>;
}

function BoardIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="1.5" y="2.5" width="13" height="11" rx="1" /><circle cx="5" cy="6" r="1" fill="currentColor" /><circle cx="10.5" cy="9" r="1" fill="currentColor" />
  </svg>;
}

function ListIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 4h9M5 8h9M5 12h9M2 4h.5M2 8h.5M2 12h.5" /></svg>;
}
