"use client";

import { useEffect } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const transportProperties = [
  "--transport-presence",
  "--transport-offset",
  "--transport-travel",
  "--transport-bg-y",
  "--transport-bg-scale",
  "--transport-saturate",
  "--transport-contrast",
  "--transport-hero-y",
  "--transport-copy-y",
  "--transport-scene-y",
  "--transport-hero-opacity",
  "--transport-copy-opacity",
  "--transport-scene-opacity",
  "--transport-spot-x",
  "--transport-spot-y",
  "--transport-spot-opacity",
];
const worldThemes: Record<string, [number, number, number]> = {
  home: [143, 183, 255],
  work: [118, 173, 255],
  writing: [177, 139, 255],
  projects: [112, 219, 220],
  life: [236, 171, 105],
};
const worldImages: Record<string, string> = {
  work: 'url("/cosmic-work-v7-sharp.webp")',
  writing: 'url("/cosmic-writing-v6-sharp.webp")',
  projects: 'url("/cosmic-projects-v6-sharp.webp")',
  life: 'url("/cosmic-life-v7-left.webp")',
};

export default function ScrollTransport() {
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".cosmic-hero, .world-section"));
    const home = document.querySelector<HTMLElement>(".cosmic-home");
    const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".cosmic-home .site-nav-primary a"));
    const dotLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".cosmic-home .section-dots a"));
    let frame = 0;
    let activeWorld = "";
    let lastScrollY = window.scrollY;
    let targetVelocity = 0;
    let velocity = 0;
    let imageObserver: IntersectionObserver | null = null;
    let disposed = false;

    const loadWorldImage = (section: HTMLElement) => {
      const image = worldImages[section.id];
      if (image && section.style.getPropertyValue("--world-image") !== image) {
        section.style.setProperty("--world-image", image);
      }
    };

    const reset = () => {
      sections.forEach((section) => {
        transportProperties.forEach((property) => section.style.removeProperty(property));
        section.classList.remove("is-active-world");
      });
      home?.removeAttribute("data-cosmic-world");
      home?.style.removeProperty("--journey-progress");
      home?.style.removeProperty("--journey-depth");
      home?.style.removeProperty("--journey-velocity");
      navLinks.forEach((link) => {
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
      });
      dotLinks.forEach((link) => link.classList.remove("active"));
    };

    const update = () => {
      frame = 0;
      if (disposed || !sections.length) return;

      const scrollY = window.scrollY;
      const scrollDelta = Math.abs(scrollY - lastScrollY);
      lastScrollY = scrollY;
      targetVelocity = Math.max(targetVelocity, clamp(scrollDelta / 140, 0, 0.65));
      velocity += (targetVelocity - velocity) * 0.11;
      targetVelocity *= 0.6;

      if (motionQuery.matches) {
        reset();
        return;
      }

      const viewportHeight = window.innerHeight || 1;
      const viewportCenter = viewportHeight / 2;
      let strongestSection: HTMLElement | null = null;
      let strongestPresence = -1;
      let strongestTravel = 0;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = (sectionCenter - viewportCenter) / Math.max(rect.height, viewportHeight);
        const presence = clamp(1 - Math.abs(distance) * 1.75, 0, 1);
        const copyVisibility = Math.pow(presence, 1.55);
        const travel = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);

        section.style.setProperty("--transport-presence", presence.toFixed(3));
        section.style.setProperty("--transport-offset", distance.toFixed(3));
        section.style.setProperty("--transport-travel", travel.toFixed(3));
        section.style.setProperty("--transport-bg-y", `${(distance * -7).toFixed(2)}px`);
        section.style.setProperty("--transport-bg-scale", (1.004 - presence * 0.002).toFixed(3));
        section.style.setProperty("--transport-saturate", (1 + presence * 0.06).toFixed(3));
        section.style.setProperty("--transport-contrast", (1.01 + presence * 0.03).toFixed(3));
        section.style.setProperty("--transport-hero-y", `${(distance * 7).toFixed(2)}px`);
        section.style.setProperty("--transport-copy-y", `${(distance * 9).toFixed(2)}px`);
        section.style.setProperty("--transport-scene-y", `${(distance * -5).toFixed(2)}px`);
        section.style.setProperty("--transport-hero-opacity", (0.2 + copyVisibility * 0.8).toFixed(3));
        section.style.setProperty("--transport-copy-opacity", (0.08 + copyVisibility * 0.92).toFixed(3));
        section.style.setProperty("--transport-scene-opacity", (0.58 + presence * 0.3).toFixed(3));
        section.style.setProperty("--transport-spot-x", `${(49 + distance * 5).toFixed(2)}%`);
        section.style.setProperty("--transport-spot-y", `${(53 + distance * 4).toFixed(2)}%`);
        section.style.setProperty("--transport-spot-opacity", (presence * 0.04).toFixed(3));

        if (presence > strongestPresence) {
          strongestPresence = presence;
          strongestSection = section;
          strongestTravel = travel;
        }
      });

      sections.forEach((section) => section.classList.toggle("is-active-world", section === strongestSection));

      const world = (strongestSection as HTMLElement | null)?.id || "home";
      const theme = worldThemes[world] ?? worldThemes.home;
      home?.style.setProperty("--journey-progress", strongestTravel.toFixed(3));
      home?.style.setProperty("--journey-depth", strongestPresence.toFixed(3));
      home?.style.setProperty("--journey-velocity", velocity.toFixed(3));
      home?.style.setProperty("--journey-r", `${theme[0]}`);
      home?.style.setProperty("--journey-g", `${theme[1]}`);
      home?.style.setProperty("--journey-b", `${theme[2]}`);

      if (home && world !== activeWorld) {
        activeWorld = world;
        home.dataset.cosmicWorld = world;

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
      }

      window.dispatchEvent(
        new CustomEvent("cosmic-journey", {
          detail: { world, velocity, presence: strongestPresence, progress: strongestTravel },
        }),
      );
    };

    const requestUpdate = () => {
      if (disposed || frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const syncAfterRestore = () => {
      lastScrollY = window.scrollY;
      requestUpdate();
    };

    const addMotionListener = () => {
      if ("addEventListener" in motionQuery) {
        motionQuery.addEventListener("change", requestUpdate);
        return () => motionQuery.removeEventListener("change", requestUpdate);
      }

      const legacyMotionQuery = motionQuery as MediaQueryList & {
        addListener: (listener: () => void) => void;
        removeListener: (listener: () => void) => void;
      };

      legacyMotionQuery.addListener(requestUpdate);
      return () => legacyMotionQuery.removeListener(requestUpdate);
    };

    update();
    sections.slice(1, 2).forEach(loadWorldImage);

    if (!("IntersectionObserver" in window)) {
      sections.slice(1).forEach(loadWorldImage);
    } else {
      try {
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
        sections.slice(1).forEach((section) => imageObserver?.observe(section));
      } catch {
        sections.slice(1).forEach(loadWorldImage);
      }
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("pageshow", syncAfterRestore);
    const removeMotionListener = addMotionListener();

    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("pageshow", syncAfterRestore);
      removeMotionListener();
      imageObserver?.disconnect();
    };
  }, []);

  return null;
}
