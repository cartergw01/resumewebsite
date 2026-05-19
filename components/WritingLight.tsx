"use client";

import { useEffect } from "react";

export default function WritingLight() {
  useEffect(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".archive-row"));
    if (rows.length === 0) return;

    let frame = 0;

    const updateLitEssay = () => {
      frame = 0;
      const guide = window.innerHeight * 0.48;
      let active: HTMLElement | null = null;
      let closest = Number.POSITIVE_INFINITY;

      rows.forEach((row) => {
        const rect = row.getBoundingClientRect();
        const center = rect.top + rect.height * 0.5;
        const distance = Math.abs(center - guide);

        if (rect.bottom > 0 && rect.top < window.innerHeight && distance < closest) {
          closest = distance;
          active = row;
        }
      });

      rows.forEach((row) => {
        row.classList.toggle("is-lit", row === active);
      });
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateLitEssay);
    };

    updateLitEssay();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      rows.forEach((row) => row.classList.remove("is-lit"));
    };
  }, []);

  return null;
}
