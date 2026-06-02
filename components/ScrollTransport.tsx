"use client";

import { useEffect } from "react";

const worldThemes: Record<string, [number, number, number]> = {
  home: [143, 183, 255],
  work: [143, 183, 255],
  writing: [151, 169, 218],
  projects: [190, 174, 142],
  life: [236, 171, 105],
};

export default function ScrollTransport() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".cosmic-hero, .world-section"));
    const worlds = sections.filter((section) => section.classList.contains("world-section"));
    const home = document.querySelector<HTMLElement>(".cosmic-home");
    const hero = document.querySelector<HTMLElement>(".cosmic-hero");
    const heroCopy = document.querySelector<HTMLElement>(".hero-copy");
    const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".cosmic-home .site-nav-primary a"));
    let activeWorld = "";
    let worldObserver: IntersectionObserver | null = null;
    let heroFrame = 0;

    const setActiveWorld = (world: string) => {
      if (!home || world === activeWorld) return;

      activeWorld = world;
      home.dataset.cosmicWorld = world;

      const theme = worldThemes[world] ?? worldThemes.home;
      home.style.setProperty("--journey-r", `${theme[0]}`);
      home.style.setProperty("--journey-g", `${theme[1]}`);
      home.style.setProperty("--journey-b", `${theme[2]}`);

      navLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${world}`;
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });

    };

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
    window.addEventListener("resize", scheduleHeroUpdate);

    if ("IntersectionObserver" in window) {
      worldObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

          if (visible) {
            setActiveWorld((visible.target as HTMLElement).id || "home");
          }
        },
        {
          rootMargin: "-34% 0px -34% 0px",
          threshold: [0.18, 0.32, 0.5, 0.68],
        },
      );

      worlds.forEach((section) => {
        worldObserver?.observe(section);
      });
    }

    return () => {
      worldObserver?.disconnect();
      window.removeEventListener("scroll", scheduleHeroUpdate);
      window.removeEventListener("resize", scheduleHeroUpdate);
      if (heroFrame) {
        window.cancelAnimationFrame(heroFrame);
      }
    };
  }, []);

  return null;
}
