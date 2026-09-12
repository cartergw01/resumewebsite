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
      angle: 0,
      velocity: 0,
      stiffness: 230 + (index % 3) * 35,
      weight: [1, 0.88, 1.08][index % 3],
    }));
    const visible = new Set<(typeof covers)[number]>();
    const items = new Map(covers.map((cover) => [cover.element.closest("li"), cover]));
    let frame = 0;
    let previousFrame = 0;
    let previousScroll = shelf.scrollLeft;
    let lastScrollTime = 0;
    let lean = 0;

    function clearCover(cover: (typeof covers)[number]) {
      cover.angle = 0;
      cover.velocity = 0;
      cover.element.style.removeProperty("transform");
      cover.element.style.removeProperty("will-change");
    }

    function rest() {
      cancelAnimationFrame(frame);
      frame = 0;
      lean = 0;
      previousScroll = shelf!.scrollLeft;
      covers.forEach(clearCover);
    }

    function animate(now: number) {
      const dt = Math.min((now - previousFrame) / 1000, 0.032);
      previousFrame = now;
      const target = now - lastScrollTime < 70 ? lean : 0;
      let moving = false;

      // Only transform visible artwork. Text and link hit areas never move.
      for (const cover of visible) {
        const acceleration = (target * cover.weight - cover.angle) * cover.stiffness - cover.velocity * 25;
        cover.velocity += acceleration * dt;
        cover.angle += cover.velocity * dt;
        if (Math.abs(cover.angle) > 0.015 || Math.abs(cover.velocity) > 0.05 || target !== 0) {
          const lift = -Math.min(Math.abs(cover.angle) * 1.6, 9);
          cover.element.style.willChange = "transform";
          cover.element.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0) rotate(${cover.angle.toFixed(3)}deg)`;
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
      lastScrollTime = now;
      if (preference.matches || document.hidden || !visible.size || Math.abs(delta) < 0.1) return;

      lean = Math.max(-5.5, Math.min(5.5, -delta / elapsed * 1.8));
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
