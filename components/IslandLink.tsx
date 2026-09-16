"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import styles from "./IslandHome.module.css";

const landmarks: Record<string, { x: number; y: number; name: string }> = {
  Work: { x: 0.588, y: 0.278, name: "Taipei tower" },
  Writing: { x: 0.52, y: 0.43, name: "open book" },
  Projects: { x: 0.705, y: 0.345, name: "workshop laptop" },
};

function landmarkApproach(visual: HTMLElement, link: HTMLElement, title: string) {
  const art = link.closest<HTMLElement>("[data-scene-art]")!;
  const image = visual.querySelector("img")!;
  const focus = landmarks[title] ?? { x: 0.5, y: 0.5, name: title };
  const width = visual.offsetWidth;
  const height = visual.offsetHeight;
  const imageWidth = image.naturalWidth || Number(image.getAttribute("width"));
  const imageHeight = image.naturalHeight || Number(image.getAttribute("height"));
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

export default function IslandLink({ href, title, prompt, children, workshop = false }: { href: string; title: string; prompt: string; children: ReactNode; workshop?: boolean }) {
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
    const { x, y, scale, origin, name } = landmarkApproach(visual, link, title);
    const initial = getComputedStyle(visual);
    const initialTransform = initial.transform;
    const initialOrigin = initial.transformOrigin;
    visual.dataset.entryLandmark = name;
    stage.dataset.entering = title.toLowerCase();
    stage.setAttribute("aria-busy", "true");

    // Find the landmark first, then accelerate toward it with the rocket.
    const zoom = visual.animate([
      { transform: initialTransform === "none" ? "scale(1)" : initialTransform, transformOrigin: initialOrigin, offset: 0, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
      { transform: `translate3d(${x * 0.16}px, ${y * 0.16}px, 0) scale(1.32)`, transformOrigin: origin, offset: 0.28, easing: "cubic-bezier(0.42, 0, 0.76, 0.5)" },
      { transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`, transformOrigin: origin, offset: 1 },
    ], { duration: 1000, fill: "forwards" });

    let arrivalFrame = 0;
    let recoveryTimer = 0;
    let cancelled = false;
    const reset = () => {
      cancelled = true;
      zoom.cancel();
      cancelAnimationFrame(arrivalFrame);
      clearTimeout(recoveryTimer);
      delete stage.dataset.entering;
      delete visual.dataset.entryLandmark;
      stage.removeAttribute("aria-busy");
      cleanupRef.current = null;
      window.dispatchEvent(new Event("scroll"));
    };
    cleanupRef.current = reset;
    // Recover the homepage if a destination fails to mount, allowing a retry.
    recoveryTimer = window.setTimeout(reset, 8_000);
    void zoom.finished.then(() => {
      if (cancelled) return;
      arrivalFrame = requestAnimationFrame(() => {
        if (!cancelled) router.push(href);
      });
    }).catch(() => { /* Unmounting cancels the animation. */ });
  };

  return (
    <Link
      href={href}
      className={styles.islandLink}
      data-island-link
      data-workshop={workshop || undefined}
      aria-label={`${prompt}. Enter ${title} island`}
      onClick={enter}
    >
      {children}
      <span className={workshop ? styles.workshopCue : styles.islandCue}>
        <span>{prompt}</span>
        <svg viewBox={workshop ? "0 0 1200 800" : "0 0 100 80"} fill="none" aria-hidden="true">
          <path d={workshop ? "M915 735C1190 700 1200 340 718 286M736 274L718 286L734 304" : "M4 69C39 77 85 49 81 9M70 18L81 9L88 23"} stroke="currentColor" strokeWidth="1.35" vectorEffect={workshop ? "non-scaling-stroke" : undefined} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
