"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import shop from "@/lib/bookshop.json";
import { essays } from "@/content/portfolio";
import openings from "@/content/essay-openings.json";
import type { NoteOrigin } from "@/lib/use-note-stack-motion";
import BookOpen, { type OpenBook } from "./BookOpen";
import styles from "./Bookshop.module.css";

type Collection = typeof import("./ThoughtCollection").default;
const loadCollection = () => import("./ThoughtCollection").then(module => module.default);

// The furniture in front moves this much faster than the wall as you walk.
const NEAR = 1.22;
// Each pixel scrolled walks you this many pixels along the shop.
const STRIDE = 2;
type Rect = number[];
type Item = {
  key: string;
  kind: "essay" | "reading" | "letters" | "notes";
  label: string;
  rect: Rect;
  layer: string | null;
  sprite: string | null;
  book?: OpenBook;
};

const byHref = new Map(essays.map(essay => [new URL(essay.href).pathname.split("/").filter(Boolean).pop(), essay]));
const bookFor = (slug: string): OpenBook => {
  const essay = byHref.get(slug)!;
  return {
    slug, title: essay.title, subtitle: essay.subtitle, date: essay.date, href: essay.href, image: essay.image, spine: essay.spine,
    opening: (openings as Record<string, string>)[slug] ?? "",
  };
};
// Everything you can reach, in the order you pass it.
const ITEMS: Item[] = [
  { key: "letters", kind: "letters" as const, label: "Newsletter", rect: shop.letters, layer: null, sprite: null },
  ...shop.essays.map(book => ({ key: book.slug, kind: "essay" as const, label: book.title, rect: book.rect, layer: book.layer, sprite: book.sprite, book: bookFor(book.slug) })),
  ...shop.readingLists.map(book => ({ key: book.slug, kind: "reading" as const, label: book.title, rect: book.rect, layer: book.layer, sprite: book.sprite, book: bookFor(book.slug) })),
  { key: "notes", kind: "notes" as const, label: "some of my tweets", rect: shop.notes, layer: null, sprite: null },
].sort((a, b) => (a.rect[0] + a.rect[2]) - (b.rect[0] + b.rect[2]));
const middle = (rect: Rect) => (rect[0] + rect[2]) / 2;
const PIECES = Object.entries(shop.pieces);
// The books you can take down, in shelf order, for turning from one to the next.
const BOOKS = ITEMS.filter(item => item.book);

export default function Bookshop() {
  const section = useRef<HTMLElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const pieces = useRef<Map<string, HTMLDivElement>>(new Map());
  const marker = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [current, setCurrent] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ item: Item; from: DOMRect | null } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesOrigin, setNotesOrigin] = useState<NoteOrigin | null>(null);
  const [ThoughtCollection, setThoughtCollection] = useState<Collection | null>(null);
  const [moved, setMoved] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [touch, setTouch] = useState(false);

  // The shop is drawn at the view's height; walking it is scrolling past it.
  const scale = size.height / shop.height;
  const walk = Math.max(0, shop.width * scale - size.width);
  useLayoutEffect(() => {
    const element = view.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);

  // How far along the shop you are, in screen pixels (0 at the door).
  const travelled = useCallback(() => {
    const element = section.current, sticky = view.current?.parentElement;
    if (!element || !sticky) return 0;
    const top = parseFloat(getComputedStyle(sticky).top) || 0;
    return Math.min(walk, Math.max(0, (top - element.getBoundingClientRect().top) * STRIDE));
  }, [walk]);

  // Every frame you move: slide the wall, slide the furniture a little faster,
  // and pick out whatever is in front of you.
  useEffect(() => {
    if (!scale) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const d = travelled();
      const centre = size.width / 2 + d; // the middle of the view, along the shop
      if (wall.current) wall.current.style.transform = `translate3d(${-d}px, 0, 0)`;
      for (const [name, piece] of PIECES) {
        const element = pieces.current.get(name);
        if (!element) continue;
        const [l, , r] = piece.rect;
        const x = NEAR * ((l + r) / 2 * scale - centre) + size.width / 2 - (r - l) * scale / 2;
        element.style.transform = `translate3d(${x - l * scale}px, 0, 0)`;
      }
      if (marker.current) marker.current.style.left = `${(walk ? d / walk : 0) * 100}%`;
      if (d > 8) setMoved(true);
      let best: Item | null = null, distance = size.height * .32;
      for (const item of ITEMS) {
        const gap = Math.abs(middle(item.rect) * scale - centre);
        if (gap < distance) { distance = gap; best = item; }
      }
      setCurrent(best?.key ?? null);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", request); window.removeEventListener("resize", request); };
  }, [scale, size, travelled, walk]);

  // Scrolls the page so that an item stands in the middle of the view.
  const walkTo = useCallback((item: Item, smooth = true) => {
    const element = section.current, sticky = view.current?.parentElement;
    if (!element || !sticky) return;
    const top = parseFloat(getComputedStyle(sticky).top) || 0;
    const d = Math.min(walk, Math.max(0, middle(item.rect) * scale - size.width / 2));
    const y = window.scrollY + element.getBoundingClientRect().top - top + d / STRIDE;
    window.scrollTo({ top: y, behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  }, [scale, size.width, walk]);

  const open = useCallback((item: Item, target?: Element | null) => {
    if (item.kind === "notes") {
      const rect = target?.getBoundingClientRect();
      setNotesOrigin(rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width } : null);
      void loadCollection().then(loaded => { setThoughtCollection(() => loaded); setNotesOpen(true); }).catch(() => {});
      return;
    }
    const sprite = target?.closest("[data-shop-item]")?.querySelector("img") ?? target;
    setOpened({ item, from: sprite?.getBoundingClientRect() ?? null });
  }, []);
  // Putting a book back leaves you standing in front of the last one you read.
  const putBack = useCallback((last: number) => {
    const wasBook = opened?.item.book;
    setOpened(null);
    if (wasBook && BOOKS[last]) requestAnimationFrame(() => walkTo(BOOKS[last], false));
  }, [opened, walkTo]);

  // When the shop first comes into view, it takes a small step along, so you
  // can see that it moves; a hint says how until you've walked.
  useEffect(() => {
    setTouch(matchMedia("(pointer: coarse)").matches);
    // Watch the shop's own view: the section is as tall as the whole walk, so
    // it never shows enough of itself to count.
    const element = view.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      if (travelled() < 8) setNudge(true);
    }, { threshold: .6 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [travelled]);

  // A sideways swipe on a trackpad, or dragging the shop, walks you too.
  useEffect(() => {
    const element = view.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      // Instant: the site's smooth scrolling would lag behind the gesture.
      window.scrollBy({ top: event.deltaX * (event.deltaMode === 1 ? 16 : 1) / STRIDE, behavior: "instant" });
    };
    let drag: { x: number; y: number; last: number; on: boolean; id: number } | null = null;
    let dragged = false;
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, last: event.clientX, on: false, id: event.pointerId };
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        drag.on = true; element.dataset.dragging = "";
      }
      window.scrollBy({ top: -(event.clientX - drag.last) / STRIDE, behavior: "instant" });
      drag.last = event.clientX;
    };
    const up = () => {
      if (drag?.on) { dragged = true; setTimeout(() => { dragged = false; }, 0); }
      drag = null; delete element.dataset.dragging;
    };
    // A drag shouldn't also take down the book it ends on.
    const click = (event: MouseEvent) => { if (dragged) { event.preventDefault(); event.stopPropagation(); } };
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    element.addEventListener("click", click, true);
    return () => {
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      element.removeEventListener("click", click, true);
    };
  }, []);

  // Arrows step to the next thing on the shelf, Enter takes it down.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (opened || notesOpen || event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const rect = section.current?.getBoundingClientRect();
      if (!rect || rect.bottom < innerHeight * .5 || rect.top > innerHeight * .5) return;
      const index = ITEMS.findIndex(item => item.key === current);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const centre = size.width / 2 + travelled();
        const ahead = event.key === "ArrowRight"
          ? ITEMS.find(item => middle(item.rect) * scale > centre + 4)
          : [...ITEMS].reverse().find(item => middle(item.rect) * scale < centre - 4);
        if (ahead) walkTo(ahead);
      } else if (event.key === "Enter" && index >= 0 && !target?.closest("button, a")) {
        event.preventDefault();
        open(ITEMS[index], document.querySelector(`[data-shop-item="${ITEMS[index].key}"] button`));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, notesOpen, open, opened, scale, size.width, travelled, walkTo]);

  const place = (rect: Rect, origin = 0): CSSProperties => ({
    left: (rect[0] - origin) * scale, top: rect[1] * scale,
    width: (rect[2] - rect[0]) * scale, height: (rect[3] - rect[1]) * scale,
  });
  const reach = (item: Item, origin = 0) => (
    <div key={item.key} className={styles.item} style={place(item.rect, origin)} data-shop-item={item.key} data-kind={item.kind} data-current={current === item.key}>
      {item.sprite ? <Image src={item.sprite} alt="" aria-hidden="true" unoptimized draggable={false} fill sizes="200px" className={styles.sprite} /> : null}
      <button type="button" className={styles.reach} aria-label={item.book ? `${item.label}, ${item.book.date}` : item.label}
        aria-haspopup="dialog"
        onFocus={() => { if (!("pointerInput" in document.documentElement.dataset)) walkTo(item); }}
        onClick={event => open(item, event.currentTarget)} />
    </div>
  );
  const here = ITEMS.find(item => item.key === current) ?? null;
  const years = useMemo(() => shop.bays.map(bay => ({ ...bay, at: walk ? Math.min(1, Math.max(0, ((bay.x0 + bay.x1) / 2 * scale - size.width / 2) / walk)) : 0 })), [scale, size.width, walk]);

  return (
    <section ref={section} className={styles.walk} aria-label="The bookshop" style={{ "--walk": `${walk / STRIDE}px` } as CSSProperties} data-book-reveal>
      <div className={styles.sticky}>
        <a href="#writing-archive" className={styles.skip}>Skip to the list</a>
        <div ref={view} className={styles.view}>
          <div className={styles.stroll} data-nudge={nudge && !moved}>
          {scale > 0 && <>
            <div ref={wall} className={styles.wall} style={{ width: shop.width * scale, height: shop.height * scale }}>
              {shop.tiles.map((tile, index) => (
                <Image key={tile.src} src={tile.src} alt={index === 0 ? "Inside a small bookshop at night, seen straight on: the door, then a bay of shelves for each year with Carter's essays face out, and a corkboard of notes by the window at the end." : ""}
                  width={tile.width} height={shop.height} unoptimized draggable={false} priority={index < 2} loading="eager"
                  className={styles.tile} style={{ left: tile.x * scale, width: tile.width * scale + 1 }} />
              ))}
              {ITEMS.filter(item => !item.layer).map(item => reach(item))}
            </div>
            {PIECES.map(([name, piece]) => (
              <div key={name} ref={element => { if (element) pieces.current.set(name, element); else pieces.current.delete(name); }}
                className={styles.piece} style={place(piece.rect)}>
                {/* A soft shadow where it stands on the floor. */}
                <span className={styles.shadow} aria-hidden="true"
                  style={{ top: (piece.foot - piece.rect[1]) * scale, height: (piece.rect[2] - piece.rect[0]) * scale * .16 }} />
                <Image src={piece.src} alt="" aria-hidden="true" unoptimized fill sizes="400px" draggable={false} className={styles.pieceArt} />
                {ITEMS.filter(item => item.layer === name).map(item => reach(item, piece.rect[0]))}
              </div>
            ))}
          </>}
          </div>
          <div className={styles.lamp} aria-hidden="true" />
          <p className={styles.hint} data-shown={scale > 0 && !moved} aria-hidden="true">
            {touch ? "Swipe to walk" : "Scroll to walk"} <span>→</span>
          </p>
        </div>
        <div className={styles.caption}>
          <div className={styles.ruler} aria-hidden="true">
            {years.map(year => <span key={year.year} className={styles.year} style={{ left: `${year.at * 100}%` }}>{year.year}</span>)}
            <span ref={marker} className={styles.marker} />
          </div>
          <div className={styles.here} aria-live="polite">
            {here ? <>
              {here.book ? <span className={styles.date}>{here.book.date}</span> : null}
              <span className={styles.title}>{here.label}</span>
              <button type="button" className={styles.open} onClick={() => open(here, document.querySelector(`[data-shop-item="${here.key}"] button`))}>
                {here.kind === "notes" ? "Read" : "Open"}
              </button>
            </> : null}
          </div>
        </div>
      </div>
      {opened ? <BookOpen books={BOOKS.map(item => item.book!)} start={Math.max(0, BOOKS.indexOf(opened.item))} letters={opened.item.kind === "letters"}
        from={opened.from} onClose={putBack} /> : null}
      {notesOpen && ThoughtCollection ? <ThoughtCollection initialId={null} origin={notesOrigin} onClose={() => setNotesOpen(false)} /> : null}
    </section>
  );
}
