"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./IslandHome.module.css";

type World = { id: string; title: string };
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => value * value * (3 - 2 * value);
// Each island holds before the camera crosses to the next one.
const FINAL_HOLD = 0.5;

export default function IslandScrollTransport({ children, worlds }: { children: ReactNode; worlds: World[] }) {
  const trackRef = useRef<HTMLElement>(null);
  const jumpRef = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const stage = track.querySelector<HTMLElement>("[data-island-stage]")!;
    const scenes = Array.from(track.querySelectorAll<HTMLElement>("[data-island-scene]"));
    const art = scenes.map((scene) => scene.querySelector<HTMLElement>("[data-scene-art]")!);
    const copy = scenes.map((scene) => scene.querySelector<HTMLElement>("[data-scene-copy]")!);
    const buttons = Array.from(track.querySelectorAll<HTMLButtonElement>("[data-scene-button]"));
    const sceneNav = track.querySelector<HTMLElement>("[data-scene-nav]")!;
    const comet = track.querySelector<HTMLElement>("[data-scene-comet]")!;
    const next = track.querySelector<HTMLButtonElement>("[data-next-scene]")!;
    const nextLabel = next.querySelector<HTMLElement>("[data-next-label]")!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const duration = scenes.length - 1 + FINAL_HOLD;
    let frame = 0;
    let activeIndex = -1;
    let travel = 1;
    let start = 0;
    let measuredHeight = 0;
    let starStops: number[] = [];
    let previousStarX: number | null = null;
    let starRestTimer = 0;
    let cameraProgress: number | null = null;
    let previousFrame = 0;

    const render = (now: number) => {
      frame = 0;
      if (stage.dataset.entering) return;
      const progress = clamp((window.scrollY - start) / travel);
      // Soften wheel steps without delaying the scroll-position indicator.
      const smoothing = 1 - Math.exp(-Math.min(now - previousFrame, 32) / 65);
      cameraProgress = cameraProgress === null || motion.matches
        ? progress
        : cameraProgress + (progress - cameraProgress) * smoothing;
      if (Math.abs(progress - cameraProgress) < 0.0001) cameraProgress = progress;
      previousFrame = now;
      const position = cameraProgress * duration;
      const from = Math.min(scenes.length - 1, Math.floor(position));
      const crossing = from < scenes.length - 1 ? clamp((position - from - 0.34) / 0.54) : 0;
      const mix = ease(crossing);
      const current = Math.min(scenes.length - 1, from + (mix >= 0.5 ? 1 : 0));
      const arc = from % 2 === 0 ? 1 : -1;

      scenes.forEach((scene, index) => {
        const outgoing = index === from;
        const visible = motion.matches ? index === current
          : outgoing ? mix < 1 : index === from + 1 && mix > 0;
        scene.style.opacity = visible ? "1" : "0";
        scene.style.visibility = visible ? "visible" : "hidden";
        // Islands stay solid: the departing world passes close to the camera,
        // while the next approaches from a smaller, more distant position.
        const distance = outgoing ? mix : 1 - mix;
        const x = outgoing ? -180 * Math.pow(distance, 1.1) : 92 * distance;
        const y = (outgoing ? 24 : -16) * arc * distance;
        const scale = outgoing ? 1 + distance * 0.65 : 1 - distance * 0.48;
        const bank = (outgoing ? -12 : 9) * arc * distance;
        art[index].style.transform = motion.matches ? "none"
          : `translate3d(${x}%, ${y}%, 0) rotate(${bank}deg) scale(${scale})`;
        const copyOpacity = motion.matches ? 1 : outgoing
          ? 1 - ease(clamp(crossing / 0.38))
          : ease(clamp((crossing - 0.62) / 0.38));
        copy[index].style.transform = motion.matches ? "none"
          : `translate3d(${(outgoing ? -38 : 38) * (1 - copyOpacity)}px, 0, 0)`;
        copy[index].style.opacity = copyOpacity.toFixed(4);
        art[index].style.setProperty("--cue-opacity", copyOpacity.toFixed(4));
      });
      stage.style.setProperty("--camera-progress", cameraProgress.toFixed(4));
      stage.style.setProperty("--flight", motion.matches ? "0" : Math.pow(Math.sin(crossing * Math.PI), 2).toFixed(4));
      stage.style.setProperty("--flight-shift", (mix * -18).toFixed(4));
      stage.style.setProperty("--flight-bank", `${arc * 8}deg`);
      // Follow the full scroll distance, including the holds between crossings.
      // Reduced motion still shows accurate progress without the animated trail.
      const starX = starStops[0] + (starStops[starStops.length - 1] - starStops[0]) * progress;
      comet.style.setProperty("--comet-x", `${starX.toFixed(2)}px`);
      if (!motion.matches && previousStarX !== null && Math.abs(starX - previousStarX) > 0.1) {
        comet.dataset.direction = starX > previousStarX ? "forward" : "backward";
        comet.dataset.moving = "true";
        window.clearTimeout(starRestTimer);
        starRestTimer = window.setTimeout(() => { delete comet.dataset.moving; }, 180);
      }
      previousStarX = starX;

      if (current !== activeIndex) {
        // Move focus out of a departing scene before marking it inert.
        if (activeIndex >= 0 && scenes[activeIndex].contains(document.activeElement)) {
          buttons[current].focus({ preventScroll: true });
        }
        activeIndex = current;
        track.dataset.scene = worlds[current].id;
        scenes.forEach((scene, index) => {
          scene.inert = index !== current;
          scene.setAttribute("aria-hidden", String(index !== current));
          scene.dataset.active = String(index === current);
          if (index === current) buttons[index].setAttribute("aria-current", "step");
          else buttons[index].removeAttribute("aria-current");
        });
        nextLabel.textContent = current === scenes.length - 1 ? "Back to start" : "Scroll to explore";
        next.setAttribute("aria-label", current === scenes.length - 1 ? "Back to the Work island" : `Scroll to the ${worlds[current + 1].title} island`);
        next.dataset.last = String(current === scenes.length - 1);
      }
      if (cameraProgress !== progress) schedule();
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    const measure = () => {
      const progress = clamp((window.scrollY - start) / travel);
      const height = track.offsetHeight;
      start = track.getBoundingClientRect().top + window.scrollY;
      travel = Math.max(1, height - stage.offsetHeight);
      // Keep the same shot when rotating a phone or resizing the window.
      // Browser toolbar changes only resize the stage, leaving the svh track stable.
      if (measuredHeight && measuredHeight !== height) {
        window.scrollTo({ top: start + progress * travel, behavior: "instant" });
      }
      measuredHeight = height;
      starStops = buttons.map((button) => button.offsetLeft + button.offsetWidth / 2);
      schedule();
    };
    const jump = (index: number, instant = false) => {
      const progress = index / Math.max(1, scenes.length - 1);
      window.scrollTo({
        top: start + progress * travel,
        behavior: instant || motion.matches ? "instant" : "smooth",
      });
    };
    jumpRef.current = jump;
    const advance = () => jump(activeIndex === scenes.length - 1 ? 0 : activeIndex + 1);
    const followHash = () => {
      const hash = window.location.hash.slice(1);
      const index = hash === "constellation" ? 0 : worlds.findIndex((world) => world.id === hash);
      if (index >= 0) jump(index, true);
    };

    measure();
    followHash();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(stage);
    observer.observe(sceneNav);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pageshow", measure);
    window.addEventListener("hashchange", followHash);
    motion.addEventListener("change", schedule);
    next.addEventListener("click", advance);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      window.removeEventListener("hashchange", followHash);
      motion.removeEventListener("change", schedule);
      next.removeEventListener("click", advance);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(starRestTimer);
      jumpRef.current = () => {};
    };
  }, [worlds]);

  return (
    <main ref={trackRef} className={styles.track} data-scene="work" aria-label="Three islands: work, writing, and projects">
      <div className={styles.stage} data-island-stage>
        <div className={styles.galaxy} aria-hidden="true" />
        <div className={styles.stars} aria-hidden="true" />
        <div className={styles.vignette} aria-hidden="true" />
        <div className={styles.flightStars} data-flight-stars aria-hidden="true">
          <svg viewBox="0 0 1200 800" preserveAspectRatio="none" fill="none">
            <defs>
              <linearGradient id="island-flight-trail" x1="0" x2="1" y1="0" y2="0">
                <stop stopColor="#b8d2ff" stopOpacity="0" />
                <stop offset="0.82" stopColor="#cce0ff" stopOpacity="0.6" />
                <stop offset="1" stopColor="#fff1d7" />
              </linearGradient>
            </defs>
            <g stroke="url(#island-flight-trail)" strokeWidth="1.2" strokeLinecap="round">
              <path d="M40 108h170M360 166h90M840 70h240M1050 238h110M120 298h140M630 260h210M350 425h160M920 466h250M30 572h230M570 624h110M790 730h270M310 752h90" />
            </g>
            <g stroke="#d6e4ff" strokeWidth="1" opacity="0.35">
              <path d="M260 56h42M630 120h28M80 216h34M510 326h60M990 346h32M200 468h44M740 534h55M1090 648h30M430 680h45" />
            </g>
          </svg>
        </div>
        {children}
        <div className={styles.controls}>
          <button type="button" className={styles.scrollHint} data-next-scene aria-label="Scroll to the Writing island">
            <span className={styles.scrollArrow} aria-hidden="true">↓</span>
            <span data-next-label>Scroll to explore</span>
          </button>
          <nav className={styles.chapters} aria-label="Island scenes" data-scene-nav>
            {worlds.map((world, index) => (
              <button
                type="button"
                key={world.id}
                data-scene-button
                aria-label={`Show ${world.title} island`}
                aria-current={index === 0 ? "step" : undefined}
                onClick={() => jumpRef.current(index)}
              >
                <span className={styles.chapterLabel}>{world.title}</span>
                <span className={styles.chapterStar} aria-hidden="true" />
              </button>
            ))}
            <span className={styles.shootingStar} data-scene-comet aria-hidden="true">
              <span className={styles.cometTrail}>
                <span /><span /><span />
              </span>
              <span className={styles.cometHead} />
            </span>
          </nav>
        </div>
      </div>
    </main>
  );
}
