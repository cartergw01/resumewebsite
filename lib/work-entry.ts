import styles from "@/components/WorkEntry.module.css";
import { ENTRY_APPROACH_DURATION, ENTRY_ARRIVAL_DURATION } from "./island-entry-motion";

// Entering Work is a camera push, not a dive: the island eases toward Taipei
// 101 in the rendered still, and the page dissolves in over the second half.
// The push stays within what the still can resolve, so nothing goes soft.
type Journey = { overlay: HTMLDivElement; dispose: () => void; reveal: () => void };
let journey: Journey | null = null;

// Gentle out of rest, then a long settle: most of the move reads as arriving.
export const WORK_PUSH_EASING = "cubic-bezier(0.3, 0, 0.15, 1)";

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

export function beginWorkEntry(visual: HTMLElement) {
  journey?.dispose();
  const overlay = document.createElement("div");
  overlay.className = styles.overlay;
  overlay.dataset.workTransition = "entering";
  overlay.dataset.time = document.documentElement.dataset.cityTime === "day" ? "day" : "night";
  overlay.setAttribute("aria-hidden", "true"); overlay.inert = true;
  // A faint wash of the hour's light: lamplight at night, steel by day.
  const wash = document.createElement("div");
  wash.className = styles.wash;
  // The destination, rendered from the same components as /work. The city
  // dims into the page's dark first, so the words never sit over the skyline.
  const dark = document.createElement("div");
  dark.className = styles.dark;
  const page = document.createElement("div");
  page.className = styles.page;
  page.dataset.workPreview = "true";
  const source = document.querySelector("[data-work-window-content]");
  if (source) page.append(...Array.from(source.children, child => child.cloneNode(true)));
  overlay.append(wash, dark, page);
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
  // The push draws the still itself, not the parallax canvas; a turned 3D
  // view settles back into the render it was turned from.
  visual.dataset.entryStill = "true";
  const orbit = visual.dataset.orbitLive === "true" ? visual.querySelector<HTMLCanvasElement>("[data-island-orbit]") : null;

  const timing = { duration: ENTRY_APPROACH_DURATION, fill: "forwards" as const };
  const animations = [
    dark.animate([
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: .38, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      { opacity: 1, offset: .8 },
      { opacity: 1, offset: 1 },
    ], timing),
    page.animate([
      { opacity: 0, transform: "scale(1.04)", offset: 0 },
      { opacity: 0, transform: "scale(1.04)", offset: .58, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      { opacity: 1, transform: "scale(1)", offset: 1 },
    ], timing),
    wash.animate([
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: .3, easing: "ease-in-out" },
      { opacity: 1, offset: .7, easing: "ease-in-out" },
      { opacity: 0, offset: 1 },
    ], timing),
    ...(orbit ? [orbit.animate([{ opacity: 1 }, { opacity: 0, offset: .3 }, { opacity: 0 }], timing)] : []),
  ];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout);
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
    finish = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ENTRY_ARRIVAL_DURATION, easing: "ease-in-out", fill: "forwards" });
    void finish.finished.then(dispose).catch(() => {});
  };
  return { dispose };
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
