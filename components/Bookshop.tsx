"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import shop from "@/lib/bookshop.json";
import { essays } from "@/content/portfolio";
import type { NoteOrigin } from "@/lib/use-note-stack-motion";
import styles from "./Bookshop.module.css";

type Collection = typeof import("./ThoughtCollection").default;
const loadCollection = () => import("./ThoughtCollection").then(module => module.default);

type Area = "essays" | "reading" | "notes" | "letters";
type Corners = number[][];
// The shop's areas in walking order, named in the page's own words.
const AREAS: { id: Area; label: string }[] = [
  { id: "essays", label: "Essays" },
  { id: "reading", label: "Reading Lists" },
  { id: "notes", label: "some of my tweets" },
  { id: "letters", label: "Newsletter" },
];
const byHref = new Map(essays.map(essay => [new URL(essay.href).pathname.split("/").filter(Boolean).pop(), essay]));
const books = {
  essays: shop.essays.map(book => ({ ...book, essay: byHref.get(book.slug)! })),
  reading: [...shop.readingLists].sort((a, b) => Number(b.year) - Number(a.year)).map(book => ({ ...book, essay: byHref.get(book.slug)! })),
};
type Book = (typeof books.essays)[number];

// A face's corners run top-left, top-right, bottom-left, bottom-right.
const outline = (c: Corners) => `M${c[0][0]} ${c[0][1]}L${c[1][0]} ${c[1][1]}L${c[3][0]} ${c[3][1]}L${c[2][0]} ${c[2][1]}Z`;

// On a phone the whole shop is framed a little closer: the building and its
// lawn, with less of the sky around it (in the render's 1200x800 frame).
const ROOM = [120, 60, 1080, 700];

// How the shop frame moves to fill itself with one area's close-up.
function zoomFor(area: Area | null, narrow: boolean) {
  if (!area && !narrow) return { x: 0, y: 0, scale: 1 };
  const [l, t, r, b] = area ? shop.closeups[area].box : ROOM;
  const scale = Math.min(1200 / (r - l), 800 / (b - t));
  const clamp = (value: number, size: number) => Math.min(0, Math.max(size - size * scale, value));
  return { x: clamp(600 - scale * (l + r) / 2, 1200), y: clamp(400 - scale * (t + b) / 2, 800), scale };
}

export default function Bookshop() {
  const stage = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [wanted, setWanted] = useState<Set<Area>>(() => new Set());
  const [sharp, setSharp] = useState<Set<Area>>(() => new Set());
  const [settled, setSettled] = useState(true);
  const [selected, setSelected] = useState<Record<"essays" | "reading", string>>({ essays: books.essays[0].slug, reading: books.reading[0].slug });
  const [hovered, setHovered] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = matchMedia("(max-width: 760px)");
    const sync = () => setNarrow(query.matches);
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const [notesOrigin, setNotesOrigin] = useState<NoteOrigin | null>(null);
  const [ThoughtCollection, setThoughtCollection] = useState<Collection | null>(null);
  const warmNotes = useCallback(() => { void loadCollection().then(loaded => setThoughtCollection(() => loaded)).catch(() => {}); }, []);
  const want = useCallback((id: Area) => setWanted(current => current.has(id) ? current : new Set(current).add(id)), []);

  const go = useCallback((next: Area | null) => {
    if (next) want(next);
    setArea(current => {
      if (current !== next) setSettled(false);
      return next;
    });
  }, [want]);

  const openNotes = useCallback(() => {
    const rect = stage.current?.querySelector<SVGPathElement>("[data-shop-notes]")?.getBoundingClientRect();
    setNotesOrigin(rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width } : null);
    warmNotes();
    setNotesOpen(true);
  }, [warmNotes]);

  const enter = (id: Area) => {
    go(id);
    if (id === "notes") openNotes();
  };

  const step = useCallback((by: 1 | -1) => {
    if (area !== "essays" && area !== "reading") return;
    const list = books[area];
    const index = list.findIndex(book => book.slug === selected[area]);
    const next = list[(index + by + list.length) % list.length];
    setSelected(current => ({ ...current, [area]: next.slug }));
  }, [area, selected]);

  // A sideways swipe on the shelf moves to the next or previous book.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swipeStart = (event: ReactPointerEvent) => {
    swipe.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY };
  };
  const swipeEnd = (event: ReactPointerEvent) => {
    const start = swipe.current; swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      step(dx < 0 ? 1 : -1);
      // The lifted finger shouldn't also choose the book it ended on.
      swiped.current = true;
      setTimeout(() => { swiped.current = false; }, 0);
    }
  };
  const swiped = useRef(false);

  // Escape steps back out to the whole shop; arrows browse the books in view.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (notesOpen || event.defaultPrevented) return;
      const inField = event.target instanceof HTMLElement && event.target.closest("input, textarea");
      if (event.key === "Escape" && area) { event.preventDefault(); go(null); return; }
      if (inField || (area !== "essays" && area !== "reading")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!stage.current?.closest("section")?.contains(document.activeElement) && document.activeElement !== document.body) return;
      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [area, go, notesOpen, step]);

  const zoom = zoomFor(area, narrow);
  const frame = {
    transform: `translate(${zoom.x / 12}%, ${zoom.y / 8}%) scale(${zoom.scale})`,
    "--zoom": zoom.scale,
  } as CSSProperties;
  const current = area === "essays" || area === "reading"
    ? books[area].find(book => book.slug === selected[area]) ?? books[area][0]
    : null;

  return (
    <section className={styles.shop} aria-label="The bookshop" data-book-reveal>
      <div ref={stage} className={styles.stage} data-area={area ?? "shop"} data-settled={settled}
        onPointerDown={swipeStart} onPointerUp={swipeEnd} onPointerCancel={() => { swipe.current = null; }}>
        <div className={styles.frame} style={frame} onTransitionEnd={event => { if (event.target === event.currentTarget) setSettled(true); }}>
          <Image src={shop.still.src} alt="A small bookshop at night: Carter's essays face out on the lit shelves, his reading lists stacked on the table, notes pinned to a corkboard, and a letter slot in the door."
            width={shop.still.width} height={shop.still.height} priority quality={86} draggable={false}
            sizes="(max-width: 760px) 100vw, min(1500px, 94vw)" className={styles.still} />
          {AREAS.map(({ id }) => {
            const closeup = shop.closeups[id];
            if (!wanted.has(id)) return null;
            const [l, t, r, b] = closeup.box;
            return <Image key={id} src={closeup.src} alt="" aria-hidden="true" width={closeup.width} height={closeup.height} quality={86} draggable={false}
              sizes="(max-width: 760px) 200vw, 150vw" className={styles.closeup} data-shown={area === id && sharp.has(id)}
              onLoad={() => setSharp(current => new Set(current).add(id))}
              style={{ left: `${l / 12}%`, top: `${t / 8}%`, width: `${(r - l) / 12}%`, height: `${(b - t) / 8}%` }} />;
          })}
          <svg className={styles.marks} viewBox="0 0 1200 800" preserveAspectRatio="none">
            {/* The whole shop: each area is one target. */}
            {!area && AREAS.map(({ id, label }) => {
              const [l, t, r, b] = shop.areas[id];
              const pad = id === "notes" || id === "letters" ? 10 : 6;
              return <rect key={id} className={styles.areaTarget} x={l - pad} y={t - pad} width={r - l + pad * 2} height={b - t + pad * 2} rx="6"
                role="button" tabIndex={0} aria-label={label} data-shop-area={id}
                onPointerEnter={() => { want(id); if (id === "notes") warmNotes(); }}
                onFocus={() => want(id)}
                onClick={() => enter(id)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); enter(id); } }} />;
            })}
            {/* Inside an area: the books themselves. */}
            {(area === "essays" || area === "reading") && books[area].map(book => (
              <path key={book.slug} d={outline(book.corners)} className={styles.book}
                data-selected={book.slug === current?.slug} data-hovered={hovered === book.slug}
                role="button" tabIndex={0} aria-label={book.title} aria-pressed={book.slug === current?.slug}
                onPointerEnter={() => setHovered(book.slug)} onPointerLeave={() => setHovered(null)}
                onFocus={() => { if (!("pointerInput" in document.documentElement.dataset)) setSelected(s => ({ ...s, [area]: book.slug })); }}
                onClick={() => { if (!swiped.current) setSelected(s => ({ ...s, [area]: book.slug })); }}
                onKeyDown={event => { if (event.key === "Enter") window.open(book.essay.href, "_blank", "noopener,noreferrer"); }} />
            ))}
            <path d={outline(shop.notes)} className={styles.book} data-shop-notes data-active={area === "notes"}
              role="button" tabIndex={area === "notes" ? 0 : -1} aria-label="Read some of my tweets" aria-haspopup="dialog"
              onClick={openNotes} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openNotes(); } }} />
            {/* The slot itself leads to the form under the shop. */}
            <path d={outline(shop.slot)} className={styles.book} data-active={area === "letters"} aria-hidden="true"
              onClick={() => document.getElementById("bookshop-email")?.focus({ preventScroll: false })} />
          </svg>
          {!area && AREAS.map(({ id, label }) => {
            const [l, t, r] = shop.areas[id];
            return <span key={id} className={styles.label} aria-hidden="true" data-for={id}
              style={{ left: `${(l + r) / 24}%`, top: `${Math.max(t - 14, 16) / 8}%` }}>{label}</span>;
          })}
        </div>
      </div>

      <div className={styles.panel}>
        <nav className={styles.areas} aria-label="Bookshop areas">
          <button type="button" className={styles.areaButton} aria-pressed={!area} onClick={() => go(null)}>Whole shop</button>
          {AREAS.map(({ id, label }) => (
            <button key={id} type="button" className={styles.areaButton} aria-pressed={area === id}
              onPointerEnter={() => { want(id); if (id === "notes") warmNotes(); }} onFocus={() => want(id)}
              onClick={() => enter(id)}>{label}</button>
          ))}
        </nav>
        <div className={styles.card} aria-live="polite">
          {current ? <BookCard book={current} /> : null}
          {area === "notes" ? <p className={styles.cardLine}><button type="button" className={styles.read} onClick={openNotes}>Read some of my tweets</button></p> : null}
          {area === "letters" ? <Letters /> : null}
        </div>
      </div>
      {notesOpen && ThoughtCollection && <ThoughtCollection initialId={null} origin={notesOrigin} onClose={() => setNotesOpen(false)} />}
    </section>
  );
}

function BookCard({ book }: { book: Book }) {
  const { essay } = book;
  return <article className={styles.bookCard}>
    <p className={styles.meta}><time>{essay.date}</time></p>
    <h2 className={styles.title}>{essay.title}</h2>
    <p className={styles.subtitle}>{essay.subtitle}</p>
    <a className={styles.read} href={essay.href} target="_blank" rel="noopener noreferrer">Read on Substack <span aria-hidden="true">↗</span></a>
  </article>;
}

// The slot in the door: the same hand-off to Substack as the subscribe card.
function Letters() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    window.open(`https://carterko.substack.com/subscribe?email=${encodeURIComponent(trimmed)}`, "_blank", "noopener,noreferrer");
    setSent(true);
  };
  return <form className={styles.letters} onSubmit={submit}>
    <p className={styles.subtitle}>Subscribe to keep up to date on new essays.</p>
    <div className={styles.field}>
      <label className="sr-only" htmlFor="bookshop-email">Email address</label>
      <input id="bookshop-email" type="email" required placeholder="your@email.com" value={email} autoComplete="email" inputMode="email"
        onChange={event => { setEmail(event.target.value); setSent(false); }} />
      <button type="submit" className={styles.read}>Subscribe</button>
    </div>
    {sent ? <p className={styles.meta} role="status">
      <a href={`https://carterko.substack.com/subscribe?email=${encodeURIComponent(email.trim())}`} data-native-navigation>Continue on Substack</a> to finish subscribing.
    </p> : null}
  </form>;
}
