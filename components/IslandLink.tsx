"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import styles from "./IslandHome.module.css";
import { beginBookEntry, beginWorkshopEntry, bookOpened } from "@/lib/workshop-entry";
import { beginWorkEntry, prepareWorkEntry, WORK_PUSH_EASING, workPushScale } from "@/lib/work-entry";
import { ENTRY_APPROACH_DURATION, ENTRY_LIFT_DELAY, entryPace } from "@/lib/island-entry-motion";
import { beginEntryLight, cancelEntryLight, type EntryWorld } from "@/lib/entry-light";
import { tipSide } from "@/lib/island-overview";
import type { IslandLandmark } from "@/lib/island-artwork";

function landmarkApproach(visual: HTMLElement, link: HTMLElement, focus: IslandLandmark, city = false) {
  const art = link.closest<HTMLElement>("[data-scene-art]")!;
  const image = visual.querySelector("img");
  const width = visual.offsetWidth;
  const height = visual.offsetHeight;
  // An island still loading falls back to its declared (or box) proportions.
  const imageWidth = image?.naturalWidth || Number(image?.getAttribute("width")) || width;
  const imageHeight = image?.naturalHeight || Number(image?.getAttribute("height")) || height;
  const fit = Math.min(width / imageWidth, height / imageHeight);
  const focusX = (width - imageWidth * fit) / 2 + imageWidth * fit * focus.x;
  const focusY = (height - imageHeight * fit) / 2 + imageHeight * fit * focus.y;

  // Map the viewport center into the island's local coordinates. Accounting
  // for the parent's bank/scale also makes a mid-flight click land correctly.
  const style = getComputedStyle(art);
  const [originX, originY] = style.transformOrigin.split(" ").map(Number.parseFloat);
  const matrix = new DOMMatrix().translate(originX, originY)
    .multiply(new DOMMatrix(style.transform === "none" ? undefined : style.transform))
    .translate(-originX, -originY);
  const corners = [[0, 0], [art.offsetWidth, 0], [0, art.offsetHeight], [art.offsetWidth, art.offsetHeight]]
    .map(([x, y]) => matrix.transformPoint(new DOMPoint(x, y)));
  const bounds = art.getBoundingClientRect();
  const left = bounds.left - Math.min(...corners.map((point) => point.x));
  const top = bounds.top - Math.min(...corners.map((point) => point.y));
  const center = matrix.inverse().transformPoint(new DOMPoint(innerWidth / 2 - left, innerHeight / 2 - top));
  const x = center.x - link.offsetLeft - visual.offsetLeft - focusX;
  const y = center.y - link.offsetTop - visual.offsetTop - focusY;
  const parentScale = Math.hypot(matrix.a, matrix.b);
  const scale = (city ? workPushScale(imageWidth * fit * parentScale, imageHeight * fit * parentScale)
    : Math.max(4.8, innerWidth / (imageWidth * fit) * 1.7, innerHeight / (imageHeight * fit) * 1.7)) / parentScale;
  return { x, y, scale, origin: `${focusX}px ${focusY}px`, name: focus.name };
}

const prepareSharp = (link: HTMLElement) => {
  const visual = link.querySelector<HTMLElement>("[data-island-visual]");
  if (visual) prepareWorkEntry(visual);
};

export default function IslandLink({ href, title, prompt, landmark, children, workshop = false, book = false, overview = false }: { href: string; title: string; prompt: string; landmark: IslandLandmark; children: ReactNode; workshop?: boolean; book?: boolean; overview?: boolean }) {
  const router = useRouter();
  const cleanupRef = useRef<(() => void) | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const enter = (event: MouseEvent<HTMLAnchorElement>) => {
    // Keep native new-tab, context-menu, reduced-motion and magnified navigation.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || (window.visualViewport?.scale ?? 1) > 1.01) return;

    const link = event.currentTarget;
    const stage = link.closest<HTMLElement>("[data-island-stage]");
    const visual = link.querySelector<HTMLElement>("[data-island-visual]");
    if (!stage || !visual) return;
    event.preventDefault();
    if (stage.dataset.entering) return;

    router.prefetch(href);
    const city = title === "Work";
    const { x, y, scale, origin, name } = landmarkApproach(visual, link, landmark, city);
    const initial = getComputedStyle(visual);
    const initialTransform = initial.transform;
    const initialOrigin = initial.transformOrigin;
    // The landmark's place on screen, where the island answers the click.
    const [focusX, focusY] = origin.split(" ").map(Number.parseFloat);
    const box = visual.getBoundingClientRect();
    const landmarkPoint = { x: box.left + focusX * box.width / visual.offsetWidth, y: box.top + focusY * box.height / visual.offsetHeight };
    visual.dataset.entryLandmark = name;
    link.dataset.entering = "true";
    stage.style.setProperty("--entry-approach-duration", `${ENTRY_APPROACH_DURATION}ms`);
    stage.dataset.entering = title.toLowerCase();
    document.documentElement.dataset.islandEntering = title.toLowerCase();
    stage.setAttribute("aria-busy", "true");
    beginEntryLight(title.toLowerCase() as EntryWorld, landmarkPoint, document.documentElement.dataset.cityTime === "day");

    // One continuous move: the curve dips back a touch as the island
    // answers, then glides in and slows into the landmark, never stopping
    // in between (a separate "breath" keyframe made the camera hesitate).
    const from = { transform: initialTransform === "none" ? "scale(1)" : initialTransform, transformOrigin: initialOrigin };
    const to = { transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`, transformOrigin: origin };
    // Writing holds the island still while its notebook lifts off the desk,
    // then the camera moves in behind the night closing over it.
    const zoom = visual.animate(book ? [
      { ...from, offset: 0 },
      { ...from, offset: .5, easing: "cubic-bezier(0.5, 0, 0.2, 1)" },
      { ...to, offset: 1 },
    ] : [from, to], { duration: ENTRY_APPROACH_DURATION, easing: book ? "linear" : city ? WORK_PUSH_EASING : "cubic-bezier(0.5, -0.06, 0.2, 1)", fill: "forwards" });
    // Work's tower spells its name, and the letters fly into its page in step
    // with this move; the book and workshop open theirs.
    const workEntry = city ? beginWorkEntry(visual, zoom) : null;

    let arrivalFrame = 0;
    let recoveryTimer = 0;
    let screenTimer = 0;
    let handedOff = false;
    let cancelScreen: (() => void) | null = workEntry?.dispose ?? null;
    let cancelled = false;
    const pace = entryPace();
    if (workshop || book) {
      screenTimer = window.setTimeout(() => {
        const screen = visual.querySelector<SVGGraphicsElement>("[data-workshop-screen]");
        if (!cancelled && screen) cancelScreen = beginWorkshopEntry(screen);
        const spread = visual.querySelector<SVGGraphicsElement>("[data-book-spread]");
        if (!cancelled && spread) cancelScreen = beginBookEntry(spread);
      }, ENTRY_LIFT_DELAY / pace);
    }
    const reset = () => {
      cancelled = true;
      if (!handedOff) cancelEntryLight();
      delete document.documentElement.dataset.islandEntering;
      window.removeEventListener("pointerdown", hurry, true);
      window.removeEventListener("keydown", hurryKey, true);
      cancelAnimationFrame(hurryFrame);
      // Once handed off, the pace carries on through the destination's reveal.
      if (!handedOff) cancelAnimationFrame(paceFrame);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", interrupted);
      window.removeEventListener("touchstart", pinchEntry);
      window.visualViewport?.removeEventListener("resize", zoomEntry);
      window.removeEventListener("popstate", interrupted);
      motion.removeEventListener("change", skipMotion);
      zoom.cancel();
      cancelAnimationFrame(arrivalFrame);
      clearTimeout(recoveryTimer);
      clearTimeout(screenTimer);
      if (!handedOff) cancelScreen?.();
      delete stage.dataset.entering;
      stage.style.removeProperty("--entry-approach-duration");
      delete visual.dataset.entryLandmark;
      delete link.dataset.entering;
      stage.removeAttribute("aria-busy");
      cleanupRef.current = null;
      if (!handedOff) stage.dispatchEvent(new Event("island-entry-cancel", { bubbles: true }));
      window.dispatchEvent(new Event("scroll"));
    };
    cleanupRef.current = reset;
    // Escape backs out of the approach and restores the island.
    function escape(event: KeyboardEvent) { if (event.key === "Escape" && !handedOff) reset(); }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function skipMotion() {
      if (!motion.matches || handedOff) return;
      reset();
      router.push(href);
    }
    function interrupted() { if (!handedOff) reset(); else cancelScreen?.(); }
    // A pinch takes over from the cinematic approach without leaving its cover.
    function pinchEntry(event: TouchEvent) { if (event.touches.length > 1 && !handedOff) reset(); }
    function zoomEntry() { if ((window.visualViewport?.scale ?? 1) > 1.01 && !handedOff) reset(); }
    // Impatient? Another tap, click, Enter or Space plays the rest of the
    // journey at four times the speed, including animations it starts later.
    let hurryFrame = 0;
    function hurry() {
      if (cancelled || hurryFrame) return;
      const until = performance.now() + 2500;
      const speed = () => {
        for (const animation of document.getAnimations()) if (animation.playState === "running" && animation.playbackRate < 4) animation.playbackRate = 4;
        hurryFrame = performance.now() < until ? requestAnimationFrame(speed) : 0;
      };
      speed();
    }
    function hurryKey(event: KeyboardEvent) { if (event.key === "Enter" || event.key === " ") hurry(); }
    // Listen from the next frame, so the press that started the journey
    // is not counted as a second one.
    requestAnimationFrame(() => {
      if (cancelled) return;
      window.addEventListener("pointerdown", hurry, true);
      window.addEventListener("keydown", hurryKey, true);
    });
    // Phones keep the whole journey at their faster pace (entryPace), through
    // the destination's reveal, unless a tap has hurried it further.
    let paceFrame = 0;
    if (pace > 1) {
      const began = performance.now();
      const keepPace = () => {
        for (const animation of document.getAnimations()) if (animation.playState === "running" && animation.playbackRate < pace) animation.playbackRate = pace;
        const flags = document.documentElement.dataset;
        const journeying = !handedOff || flags.islandEntering || flags.bookTransition || flags.workshopTransition || flags.workTransition;
        paceFrame = (handedOff || !cancelled) && journeying && performance.now() - began < 8000 ? requestAnimationFrame(keepPace) : 0;
      };
      keepPace();
    }
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", interrupted);
    window.addEventListener("touchstart", pinchEntry, { passive: true });
    window.visualViewport?.addEventListener("resize", zoomEntry);
    window.addEventListener("popstate", interrupted);
    motion.addEventListener("change", skipMotion);
    // Recover the homepage if a destination fails to mount, allowing a retry.
    recoveryTimer = window.setTimeout(() => { cancelScreen?.(); reset(); }, 8_000);
    void zoom.finished.then(() => book ? bookOpened() : undefined).then(() => {
      if (cancelled) return;
      arrivalFrame = requestAnimationFrame(() => {
        if (!cancelled) { handedOff = true; router.push(href); }
      });
    }).catch(() => { /* Unmounting cancels the animation. */ });
  };

  return (
    <Link
      href={href}
      className={overview ? styles.overviewIsland : styles.islandLink}
      data-island-link
      data-overview-island={overview ? title.toLowerCase() : undefined}
      draggable={false}
      data-workshop={workshop || undefined}
      data-world={title.toLowerCase()}
      data-tip={prompt}
      data-tip-side={tipSide[title.toLowerCase() as keyof typeof tipSide]}
      aria-label={`${title}, ${prompt}`}
      onPointerEnter={event => { if (title === "Work") prepareSharp(event.currentTarget); }}
      onFocus={event => { if (title === "Work") prepareSharp(event.currentTarget); }}
      onPointerDown={event => {
        if (title === "Work") prepareSharp(event.currentTarget);
        if (event.pointerType !== "touch" || !event.isPrimary || event.currentTarget.closest<HTMLElement>("[data-island-stage]")?.dataset.entering) return;
        touch.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.dataset.touchPressed = "true";
      }}
      onPointerMove={event => {
        if (touch.current && Math.hypot(event.clientX - touch.current.x, event.clientY - touch.current.y) > 7) {
          touch.current = null;
          delete event.currentTarget.dataset.touchPressed;
        }
      }}
      onPointerUp={event => { touch.current = null; delete event.currentTarget.dataset.touchPressed; }}
      onPointerCancel={event => { touch.current = null; delete event.currentTarget.dataset.touchPressed; }}
      onPointerLeave={event => { touch.current = null; delete event.currentTarget.dataset.touchPressed; }}
      onClick={enter}
    >
      {children}
      {overview && <span className={styles.overviewLabel} data-reads="cue-opacity:opacity:.8">{title}</span>}
    </Link>
  );
}
