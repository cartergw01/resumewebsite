"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import styles from "./IslandHome.module.css";
import { beginBookEntry, beginWorkshopEntry } from "@/lib/workshop-entry";
import { beginWorkEntry } from "@/lib/work-entry";
import { ENTRY_APPROACH_DURATION, ENTRY_LIFT_DELAY } from "@/lib/island-entry-motion";
import { tipSide } from "@/lib/island-overview";
import type { IslandLandmark } from "@/lib/island-artwork";

export function landmarkArrow(title: string, focus: IslandLandmark) {
  const x = focus.x * 1200, y = focus.y * 800;
  const [start, first, last] = title === "Work"
    ? [[250, 665], [560, 755], [x + 140, y + 150]]
    : title === "Writing"
      ? [[945, 25], [855, -35], [x + 160, y - 160]]
      : [[880, 735], [1140, 660], [x + 240, y + 100]];
  const angle = Math.atan2(y - last[1], x - last[0]);
  const wing = (side: number) => `${x - 13 * Math.cos(angle) + side * 6 * Math.sin(angle)} ${y - 13 * Math.sin(angle) - side * 6 * Math.cos(angle)}`;
  return `M${start.join(" ")}C${first.join(" ")} ${last.join(" ")} ${x} ${y}M${wing(1)}L${x} ${y}L${wing(-1)}`;
}

function landmarkApproach(visual: HTMLElement, link: HTMLElement, focus: IslandLandmark) {
  if (visual.dataset.orbitLandmark) focus = { ...focus, ...JSON.parse(visual.dataset.orbitLandmark) };
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
  const scale = Math.max(4.8, innerWidth / (imageWidth * fit) * 1.7, innerHeight / (imageHeight * fit) * 1.7) / parentScale;
  return { x, y, scale, origin: `${focusX}px ${focusY}px`, name: focus.name };
}

export default function IslandLink({ href, title, prompt, landmark, children, workshop = false, book = false, overview = false }: { href: string; title: string; prompt: string; landmark: IslandLandmark; children: ReactNode; workshop?: boolean; book?: boolean; overview?: boolean }) {
  const router = useRouter();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const enter = (event: MouseEvent<HTMLAnchorElement>) => {
    // Keep native new-tab, context-menu, and reduced-motion navigation.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const link = event.currentTarget;
    const stage = link.closest<HTMLElement>("[data-island-stage]");
    const visual = link.querySelector<HTMLElement>("[data-island-visual]");
    if (!stage || !visual) return;
    event.preventDefault();
    if (stage.dataset.entering) return;

    router.prefetch(href);
    const city = title === "Work";
    const { x, y, scale, origin, name } = landmarkApproach(visual, link, landmark);
    const initial = getComputedStyle(visual);
    const initialTransform = initial.transform;
    const initialOrigin = initial.transformOrigin;
    visual.dataset.entryLandmark = name;
    link.dataset.entering = "true";
    stage.style.setProperty("--entry-approach-duration", `${ENTRY_APPROACH_DURATION}ms`);
    stage.dataset.entering = title.toLowerCase();
    stage.setAttribute("aria-busy", "true");

    const entryWindow = city ? visual.querySelector<SVGGraphicsElement>("[data-city-entry-window]") : null;
    const workEntry = entryWindow ? beginWorkEntry(entryWindow, visual) : null;
    // Work borrows its real camera; the book and workshop keep their approach.
    const zoom = workEntry?.animation ?? visual.animate([
      { transform: initialTransform === "none" ? "scale(1)" : initialTransform, transformOrigin: initialOrigin, offset: 0, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
      { transform: `translate3d(${x * 0.16}px, ${y * 0.16}px, 0) scale(${city ? 1.12 : 1.32})`, transformOrigin: origin, offset: 0.28, easing: "cubic-bezier(0.42, 0, 0.76, 0.5)" },
      { transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`, transformOrigin: origin, offset: 1 },
    ], { duration: ENTRY_APPROACH_DURATION, fill: "forwards" });

    let arrivalFrame = 0;
    let recoveryTimer = 0;
    let screenTimer = 0;
    let handedOff = false;
    let cancelScreen: (() => void) | null = workEntry?.dispose ?? null;
    let cancelled = false;
    if (workshop || book) {
      screenTimer = window.setTimeout(() => {
        const screen = visual.querySelector<SVGGraphicsElement>("[data-workshop-screen]");
        if (!cancelled && screen) cancelScreen = beginWorkshopEntry(screen);
        const spread = visual.querySelector<SVGGraphicsElement>("[data-book-spread]");
        if (!cancelled && spread) cancelScreen = beginBookEntry(spread);
      }, ENTRY_LIFT_DELAY);
    }
    const reset = () => {
      cancelled = true;
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", interrupted);
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
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", interrupted);
    window.addEventListener("popstate", interrupted);
    motion.addEventListener("change", skipMotion);
    // Recover the homepage if a destination fails to mount, allowing a retry.
    recoveryTimer = window.setTimeout(() => { cancelScreen?.(); reset(); }, 8_000);
    void zoom.finished.then(() => {
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
      aria-label={`${prompt}. Enter ${title} island`}
      onClick={enter}
    >
      {children}
      {overview ? <span className={styles.overviewLabel}>{title}</span> : <span className={`${styles.landmarkCue} ${workshop ? styles.workshopCue : book ? styles.bookCue : styles.cityCue}`} data-island-cue>
        <span>{prompt}</span>
        <svg viewBox="0 0 1200 800" fill="none" aria-hidden="true">
          <path d={landmarkArrow(title, landmark)} stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>}
    </Link>
  );
}
