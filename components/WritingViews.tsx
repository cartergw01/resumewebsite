"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import EssayBoard from "./EssayBoard";
import heading from "./PageHeading.module.css";
import styles from "./WritingViews.module.css";

type View = "board" | "list";

// The Writing page's two ways in, like Work's "Tour the office" and "Read as a
// list". Both live in the same wooden frame, picked with two tabs on its top
// edge: the corkboard of essays, or the archive on a lined sheet of paper.
export default function WritingViews({ title, line, list }: { title: ReactNode; line: ReactNode; list: ReactNode }) {
  const [view, setView] = useState<View>("board");
  const pick = (next: View) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail) event.currentTarget.blur();
    setView(next);
  };

  return <>
    <header className={`${heading.header} ${styles.header}`} data-book-reveal>{title}{line}</header>
    <div className={styles.frame} data-view={view} data-book-reveal>
      <div className={styles.tabs} role="group" aria-label="How to read this page">
        <button type="button" aria-pressed={view === "board"} onClick={pick("board")}>Bulletin</button>
        <button type="button" aria-pressed={view === "list"} onClick={pick("list")}>Read as a list</button>
      </div>
      {view === "board" ? <EssayBoard /> : <div className={styles.paper}>{list}</div>}
    </div>
  </>;
}
