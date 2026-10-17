import styles from "@/components/WorkEntry.module.css";
import { ENTRY_APPROACH_DURATION, ENTRY_ARRIVAL_DURATION } from "./island-entry-motion";
import { arriveEntryLight } from "./entry-light";

// Entering Work: the camera eases toward Taipei 101 in the rendered still,
// never past what the still can resolve, and the tower spells "Work" down its
// floors in light, as the real tower spells its messages. Then the letters
// lift off the tower and glide into the page's heading, the city dimming
// and softening behind them as the rest of the page arrives.
type Journey = { overlay: HTMLDivElement; dispose: () => void; reveal: () => void };
let journey: Journey | null = null;

// Gentle out of rest, then a long settle: most of the move reads as arriving.
export const WORK_PUSH_EASING = "cubic-bezier(0.48, -0.05, 0.2, 1)";

// How close the push gets: the tower and its neighbours fill the view, at
// about 2.4x on a laptop and 3x on a phone, never more than the render holds.
export function workPushScale(shownWidth: number, shownHeight: number) {
  const byHeight = innerHeight * .95 / (shownHeight * .6);
  const byWidth = innerWidth / (shownWidth * .38);
  return Math.max(1.6, Math.min(5, byHeight, byWidth));
}

// The stills on the page are sized for the island at rest. The push swaps in
// the full render, fetched once there is intent to enter.
const sharp = new Map<string, HTMLImageElement>();
const fullSource = (image: HTMLImageElement) => {
  try {
    const url = new URL(image.currentSrc || image.src, location.href);
    return url.pathname === "/_next/image" ? url.searchParams.get("url") : null;
  } catch { return null; }
};
const visibleStill = (visual: HTMLElement) => (document.documentElement.dataset.cityTime === "day"
  && visual.querySelector<HTMLImageElement>(':scope > img[data-city-time="day"]'))
  || visual.querySelector<HTMLImageElement>(":scope > img:not([data-city-time])");
export function prepareWorkEntry(visual: HTMLElement) {
  for (const image of visual.querySelectorAll<HTMLImageElement>(":scope > img")) {
    // Only the render on show is pushed into; the daytime one waits for day.
    if (image.dataset.cityTime === "day" && document.documentElement.dataset.cityTime !== "day") continue;
    const source = fullSource(image);
    if (!source || sharp.has(source)) continue;
    const full = new Image();
    full.decoding = "async";
    // Phones push ~2x into a ~470px still: a 2048px rendition holds up for a
    // one-second move at half the bytes of the 2880px original.
    full.src = matchMedia("(max-width: 760px)").matches
      ? `/_next/image?url=${encodeURIComponent(source)}&w=2048&q=86`
      : source;
    sharp.set(source, full);
    full.decode().catch(() => sharp.delete(source));
  }
}

// When the letters leave the tower, as a share of the approach.
const FLY = .5;

export function beginWorkEntry(visual: HTMLElement, camera?: Animation) {
  journey?.dispose();
  const overlay = document.createElement("div");
  overlay.className = styles.overlay;
  overlay.dataset.workTransition = "entering";
  overlay.dataset.time = document.documentElement.dataset.cityTime === "day" ? "day" : "night";
  overlay.setAttribute("aria-hidden", "true"); overlay.inert = true;
  // The destination, rendered from the same components as /work. The city
  // dims into the page's dark first, so the words never sit over the skyline.
  const dark = document.createElement("div");
  dark.className = styles.dark;
  const page = document.createElement("div");
  page.className = styles.page;
  page.dataset.workPreview = "true";
  // Lay the page in after the tap has painted its answer: copying and laying
  // out the whole page cost ~80ms on a throttled phone inside the tap. The
  // camera's glide runs on the compositor, so this work never stalls it.
  // The letters' flight is measured against it then, well before they leave.
  const source = document.querySelector("[data-work-window-content]");
  const layIn = () => { if (source && !page.childElementCount) page.append(...Array.from(source.children, child => child.cloneNode(true))); };
  let laidIn = () => {};
  const settle = () => { layIn(); laidIn(); };
  const layInLater = typeof requestIdleCallback === "function" ? requestIdleCallback(settle, { timeout: 400 }) : window.setTimeout(settle, 60);
  overlay.append(dark, page);
  document.body.append(overlay);
  document.documentElement.dataset.workTransition = "entering";

  // The full render, laid exactly over the still it sharpens.
  const still = visibleStill(visual);
  const full = still && sharp.get(fullSource(still) ?? "");
  let sharpened: HTMLImageElement | null = null;
  if (still && full?.complete && full.naturalWidth) {
    sharpened = still.cloneNode() as HTMLImageElement;
    sharpened.removeAttribute("srcset"); sharpened.removeAttribute("sizes"); sharpened.removeAttribute("loading");
    sharpened.src = full.src;
    sharpened.dataset.workSharp = "true";
    still.after(sharpened);
  }
  // The push draws the still itself, not the parallax canvas.
  visual.dataset.entryStill = "true";

  const timing = { duration: ENTRY_APPROACH_DURATION, fill: "forwards" as const };
  const letters = Array.from(visual.querySelectorAll<SVGTextElement>("[data-tower-letter]"));
  const spelled = Boolean(camera && letters.length);
  const animations = [
    // The tower lights "Work" down its floors, one letter at a time.
    ...(spelled ? letters.map((letter, index) => letter.animate([
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: .1 + index * .06 },
      { opacity: 1, offset: .14 + index * .06 },
      { opacity: 1, offset: FLY },
      { opacity: 0, offset: FLY + .001 },
      { opacity: 0, offset: 1 },
    ], timing)) : []),
    // Once the letters are in the air, the city behind them softens and
    // dims into the page's dark.
    ...(spelled ? [visual.animate([
      { filter: "blur(0px)", offset: 0 },
      { filter: "blur(0px)", offset: FLY + .08, easing: "ease-in-out" },
      { filter: "blur(4px)", offset: .9 },
      { filter: "blur(4px)", offset: 1 },
    ], timing)] : []),
    // Never quite 0: at 0.001 the browser still paints these full-screen
    // layers during the quiet start of the glide, instead of all at once
    // on the frame they first appear (which dropped frames as they came).
    dark.animate(spelled ? [
      { opacity: .001, offset: 0 },
      { opacity: .001, offset: FLY + .08, easing: "ease-in-out" },
      { opacity: .8, offset: .88 },
      { opacity: 1, offset: 1 },
    ] : [
      { opacity: .001, offset: 0 },
      { opacity: .001, offset: .7, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      { opacity: 1, offset: .9 },
      { opacity: 1, offset: 1 },
    ], timing),
    page.animate([
      { opacity: .001, offset: 0 },
      { opacity: .001, offset: spelled ? .76 : .78, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      { opacity: 1, offset: 1 },
    ], timing),
  ];
  // The letters' flight, built once the page is laid in to measure where
  // its heading sits, and kept in step with the camera.
  if (spelled) {
    overlay.dataset.spelled = "true";
    laidIn = () => { if (!disposed) animations.push(...flyLetters(overlay, page, letters, camera!)); };
  }
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout);
    if (typeof cancelIdleCallback === "function") cancelIdleCallback(layInLater); else clearTimeout(layInLater);
    animations.forEach(animation => animation.cancel());
    finish?.cancel();
    sharpened?.remove();
    delete visual.dataset.entryStill;
    overlay.remove();
    window.removeEventListener("keydown", skip);
    if (journey === current) { journey = null; delete document.documentElement.dataset.workTransition; }
  };
  let finish: Animation | undefined;
  const current: Journey = { overlay, dispose, reveal: dispose };
  journey = current;
  const timeout = window.setTimeout(dispose, 8000);
  function skip(event: KeyboardEvent) {
    if ((event.key === "Escape" || event.key === "Tab") && overlay.dataset.workTransition === "arriving") current.reveal();
  }
  window.addEventListener("keydown", skip);
  // The real page is already in place beneath; the copy fades off it.
  current.reveal = () => {
    if (disposed) return;
    layIn();
    arriveEntryLight();
    finish = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ENTRY_ARRIVAL_DURATION, easing: "ease-in-out", fill: "forwards" });
    void finish.finished.then(dispose).catch(() => {});
  };
  return { dispose };
}

// Each letter leaves the tower where it is lit when the flight begins (the
// camera is read at that moment and put straight back, before anything
// paints) and lands on its own letter of the page's heading, in the
// heading's face: it grows and cools from the tower's light to the page's
// ink as it comes, the letters a beat apart.
function flyLetters(overlay: HTMLElement, page: HTMLElement, letters: SVGTextElement[], camera: Animation) {
  const heading = page.querySelector("h1");
  const text = heading?.firstChild;
  if (!heading || !text || text.nodeType !== Node.TEXT_NODE || text.textContent?.length !== letters.length) return [];
  const range = document.createRange();
  const targets = letters.map((_, index) => {
    range.setStart(text, index);
    range.setEnd(text, index + 1);
    return range.getBoundingClientRect();
  });
  const style = getComputedStyle(heading);
  // The tower's light: gold at night, the sky's blue by day.
  const glow = overlay.dataset.time === "day" ? "141 182 220" : "255 185 92";
  const size = Number.parseFloat(style.fontSize);
  const now = camera.currentTime;
  camera.currentTime = FLY * ENTRY_APPROACH_DURATION;
  const sources = letters.map(letter => {
    const box = letter.getBoundingClientRect();
    const matrix = letter.getScreenCTM();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, size: Number(letter.getAttribute("font-size")) * Math.hypot(matrix?.a ?? 0, matrix?.b ?? 0), color: getComputedStyle(letter).fill };
  });
  camera.currentTime = now;
  const animations: Animation[] = [];
  letters.forEach((_, index) => {
    const target = targets[index], source = sources[index];
    const glyph = document.createElement("span");
    glyph.className = styles.letter;
    glyph.textContent = text.textContent![index];
    glyph.style.cssText = `left:${target.left}px;top:${target.top}px;width:${target.width}px;height:${target.height}px;font:${style.fontWeight} ${style.fontSize}/${target.height}px ${style.fontFamily};letter-spacing:${style.letterSpacing};color:${style.color}`;
    overlay.append(glyph);
    const dx = source.x - (target.left + target.width / 2), dy = source.y - (target.top + target.height / 2);
    const scale = source.size / size;
    // Each lifts off the tower toward you, brightening, then travels in a
    // gentle arc and settles into the line.
    const arc = Math.min(70, Math.hypot(dx, dy) * .12);
    const lift = scale * 1.35;
    const timing = { delay: FLY * ENTRY_APPROACH_DURATION + index * 55, duration: (1 - FLY) * ENTRY_APPROACH_DURATION - 3 * 55, fill: "both" as const };
    const animation = glyph.animate([
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(${scale})`, color: source.color, textShadow: `0 0 18px rgb(${glow} / .9)`, offset: 0 },
      { opacity: 1, transform: `translate(${dx}px, ${dy}px) scale(${scale})`, color: source.color, textShadow: `0 0 18px rgb(${glow} / .9)`, offset: .001, easing: "cubic-bezier(0.3, 0, 0.3, 1)" },
      { opacity: 1, transform: `translate(${dx}px, ${dy - 8}px) scale(${lift})`, color: source.color, textShadow: `0 0 26px rgb(${glow} / 1)`, offset: .18, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
      { opacity: 1, transform: `translate(${dx * .45}px, ${dy * .45 - arc}px) scale(${lift + (1 - lift) * .6})`, offset: .6 },
      { opacity: 1, transform: "none", color: style.color, textShadow: `0 0 0 rgb(${glow} / 0)`, offset: 1 },
    ], timing);
    // In step with the camera: same time, same pace (a second tap hurries both).
    animation.playbackRate = camera.playbackRate;
    animation.currentTime = camera.currentTime;
    if (camera.playState === "paused") animation.pause();
    animations.push(animation);
  });
  return animations;
}

export function arriveAtWork(content: HTMLElement) {
  const current = journey;
  if (!current || current.overlay.dataset.workTransition !== "entering") return;
  current.overlay.dataset.workTransition = "arriving";
  document.documentElement.dataset.workTransition = "arriving";
  // Two frames let Next apply destination scroll and layout before handoff.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (journey !== current || !content.isConnected) return;
    content.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    current.reveal();
  }));
}
