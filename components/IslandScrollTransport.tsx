"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import GalaxyBackground from "./GalaxyBackground";
import JourneyStars from "./JourneyStars";
import { rememberIsland } from "@/lib/island-location";
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
  const [ready, setReady] = useState(false);
  const jumpRef = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    // The world hash owns restoration. Safari otherwise reapplies the old
    // pixel offset after our camera jump when returning from an overview link.
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
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
    let entryPending = false;
    let entryRecovery = 0;
    // Where the opening view's Work island sits in its art box (percent), read
    // from layout so each breakpoint's arrangement drives the first zoom.
    let introFocus = { x: 50, y: 50, size: 100 };

    // Off-screen islands load on the first sign of travel, not on first paint.
    const warm = () => { if (stage.dataset.warm !== "true") stage.dataset.warm = "true"; };
    const render = (now: number) => {
      frame = 0;
      if (stage.dataset.entering) return;
      const progress = clamp((window.scrollY - start) / travel);
      if (progress > 0) warm();
      // Soften wheel steps without delaying the scroll-position indicator.
      const smoothing = 1 - Math.exp(-Math.min(now - previousFrame, 32) / 28);
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
      stage.style.setProperty("--camera-progress", cameraProgress.toFixed(4));
      stage.style.setProperty("--camera-path", (from + passage).toFixed(4));
      stage.style.setProperty("--camera-arc", (arc * Math.sin(mix * Math.PI)).toFixed(4));
      stage.style.setProperty("--flight", motion.matches ? "0" : (flight * (from === 0 ? 0.35 : 1)).toFixed(4));
      stage.style.setProperty("--flight-bank", `${-arc * 10 * Math.cos(mix * Math.PI)}deg`);
      // Follow the full scroll distance, including the holds between crossings.
      // Reduced motion still shows accurate progress without the animated trail.
      const stops = worlds.map((_, index) => stopProgress(index));
      const stop = Math.max(0, stops.findIndex((position) => position > progress) - 1);
      const segment = progress >= 1 ? stops.length - 2 : stop;
      const fraction = clamp((progress - stops[segment]) / (stops[segment + 1] - stops[segment]));
      const starX = starStops[segment] + (starStops[segment + 1] - starStops[segment]) * fraction;
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
          button.setAttribute("aria-label", `Show ${title} island`);
        });
        const upcoming = worlds[current + 1];
        nextLabel.textContent = current === scenes.length - 1 ? "back to the start" : "scroll down";
        next.setAttribute("aria-label", current === scenes.length - 1 ? "Back to the start"
          : upcoming.title ? `Scroll to the ${upcoming.title} island` : "Scroll to the end");
        next.dataset.last = String(current === scenes.length - 1);
      }
      // Wait for a settled shot; passing a world mid-flight must not rewrite
      // a destination hash or interfere with browser history restoration.
      if (!entryPending && !glideFrame && cameraProgress === progress && (crossing === 0 || crossing === 1)) {
        rememberIsland(worlds[current].id);
      }
      if (cameraProgress !== progress) schedule();
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    // Each stop rests just inside its hold, after its arrival has settled.
    const stopProgress = (index: number) =>
      (index === 0 ? 0 : index === scenes.length - 1 ? duration : index + 0.11) / duration;
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
      const focus = art[0].querySelector<HTMLElement>('[data-overview-island="work"]');
      if (focus && art[0].offsetWidth) {
        introFocus = {
          x: (focus.offsetLeft + focus.offsetWidth / 2) / art[0].offsetWidth * 100,
          y: (focus.offsetTop + focus.offsetHeight / 2) / art[0].offsetHeight * 100,
          size: focus.offsetWidth / art[0].offsetWidth * 100,
        };
      }
      // The opening and closing views have no tab: the star rests on the
      // track's start and end points instead, so home never reads as Work.
      const centers = buttons.map((button) => {
        const star = button.querySelector<HTMLElement>("[data-scene-stop]")!;
        return button.offsetLeft + star.offsetLeft + star.offsetWidth / 2;
      });
      const [trackStart, trackEnd] = Array.from(sceneNav.querySelectorAll<HTMLElement>("[data-track-end]"))
        .map((end) => end.offsetLeft + end.offsetWidth / 2);
      starStops = worlds.map((_, index) => {
        const tab = buttonScene.indexOf(index);
        return tab >= 0 ? centers[tab] : index < buttonScene[0] ? trackStart : trackEnd;
      });
      schedule();
    };
    // Glides are driven here rather than by the browser's smooth scroll, so
    // every flight starts instantly and eases in over a consistent length.
    let glideFrame = 0;
    const stopGlide = () => { window.cancelAnimationFrame(glideFrame); glideFrame = 0; };
    const jump = (index: number, instant = false) => {
      entryPending = false;
      window.clearTimeout(entryRecovery);
      if (index > 0) warm();
      stopGlide();
      // Safari can retain a pending smooth scroll when a quick second tap
      // targets the current position. Cancel that flight before starting one.
      window.scrollTo({ top: window.scrollY, behavior: "instant" });
      if (instant || motion.matches) {
        window.scrollTo({ top: start + stopProgress(index) * travel, behavior: "instant" });
        schedule();
        return;
      }
      // Glide in progress units and re-aim every frame, so a resize or a
      // phone rotation mid-flight still lands exactly on the stop.
      const from = clamp((window.scrollY - start) / travel);
      const to = stopProgress(index);
      const length = Math.min(900, 420 + Math.abs(to - from) * duration * 220);
      const began = performance.now();
      const step = (now: number) => {
        // A frame's timestamp can precede the call that started the glide.
        const t = clamp((now - began) / length);
        // Ease out: the camera answers immediately, then glides into the stop.
        const eased = 1 - Math.pow(1 - t, 4);
        window.scrollTo({ top: start + (from + (to - from) * eased) * travel, behavior: "instant" });
        glideFrame = t < 1 ? window.requestAnimationFrame(step) : 0;
        if (t >= 1) { schedule(); window.dispatchEvent(new Event("scrollend")); }
      };
      glideFrame = window.requestAnimationFrame(step);
    };
    // Scene controls always travel. Only islands and headings enter a page.
    jumpRef.current = (index: number) => jump(index);
    const advance = () => jump(activeIndex === scenes.length - 1 ? 0 : activeIndex + 1);
    const followHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash && cameraProgress === null) return;
      const index = !hash || hash === "constellation" ? 0 : worlds.findIndex((world) => world.id === hash);
      if (index >= 0) jump(index, true);
    };
    // A stop's heading enters its page exactly as its island does. This runs
    // on the window's capture phase, ahead of the rocket's generic link launch,
    // and re-dispatches the click on the island so both behave identically.
    const enterFromHeading = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a");
      if (link && stage.contains(link) && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        const destination = new URL(link.href);
        if (destination.origin === location.origin && worlds.some(world => destination.pathname === `/${world.id}`)) {
          // The overview uses a normal route transition. Hold this return
          // address while the old scene is still mounted (notably on Safari).
          entryPending = true;
          window.clearTimeout(entryRecovery);
          entryRecovery = window.setTimeout(() => { entryPending = false; schedule(); }, 8_000);
          rememberIsland(destination.pathname.slice(1));
        }
      }
      const heading = (event.target as Element | null)?.closest<HTMLAnchorElement>("[data-enter-island]");
      if (!heading || !stage.contains(heading) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const island = heading.closest("[data-island-scene]")?.querySelector<HTMLAnchorElement>("[data-island-link]");
      if (!island) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      island.click();
    };
    const engage = (event: Event) => {
      const pointer = event as PointerEvent;
      if (pointer.type.startsWith("pointer") && pointer.pointerType !== "mouse") return;
      const target = event.type === "pointerout" || event.type === "focusout" ? (event as FocusEvent).relatedTarget : event.target;
      const engaged = target instanceof Element && Boolean(target.closest('[data-island-scene][data-active="true"] [data-island-link]'));
      if (stage.dataset.engaged !== String(engaged)) stage.dataset.engaged = String(engaged);
      if (engaged && activeIndex >= 0) scenes[activeIndex].dataset.cueSeen = "true";
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
    window.addEventListener("popstate", followHash);
    motion.addEventListener("change", schedule);
    next.addEventListener("click", advance);
    window.addEventListener("click", enterFromHeading, true);
    ["pointerover", "pointerout", "focusin", "focusout"].forEach(type => stage.addEventListener(type, engage));
    // After the arrival cue is discovered, a mouse prompt follows the rocket;
    // the whole island stays the target and keyboard focus keeps its cue.
    const tip = stage.querySelector<HTMLElement>("[data-island-tip]")!;
    const tipText = tip.querySelector<HTMLElement>("[data-tip-text]")!;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const hideTip = () => { if (tip.dataset.visible) delete tip.dataset.visible; };
    const moveTip = (event: PointerEvent) => {
      const target = event.pointerType === "mouse" && finePointer.matches && !stage.dataset.entering && stage.dataset.travelling !== "true"
        ? (event.target as Element | null)?.closest<HTMLElement>('[data-island-scene][data-active="true"] [data-tip]')
        : null;
      if (!target) return hideTip();
      if (tipText.textContent !== target.dataset.tip) tipText.textContent = target.dataset.tip ?? "";
      // Anchor the annotation's star just off the rocket's right shoulder.
      // Open toward the island's own corner, flipping away from a screen edge.
      let side = target.dataset.tipSide ?? "ne";
      if (side.endsWith("e") && event.clientX > innerWidth - 300) side = `${side[0]}w`;
      else if (side.endsWith("w") && event.clientX < 300) side = `${side[0]}e`;
      if (side.startsWith("n") && event.clientY < 120) side = `s${side[1]}`;
      else if (side.startsWith("s") && event.clientY > innerHeight - 140) side = `n${side[1]}`;
      if (tip.dataset.side !== side) tip.dataset.side = side;
      const dx = side.endsWith("e") ? 26 : -26;
      const dy = side.startsWith("n") ? -14 : 18;
      tip.style.transform = `translate3d(${event.clientX + dx}px, ${event.clientY + dy}px, 0)`;
      tip.dataset.visible = "true";
    };
    stage.addEventListener("pointermove", moveTip);
    stage.addEventListener("pointerleave", hideTip);
    window.addEventListener("scroll", hideTip, { passive: true });
    const intents = ["wheel", "touchstart", "keydown"] as const;
    intents.forEach(type => window.addEventListener(type, warm, { passive: true, once: true }));
    sceneNav.addEventListener("focusin", warm);
    // When a scroll gesture comes to rest mid-flight, glide on to the next
    // stop in the direction you were going, so the page never stops between
    // islands. A tiny accidental nudge returns to where you were. Only real
    // gestures settle; links, tabs, and hash jumps are left alone.
    // No gesture yet: page timers start at zero, so 0 would read as "just now".
    let intentAt = Number.NEGATIVE_INFINITY;
    const nativeScrollEnd = "onscrollend" in window;
    let touching = false;
    let settling = false;
    let settleTimer = 0;
    let settleRelease = 0;
    let direction = 1;
    let lastScrollY = window.scrollY;
    const place = () => clamp((window.scrollY - start) / travel) * duration;
    const stopAt = (index: number) => stopProgress(index) * duration;
    const nearestStop = () => {
      const here = place();
      return scenes.reduce((best, _, index) => Math.abs(stopAt(index) - here) < Math.abs(stopAt(best) - here) ? index : best, 0);
    };
    const glideTo = (index: number) => {
      // The gesture is spent once its glide begins.
      intentAt = Number.NEGATIVE_INFINITY;
      settling = true;
      window.clearTimeout(settleRelease);
      settleRelease = window.setTimeout(() => { settling = false; }, 1000);
      jump(index);
    };
    const settle = () => {
      if (touching || stage.dataset.entering) return;
      const here = place();
      const nearest = nearestStop();
      if (Math.abs(stopAt(nearest) - here) < 0.04) {
        if (Math.abs(stopAt(nearest) - here) > 0.002) glideTo(nearest);
        return;
      }
      const ahead = direction > 0
        ? scenes.findIndex((_, index) => stopAt(index) > here)
        : scenes.map((_, index) => index).reverse().find((index) => stopAt(index) < here) ?? 0;
      glideTo(ahead < 0 ? scenes.length - 1 : ahead);
    };
    const onGestureScroll = () => {
      // The glide's own steps are not gestures and never set direction.
      if (glideFrame) { lastScrollY = window.scrollY; return; }
      if (window.scrollY !== lastScrollY) direction = window.scrollY > lastScrollY ? 1 : -1;
      lastScrollY = window.scrollY;
      if (settling || performance.now() - intentAt > 1200) return;
      // Browsers with a real scrollend settle when the gesture (and any
      // native wheel animation or momentum) has truly finished; others wait
      // for the scroll to go quiet.
      if (nativeScrollEnd) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, 120);
    };
    // A new wheel or touch takes over from any glide in progress.
    const markIntent = () => {
      intentAt = performance.now(); settling = false; stopGlide();
      if (!stage.dataset.entering && document.documentElement.dataset.rocketTransition === "idle") {
        entryPending = false; window.clearTimeout(entryRecovery);
      }
    };
    const onTouchStart = () => { touching = true; markIntent(); };
    const onTouchEnd = () => {
      touching = false;
      markIntent();
      // A tap without movement produces no scrollend; check once it's clear.
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, nativeScrollEnd ? 400 : 120);
    };
    // Each glide step ends a tiny native scroll; only the glide's own finish
    // (or a gesture's real end) releases the settle lock.
    const onScrollEnd = () => {
      if (glideFrame) return;
      window.clearTimeout(settleRelease);
      settling = false;
      if (nativeScrollEnd && !touching && performance.now() - intentAt < 1200) {
        window.clearTimeout(settleTimer);
        settle();
      }
    };
    // Keys move exactly one stop at a time.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { entryPending = false; window.clearTimeout(entryRecovery); schedule(); }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || stage.dataset.entering) return;
      const target0 = event.target as Element | null;
      if (target0?.closest("input, textarea, select, [contenteditable]")) return;
      // Space still presses a focused button or link.
      if (event.key === " " && target0?.closest("button, a")) return;
      const current = nearestStop();
      const forward = event.key === "ArrowDown" || event.key === "PageDown" || (event.key === " " && !event.shiftKey);
      const backward = event.key === "ArrowUp" || event.key === "PageUp" || (event.key === " " && event.shiftKey);
      const target = forward ? Math.min(current + 1, scenes.length - 1)
        : backward ? Math.max(current - 1, 0)
        : event.key === "Home" ? 0 : event.key === "End" ? scenes.length - 1 : -1;
      if (target < 0) return;
      event.preventDefault();
      glideTo(target);
    };
    window.addEventListener("wheel", markIntent, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("scroll", onGestureScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd);
    window.addEventListener("keydown", onKey);
    setReady(true);

    return () => {
      history.scrollRestoration = previousRestoration;
      window.removeEventListener("wheel", markIntent);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("scroll", onGestureScroll);
      window.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(settleTimer);
      window.clearTimeout(settleRelease);
      stopGlide();
      intents.forEach(type => window.removeEventListener(type, warm));
      sceneNav.removeEventListener("focusin", warm);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      window.removeEventListener("hashchange", followHash);
      window.removeEventListener("popstate", followHash);
      motion.removeEventListener("change", schedule);
      next.removeEventListener("click", advance);
      window.removeEventListener("click", enterFromHeading, true);
      ["pointerover", "pointerout", "focusin", "focusout"].forEach(type => stage.removeEventListener(type, engage));
      stage.removeEventListener("pointermove", moveTip);
      stage.removeEventListener("pointerleave", hideTip);
      window.removeEventListener("scroll", hideTip);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(starRestTimer);
      window.clearTimeout(entryRecovery);
      jumpRef.current = () => {};
    };
  }, [worlds]);

  return (
    <main ref={trackRef} id="islands" tabIndex={-1} className={styles.track} data-scene={worlds[0].id} aria-label="Three islands: work, writing, and projects">
      <div className={styles.stage} data-island-stage data-travelling="false" data-engaged="false" data-warm="false">
        <GalaxyBackground />
        <JourneyStars />
        <div className={styles.vignette} aria-hidden="true" />
        <span className={styles.islandTip} data-island-tip aria-hidden="true">
          <span className={styles.tipStar} />
          <span className={styles.tipLeader} />
          <span className={styles.tipText} data-tip-text />
        </span>
        {children}
        <div className={styles.controls}>
          <button type="button" className={styles.scrollHint} disabled={!ready} data-next-scene aria-label={`Scroll to the ${worlds[1].title} island`}>
            <span className={styles.scrollArrow} aria-hidden="true"><span className={styles.scrollStar} /></span>
            <span data-next-label>scroll down</span>
            <span className={styles.scrollArrow} aria-hidden="true"><span className={styles.scrollStar} /></span>
          </button>
          <nav className={styles.chapters} aria-label="Island scenes" data-scene-nav>
            <span className={styles.trackEnd} data-track-end="start" aria-hidden="true" />
            {worlds.map((world, index) => world.title ? (
              <button
                type="button"
                key={world.id}
                data-scene-button
                disabled={!ready}
                data-scene-index={index}
                aria-label={`Show ${world.title} island`}
                onClick={() => jumpRef.current(index)}
              >
                <span className={styles.chapterStar} data-scene-stop aria-hidden="true" />
                <span className={styles.chapterLabel}>{world.title}</span>
              </button>
            ) : null)}
            <span className={styles.trackEnd} data-track-end="end" aria-hidden="true" />
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
