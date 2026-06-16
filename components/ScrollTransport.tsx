"use client";

import { useEffect } from "react";

export default function ScrollTransport() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".cosmic-hero");
    const heroCopy = document.querySelector<HTMLElement>(".hero-copy");
    let heroFrame = 0;

    const updateHeroCopy = () => {
      if (!hero || !heroCopy) return;

      const rect = hero.getBoundingClientRect();
      const fadeDistance = Math.max(180, window.innerHeight * 0.32);
      const progress = Math.min(1, Math.max(0, -rect.top / fadeDistance));
      const opacity = Math.max(0, 1 - progress * 1.25);

      heroCopy.style.setProperty("--hero-copy-opacity", opacity.toFixed(3));
      heroCopy.style.setProperty("--hero-copy-y", `${(-progress * 1.35).toFixed(3)}rem`);
      heroCopy.style.pointerEvents = opacity < 0.08 ? "none" : "";
    };

    const scheduleHeroUpdate = () => {
      if (heroFrame) return;

      heroFrame = window.requestAnimationFrame(() => {
        heroFrame = 0;
        updateHeroCopy();
      });
    };

    updateHeroCopy();
    window.addEventListener("scroll", scheduleHeroUpdate, { passive: true });

    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        scheduleHeroUpdate();
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", scheduleHeroUpdate);
      window.removeEventListener("resize", onResize);
      if (heroFrame) {
        window.cancelAnimationFrame(heroFrame);
      }
    };
  }, []);

  return null;
}
