"use client";

import { useEffect } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function ScrollTransport() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sections = Array.from(document.querySelectorAll<HTMLElement>(".cosmic-hero, .world-section"));
    let frame = 0;

    const update = () => {
      frame = 0;
      const viewportHeight = window.innerHeight || 1;
      const viewportCenter = viewportHeight / 2;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = (sectionCenter - viewportCenter) / Math.max(rect.height, viewportHeight);
        const presence = clamp(1 - Math.abs(distance) * 1.75, 0, 1);
        const travel = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);

        section.style.setProperty("--transport-presence", presence.toFixed(3));
        section.style.setProperty("--transport-offset", distance.toFixed(3));
        section.style.setProperty("--transport-travel", travel.toFixed(3));
        section.style.setProperty("--transport-bg-y", `${(distance * -28).toFixed(2)}px`);
        section.style.setProperty("--transport-bg-scale", (1.055 - presence * 0.025).toFixed(3));
        section.style.setProperty("--transport-saturate", (1.02 + presence * 0.16).toFixed(3));
        section.style.setProperty("--transport-contrast", (1.03 + presence * 0.09).toFixed(3));
        section.style.setProperty("--transport-hero-y", `${(distance * 18).toFixed(2)}px`);
        section.style.setProperty("--transport-copy-y", `${(distance * 24).toFixed(2)}px`);
        section.style.setProperty("--transport-scene-y", `${(distance * -18).toFixed(2)}px`);
        section.style.setProperty("--transport-hero-opacity", (0.84 + presence * 0.16).toFixed(3));
        section.style.setProperty("--transport-copy-opacity", (0.72 + presence * 0.28).toFixed(3));
        section.style.setProperty("--transport-scene-opacity", (0.58 + presence * 0.36).toFixed(3));
        section.style.setProperty("--transport-spot-x", `${(48 + distance * 10).toFixed(2)}%`);
        section.style.setProperty("--transport-spot-y", `${(54 + distance * 8).toFixed(2)}%`);
        section.style.setProperty("--transport-spot-opacity", (presence * 0.12).toFixed(3));
      });
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return null;
}
