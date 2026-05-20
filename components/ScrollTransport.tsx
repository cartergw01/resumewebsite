"use client";

import { useEffect } from "react";

const worldThemes: Record<string, [number, number, number]> = {
  home: [143, 183, 255],
  work: [143, 183, 255],
  writing: [151, 169, 218],
  projects: [190, 174, 142],
};

const worldImages: Record<string, string> = {
  work: 'url("/cosmic-work-cohesive-v1.webp")',
  writing: 'url("/cosmic-writing-no-nebula-v1.webp")',
  projects: 'url("/cosmic-projects-cohesive-v1.webp")',
};

export default function ScrollTransport() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".cosmic-hero, .world-section"));
    const worlds = sections.filter((section) => section.classList.contains("world-section"));
    const home = document.querySelector<HTMLElement>(".cosmic-home");
    const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".cosmic-home .site-nav-primary a"));
    const dotLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".cosmic-home .section-dots a"));
    let activeWorld = "";
    let worldObserver: IntersectionObserver | null = null;
    let imageObserver: IntersectionObserver | null = null;

    const loadWorldImage = (section: HTMLElement) => {
      const image = worldImages[section.id];
      if (image) {
        section.style.setProperty("--world-image", image);
      }
    };

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

      dotLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${world}`);
      });
    };

    worlds.slice(0, 2).forEach(loadWorldImage);

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

      imageObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              loadWorldImage(entry.target as HTMLElement);
              imageObserver?.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "120% 0px" },
      );

      worlds.forEach((section) => {
        worldObserver?.observe(section);
        imageObserver?.observe(section);
      });
    } else {
      worlds.forEach(loadWorldImage);
    }

    return () => {
      worldObserver?.disconnect();
      imageObserver?.disconnect();
    };
  }, []);

  return null;
}
