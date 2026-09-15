"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./IslandHome.module.css";

type World = { id: string; title: string };
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => value * value * (3 - 2 * value);
// Each shot holds before its dissolve; the final shot has room to settle.
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

    const render = () => {
      frame = 0;
      if (stage.dataset.entering) return;
      const progress = clamp((window.scrollY - start) / travel);
      const position = progress * duration;
      const from = Math.min(scenes.length - 1, Math.floor(position));
      const mix = ease(clamp((position - from - 0.42) / 0.38));
      const current = Math.min(scenes.length - 1, from + (mix >= 0.5 ? 1 : 0));

      scenes.forEach((scene, index) => {
        const opacity = motion.matches
          ? Number(index === current)
          : index === from ? 1 - (from === scenes.length - 1 ? 0 : mix) : index === from + 1 ? mix : 0;
        const offset = Math.max(-1, Math.min(1, position - index));
        scene.style.opacity = opacity.toFixed(4);
        scene.style.visibility = opacity > 0 ? "visible" : "hidden";
        art[index].style.transform = motion.matches
          ? "none"
          : `translate3d(${-offset * 3}%, ${offset * -1.5}%, 0) scale(${1 + offset * 0.055})`;
        copy[index].style.transform = motion.matches ? "none" : `translate3d(0, ${-offset * 18}px, 0)`;
        // Let the outgoing words clear before the next title arrives.
        const copyOpacity = motion.matches || from === scenes.length - 1
          ? 1
          : index === from ? 1 - ease(clamp((position - from - 0.32) / 0.22))
          : ease(clamp((position - from - 0.6) / 0.25));
        copy[index].style.opacity = copyOpacity.toFixed(4);
      });
      stage.style.setProperty("--camera-progress", progress.toFixed(4));
      // Follow the full scroll distance, including the holds between dissolves.
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
