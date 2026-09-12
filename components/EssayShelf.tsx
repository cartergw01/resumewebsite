"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./HomeCollections.module.css";

export default function EssayShelf({ children }: { children: ReactNode }) {
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const covers = Array.from(shelf.querySelectorAll<HTMLElement>("[data-essay-motion]"), (element, index) => ({
      element,
      pull: 0,
      response: [14, 12, 13][index % 3],
      weight: [1, 0.94, 0.98][index % 3],
    }));
    const visible = new Set<(typeof covers)[number]>();
    const items = new Map(covers.map((cover) => [cover.element.closest("li"), cover]));
    let frame = 0;
    let previousFrame = 0;
    let previousScroll = shelf.scrollLeft;
    let lastScrollTime = 0;
    let strength = 0;
    let gestureStarted = 0;
    let gestureDirection = 1;

    function clearCover(cover: (typeof covers)[number]) {
      cover.pull = 0;
      cover.element.style.removeProperty("transform");
      cover.element.style.removeProperty("will-change");
    }

    function rest() {
      cancelAnimationFrame(frame);
      frame = 0;
      strength = 0;
      previousScroll = shelf!.scrollLeft;
      covers.forEach(clearCover);
    }

    function animate(now: number) {
      // A frame timestamp can precede the scroll event that requested it.
      const dt = Math.max(0, Math.min((now - previousFrame) / 1000, 0.032));
      previousFrame = now;
      const target = now - lastScrollTime < 120 ? strength : 0;
      // One small wiggle per gesture, never a repeated shake on every scroll event.
      const phase = Math.max(0, Math.min((now - gestureStarted) / 760, 1));
      const wiggle = gestureDirection * Math.sin(phase * Math.PI * 2) * Math.sin(phase * Math.PI) * 0.8;
      let moving = false;

      // Only transform visible artwork. Text and link hit areas never move.
      for (const cover of visible) {
        // Ease the pull directly so returning to the shelf cannot bounce or overshoot.
        const ease = 1 - Math.exp(-(target ? cover.response : 12) * dt);
        cover.pull += (target * cover.weight - cover.pull) * ease;
        if (cover.pull > 0.001 || target !== 0) {
          const lift = -16 * cover.pull;
          const scale = 1 + 0.04 * cover.pull;
          const angle = wiggle * cover.pull;
          cover.element.style.willChange = "transform";
          cover.element.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0) rotate(${angle.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
          moving = true;
        } else {
          clearCover(cover);
        }
      }

      // No idle animation loop, including while the shelf is offscreen.
      frame = moving ? requestAnimationFrame(animate) : 0;
    }

    function onScroll() {
      const now = performance.now();
      const delta = shelf!.scrollLeft - previousScroll;
      const elapsed = Math.max(16, Math.min(now - lastScrollTime, 50));
      previousScroll = shelf!.scrollLeft;
      if (preference.matches || document.hidden || !visible.size || Math.abs(delta) < 0.1) return;

      if (!frame || now - lastScrollTime > 220) {
        gestureStarted = now;
        gestureDirection = -Math.sign(delta);
      }
      lastScrollTime = now;
      strength = 0.6 + Math.min(Math.abs(delta) / elapsed * 0.18, 0.4);
      if (!frame) {
        previousFrame = now;
        frame = requestAnimationFrame(animate);
      }
    }

    // Observe the stable list items so the animation cannot change visibility.
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const cover = items.get(entry.target as HTMLLIElement);
        if (!cover) continue;
        if (entry.isIntersecting) visible.add(cover);
        else {
          visible.delete(cover);
          clearCover(cover);
        }
      }
      if (!visible.size) rest();
    });

    for (const item of items.keys()) if (item) observer.observe(item);
    shelf.addEventListener("scroll", onScroll, { passive: true });
    preference.addEventListener("change", rest);
    document.addEventListener("visibilitychange", rest);

    return () => {
      rest();
      observer.disconnect();
      shelf.removeEventListener("scroll", onScroll);
      preference.removeEventListener("change", rest);
      document.removeEventListener("visibilitychange", rest);
    };
  }, []);

  return <div ref={shelfRef} className={styles.shelfScroll} role="region" aria-label="Essay bookshelf" tabIndex={0}>{children}</div>;
}
