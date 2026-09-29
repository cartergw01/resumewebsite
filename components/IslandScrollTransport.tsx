"use client";

import { useEffect, useRef, type ReactNode } from "react";
import GalaxyBackground from "./GalaxyBackground";
import JourneyStars from "./JourneyStars";
import { introFocus } from "@/lib/island-overview";
import styles from "./IslandHome.module.css";

// Stops without a title (the opening and closing views) have no tab.
type World = { id: string; title?: string };
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => value * value * (3 - 2 * value);
const phase = (value: number, start: number, end: number) => ease(clamp((value - start) / (end - start)));
// Each island holds before the camera crosses to the next one.
const FINAL_HOLD = 0.5;
const arrivalLights: Record<string, readonly (readonly [string, number, number])[]> = {
  work: [["city-windows", 0.76, 0.86], ["city-tower", 0.86, 0.96]],
  writing: [["reading-lamp", 0.77, 0.87], ["reading-paper", 0.87, 0.98]],
};

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
    const buttonScene = buttons.map((button) => Number(button.dataset.sceneIndex));
    const tabFor = (index: number) => buttons[buttonScene.indexOf(index)];
    const sceneNav = track.querySelector<HTMLElement>("[data-scene-nav]")!;
    const comet = track.querySelector<HTMLElement>("[data-scene-comet]")!;
    const next = track.querySelector<HTMLButtonElement>("[data-next-scene]")!;
    const nextLabel = next.querySelector<HTMLElement>("[data-next-label]")!;
    const flightTitle = track.querySelector<HTMLElement>("[data-flight-title]")!;
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
    let heading = 1;
    let previousProgress = 0;

    // Off-screen islands load on the first sign of travel, not on first paint.
    const warm = () => { if (stage.dataset.warm !== "true") stage.dataset.warm = "true"; };
    const render = (now: number) => {
      frame = 0;
      if (stage.dataset.entering) return;
      const progress = clamp((window.scrollY - start) / travel);
      if (progress > 0) warm();
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
      const retreat = phase(crossing, 0, 0.3);
      const passage = phase(crossing, 0.18, 0.78);
      // The next island starts arriving while the last one is still in view,
      // so the camera never lingers on empty space between them.
      const approach = phase(crossing, 0.22, 0.83);
      const reveal = phase(crossing, 0.12, 0.36);
      const arrivalLight = phase(crossing, 0.82, 0.92);
      const arrivalCopy = phase(crossing, 0.9, 0.98);
      const arrivalCue = phase(crossing, 0.95, 1);
      const flight = Math.pow(Math.sin(Math.PI * clamp((crossing - 0.18) / 0.6)), 2);
      const travelling = String(!motion.matches && crossing > 0 && crossing < 1);
      if (stage.dataset.travelling !== travelling) stage.dataset.travelling = travelling;

      // The first crossing flies into the opening view's Work island rather
      // than across open space, so the two islands share one path.
      const zoom = from === 0 && !motion.matches ? phase(crossing, 0.05, 0.85) : 0;

      scenes.forEach((scene, index) => {
        const outgoing = index === from;
        const visible = motion.matches ? index === current
          : outgoing ? crossing < 0.88 : index === from + 1 && crossing > 0.12;
        scene.style.opacity = visible ? "1" : "0";
        scene.style.visibility = visible ? "visible" : "hidden";
        // A reversible camera path: pull away before travelling, then approach
        // a solid, dim silhouette. Arrival finishes before light and copy return.
        const distance = 1 - approach;
        const x = outgoing ? -12 * retreat - 145 * passage : 55 * Math.pow(distance, 1.1);
        const y = outgoing ? -arc * (8 * retreat + 28 * Math.sin(passage * Math.PI / 2))
          : arc * (26 * distance + 10 * Math.sin(distance * Math.PI));
        // Islands stay large enough to read as places, never specks.
        const scale = outgoing ? 1 - 0.35 * retreat - 0.2 * passage : 0.45 + 0.55 * approach;
        const bank = outgoing ? -arc * 3 * passage : arc * 3 * distance;
        art[index].style.transform = motion.matches ? "none"
          : `translate3d(${x}%, ${y}%, 0) rotate(${bank}deg) scale(${scale})`;
        art[index].style.opacity = motion.matches || outgoing ? "1" : reveal.toFixed(4);
        art[index].style.transformOrigin = "";
        if (from === 0 && !motion.matches && index <= 1) {
          const size = introFocus.size / 100;
          if (index === 0) {
            art[0].style.transformOrigin = `${introFocus.x}% ${introFocus.y}%`;
            art[0].style.transform = `translate3d(${(50 - introFocus.x) * zoom}%, ${(50 - introFocus.y) * zoom}%, 0) scale(${1 + (1 / size - 1) * zoom})`;
            art[0].style.opacity = (1 - phase(crossing, 0.62, 0.86)).toFixed(4);
          } else {
            art[1].style.transformOrigin = "50% 50%";
            art[1].style.transform = `translate3d(${(introFocus.x - 50) * (1 - zoom)}%, ${(introFocus.y - 50) * (1 - zoom)}%, 0) scale(${size + (1 - size) * zoom})`;
            art[1].style.opacity = phase(crossing, 0.3, 0.6).toFixed(4);
          }
        }
        const copyOpacity = motion.matches ? 1 : outgoing
          ? 1 - phase(crossing, 0, 0.18) : arrivalCopy;
        copy[index].style.transform = motion.matches ? "none"
          : `translate3d(0, ${(outgoing ? -12 : 16) * (1 - copyOpacity)}px, 0)`;
        copy[index].style.opacity = copyOpacity.toFixed(4);
        art[index].style.setProperty("--cue-opacity", (motion.matches ? 1 : outgoing ? 1 - phase(crossing, 0, 0.12) : arrivalCue).toFixed(4));
        const arrivingLight = from === 0 ? 0.85 + 0.15 * arrivalLight : 0.34 + 0.16 * approach + 0.5 * arrivalLight;
        art[index].style.setProperty("--island-light", (motion.matches ? 1 : outgoing ? 1 - (from === 0 ? 0 : 0.45) * retreat : arrivingLight).toFixed(4));
        art[index].style.setProperty("--island-lights", (motion.matches ? 1 : outgoing ? 1 - retreat : arrivalLight).toFixed(4));
        // Distinct, reversible welcomes: city blocks first, then the tower;
        // the reading lamp precedes warm paper; the workshop screen wakes last.
        for (const [name, first, last] of arrivalLights[worlds[index].id] ?? []) {
          art[index].style.setProperty(`--${name}`, (motion.matches ? 1 : outgoing ? 1 - retreat : phase(crossing, first, last)).toFixed(4));
        }
        if (worlds[index].id === "projects") art[index].style.setProperty("--workshop-screen", (motion.matches ? 0.3 : outgoing ? 0.3 * (1 - retreat) : phase(crossing, 0.86, 0.97)).toFixed(4));
      });
      // Name the destination while no island copy is on screen.
      if (Math.abs(progress - previousProgress) > 0.0005) heading = progress > previousProgress ? 1 : -1;
      previousProgress = progress;
      const destination = worlds[heading > 0 ? Math.min(from + 1, worlds.length - 1) : from].title ?? "";
      if (flightTitle.textContent !== destination) flightTitle.textContent = destination;
      const titleShow = motion.matches ? 0 : Math.sin(Math.PI * clamp((crossing - 0.12) / 0.8));
      flightTitle.style.opacity = (0.08 * titleShow).toFixed(4);
      flightTitle.style.transform = `translate3d(${(6 - 12 * crossing).toFixed(2)}vw, 0, 0) scale(${(0.96 + 0.04 * titleShow).toFixed(4)})`;
      stage.style.setProperty("--camera-progress", cameraProgress.toFixed(4));
      stage.style.setProperty("--camera-path", (from + passage).toFixed(4));
      stage.style.setProperty("--camera-arc", (arc * Math.sin(mix * Math.PI)).toFixed(4));
      stage.style.setProperty("--flight", motion.matches ? "0" : (flight * (from === 0 ? 0.35 : 1)).toFixed(4));
      stage.style.setProperty("--flight-bank", `${-arc * 10 * Math.cos(mix * Math.PI)}deg`);
      // Follow the full scroll distance, including the holds between crossings.
      // Reduced motion still shows accurate progress without the animated trail.
      const place = Math.min(progress * duration, scenes.length - 1);
      const stop = Math.min(Math.floor(place), scenes.length - 2);
      const starX = starStops[stop] + (starStops[stop + 1] - starStops[stop]) * clamp(place - stop);
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
          (tabFor(current) ?? next).focus({ preventScroll: true });
        }
        activeIndex = current;
        stage.dataset.engaged = "false";
        track.dataset.scene = worlds[current].id;
        scenes.forEach((scene, index) => {
          scene.inert = index !== current;
          scene.setAttribute("aria-hidden", String(index !== current));
          scene.dataset.active = String(index === current);
        });
        buttons.forEach((button, tab) => {
          const { title } = worlds[buttonScene[tab]];
          const selected = buttonScene[tab] === current;
          if (selected) button.setAttribute("aria-current", "step");
          else button.removeAttribute("aria-current");
          button.setAttribute("aria-label", selected
            ? `Show ${title} island, selected. Activate again to open ${title}`
            : `Show ${title} island`);
        });
        const upcoming = worlds[current + 1];
        nextLabel.textContent = current === scenes.length - 1 ? "Back to start" : "Scroll to explore";
        next.setAttribute("aria-label", current === scenes.length - 1 ? "Back to the start"
          : upcoming.title ? `Scroll to the ${upcoming.title} island` : "Scroll to the end");
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
      // Opening and closing views park the star on the first and last tab.
      const centers = buttons.map((button) => button.offsetLeft + button.offsetWidth / 2);
      starStops = worlds.map((_, index) => {
        const tab = buttonScene.indexOf(index);
        return tab >= 0 ? centers[tab] : index < buttonScene[0] ? centers[0] : centers[centers.length - 1];
      });
      schedule();
    };
    const jump = (index: number, instant = false) => {
      warm();
      // Land just inside each stop's hold, after its arrival has settled.
      const position = index === 0 ? 0 : index === scenes.length - 1 ? duration : index + 0.11;
      const progress = position / duration;
      // Safari can retain a pending smooth scroll when a quick second tap
      // targets the current position. Cancel that flight before starting one.
      window.scrollTo({ top: window.scrollY, behavior: "instant" });
      window.scrollTo({
        top: start + progress * travel,
        behavior: instant || motion.matches ? "instant" : "smooth",
      });
    };
    // A second tap on the selected island opens its page through the same
    // landmark approach as clicking the island itself.
    jumpRef.current = (index: number) => {
      const link = scenes[index].querySelector<HTMLAnchorElement>("[data-island-link]");
      if (index === activeIndex && link) link.click();
      else jump(index);
    };
    const advance = () => jump(activeIndex === scenes.length - 1 ? 0 : activeIndex + 1);
    const followHash = () => {
      const hash = window.location.hash.slice(1);
      const index = hash === "constellation" ? 0 : worlds.findIndex((world) => world.id === hash);
      if (index >= 0) jump(index, true);
    };
    // Islands in the opening and closing views fly the camera to their stop.
    const jumpTo = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("[data-jump]");
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const index = worlds.findIndex((world) => world.id === link.dataset.jump);
      if (index < 0) return;
      event.preventDefault();
      jump(index);
    };
    const engage = (event: Event) => {
      const pointer = event as PointerEvent;
      if (pointer.type.startsWith("pointer") && pointer.pointerType !== "mouse") return;
      const target = event.type === "pointerout" || event.type === "focusout" ? (event as FocusEvent).relatedTarget : event.target;
      const engaged = target instanceof Element && Boolean(target.closest('[data-island-scene][data-active="true"] [data-island-link]'));
      if (stage.dataset.engaged !== String(engaged)) stage.dataset.engaged = String(engaged);
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
    stage.addEventListener("click", jumpTo);
    ["pointerover", "pointerout", "focusin", "focusout"].forEach(type => stage.addEventListener(type, engage));
    const intents = ["wheel", "touchstart", "keydown"] as const;
    intents.forEach(type => window.addEventListener(type, warm, { passive: true, once: true }));
    sceneNav.addEventListener("focusin", warm);

    return () => {
      intents.forEach(type => window.removeEventListener(type, warm));
      sceneNav.removeEventListener("focusin", warm);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      window.removeEventListener("hashchange", followHash);
      motion.removeEventListener("change", schedule);
      next.removeEventListener("click", advance);
      stage.removeEventListener("click", jumpTo);
      ["pointerover", "pointerout", "focusin", "focusout"].forEach(type => stage.removeEventListener(type, engage));
      window.cancelAnimationFrame(frame);
      window.clearTimeout(starRestTimer);
      jumpRef.current = () => {};
    };
  }, [worlds]);

  return (
    <main ref={trackRef} id="islands" tabIndex={-1} className={styles.track} data-scene={worlds[0].id} aria-label="Three islands: work, writing, and projects">
      <div className={styles.stage} data-island-stage data-travelling="false" data-engaged="false" data-warm="false">
        <GalaxyBackground />
        <JourneyStars />
        <div className={styles.vignette} aria-hidden="true" />
        <p className={styles.flightTitle} data-flight-title aria-hidden="true" />
        {children}
        <div className={styles.controls}>
          <button type="button" className={styles.scrollHint} data-next-scene aria-label={`Scroll to the ${worlds[1].title} island`}>
            <span className={styles.scrollArrow} aria-hidden="true">↓</span>
            <span data-next-label>Scroll to explore</span>
          </button>
          <nav className={styles.chapters} aria-label="Island scenes" data-scene-nav>
            {worlds.map((world, index) => world.title ? (
              <button
                type="button"
                key={world.id}
                data-scene-button
                data-scene-index={index}
                aria-label={`Show ${world.title} island`}
                onClick={() => jumpRef.current(index)}
              >
                <span className={styles.chapterLabel}>{world.title}</span>
                <span className={styles.chapterStar} aria-hidden="true" />
              </button>
            ) : null)}
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
