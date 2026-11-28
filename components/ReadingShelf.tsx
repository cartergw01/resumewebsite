"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import styles from "./ReadingShelf.module.css";

type Shelf = typeof import("@/content/reading-shelf.json");

// Each topic's book, in shelf order (the same order as SHELF in
// scripts/reading-shelf.mjs): cloth colour, height and thickness in px.
const BOOKS: [string, string, number, number][] = [
  ["Books", "#6e1f1a", 210, 46],
  ["Technology & Business", "#1f3a52", 236, 50],
  ["General", "#4d3a28", 196, 40],
  ["Culture & Politics", "#7a2b12", 222, 48],
  ["Life", "#2f4a33", 184, 38],
  ["Work & Creativity", "#3f2f5a", 214, 46],
  ["Relationships", "#7c3b46", 200, 44],
];

// Under the board, a shelf of cloth-bound books, one for each topic in the
// yearly "Best Things I Read" round-ups (content/reading-shelf.json, from
// scripts/reading-shelf.mjs). Pulling a book out lays its picks out below on
// paper, newest year first; putting it back clears them away. The picks only
// load once a reader reaches for a book, so the page doesn't carry them.
export default function ReadingShelf() {
  const [open, setOpen] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const loading = useRef<Promise<unknown> | null>(null);
  const books = useRef<Record<string, HTMLButtonElement | null>>({});
  const list = useRef<HTMLDivElement>(null);
  const reveal = useRef(false);
  const topic = shelf?.find(entry => entry.topic === open);

  const warm = () => {
    // If the picks can't load, the book goes back rather than staying out with nothing under it.
    loading.current ??= import("@/content/reading-shelf.json")
      .then(module => setShelf(module.default))
      .catch(() => { loading.current = null; setOpen(null); });
  };
  const pull = (name: string) => {
    const next = open === name ? null : name;
    setOpen(next);
    reveal.current = Boolean(next);
    if (next) warm();
  };
  // On a short screen the list opens below the fold: bring its top into view.
  useEffect(() => {
    if (!topic || !reveal.current) return;
    reveal.current = false;
    const top = list.current?.getBoundingClientRect().top;
    if (top !== undefined && top > innerHeight - 140) {
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollBy({ top: top - innerHeight * .45, behavior: smooth ? "smooth" : "auto" });
    }
  }, [topic]);
  const putBack = () => {
    const name = open;
    setOpen(null);
    if (name) books.current[name]?.focus({ preventScroll: true });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); putBack(); }
  };

  const years = topic ? [...new Set(topic.picks.map(pick => pick.year))] : [];
  return (
    <section className={styles.shelf} aria-labelledby="reading-shelf-title">
      <h2 id="reading-shelf-title" className={styles.heading}>Best things i&apos;ve read</h2>
      <div className={styles.unit}>
        <div className={styles.row} onPointerEnter={warm} onFocus={warm}>
          <span className={styles.bookend} aria-hidden="true" />
          {BOOKS.map(([name, cloth, height, width]) => (
            <button key={name} ref={element => { books.current[name] = element; }} type="button" className={styles.book}
              aria-expanded={open === name} aria-controls="reading-shelf-list" onClick={() => pull(name)}
              style={{ "--cloth": cloth, "--height": `${height}px`, "--width": `${width}px` } as CSSProperties}>
              <span>{name}</span>
            </button>
          ))}
          <span className={styles.bookend} aria-hidden="true" />
        </div>
        <div className={styles.plank} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.left}`} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.right}`} aria-hidden="true" />
      </div>
      <div ref={list} id="reading-shelf-list" onKeyDown={onKeyDown}>
        {topic ? (
          <div key={topic.topic} className={styles.sheet}>
            <button type="button" className={styles.close} aria-label={`Put ${topic.topic} back`} onClick={putBack}>×</button>
            <h3 className={styles.topic}>{topic.topic}</h3>
            {years.map(year => (
              <section key={year} aria-label={String(year)}>
                <p className={styles.year}>{year}</p>
                <ul className={styles.picks}>
                  {topic.picks.filter(pick => pick.year === year).map(pick => (
                    <li key={pick.href}>
                      <a className={styles.pick} href={pick.href} target="_blank" rel="noopener noreferrer">
                        <span className={styles.title}>{pick.title}</span>
                        <span className={styles.author}>{pick.author}</span>
                        {/* A book's line is Carter's own note about it; an essay's is a quote from it. */}
                        {topic.topic === "Books"
                          ? <span className={styles.note}>{pick.quote}</span>
                          : <q className={styles.note}>{pick.quote}</q>}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
