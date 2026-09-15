"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import styles from "./IslandHome.module.css";

export default function IslandLink({ href, title, prompt, children }: { href: string; title: string; prompt: string; children: ReactNode }) {
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
    const rect = visual.getBoundingClientRect();
    const x = window.innerWidth / 2 - (rect.left + rect.width / 2);
    const y = window.innerHeight / 2 - (rect.top + rect.height / 2);
    const scale = Math.max(3.6, window.innerWidth / rect.width * 1.4, window.innerHeight / rect.height * 1.4);
    const initialTransform = getComputedStyle(visual).transform;
    stage.dataset.entering = title.toLowerCase();
    stage.setAttribute("aria-busy", "true");

    // The island, galaxy, and copy move independently so the island feels like
    // a place the camera approaches, while the surrounding interface recedes.
    const zoom = visual.animate([
      { transform: initialTransform === "none" ? "scale(1)" : initialTransform },
      { transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})` },
    ], { duration: 900, easing: "cubic-bezier(0.5, 0, 0.75, 0.4)", fill: "forwards" });

    let arrivalFrame = 0;
    let recoveryTimer = 0;
    let cancelled = false;
    const reset = () => {
      cancelled = true;
      zoom.cancel();
      cancelAnimationFrame(arrivalFrame);
      clearTimeout(recoveryTimer);
      delete stage.dataset.entering;
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
      aria-label={`${prompt}. Enter ${title} island`}
      onClick={enter}
    >
      {children}
      <span className={styles.islandCue}>
        <span>{prompt}</span>
        <svg viewBox="0 0 100 80" fill="none" aria-hidden="true">
          <path d="M4 69C39 77 85 49 81 9M70 18L81 9L88 23" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
