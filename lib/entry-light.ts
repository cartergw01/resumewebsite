import styles from "@/components/EntryLight.module.css";
import { ENTRY_APPROACH_DURATION, ENTRY_ARRIVAL_DURATION } from "./island-entry-motion";

// Entering an island happens in four beats: the island answers (a puff of
// stardust lifts off its landmark), the camera approaches, you pass through
// the landmark's own light, and the page condenses out of that light.
// This module owns the shared light. Everything animates transform and
// opacity only, so the compositor carries it and input stays responsive.

export type EntryWorld = "work" | "writing" | "projects";
type Light = { overlay: HTMLDivElement; bloom: HTMLDivElement; animations: Animation[]; arrived: boolean; dispose: () => void };

// Each world's light: Taipei's lit windows (or a clear afternoon), the
// reading lamp, the workshop monitor.
const tints: Record<EntryWorld | "work-day", [string, string]> = {
  work: ["#ffe2ad", "#f2b56a"],
  "work-day": ["#f4f8ff", "#b9cde6"],
  writing: ["#ffe6b8", "#e8a65a"],
  projects: ["#eaf4ff", "#8fb8ef"],
};

let light: Light | null = null;

export function beginEntryLight(world: EntryWorld, origin: { x: number; y: number }, day = false) {
  light?.dispose();
  const coarse = matchMedia("(pointer: coarse)").matches;
  const [core, edge] = tints[world === "work" && day ? "work-day" : world];
  const overlay = document.createElement("div");
  overlay.className = styles.overlay;
  overlay.dataset.entryLight = world;
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.setProperty("--core", core);
  overlay.style.setProperty("--edge", edge);
  // Writing and Projects carry their own object (the notebook, the deck)
  // through the threshold, so their light glows behind it; Work's camera
  // passes straight through the window, so its light is in front.
  overlay.dataset.layer = world === "work" ? "front" : "behind";

  const bloom = document.createElement("div");
  bloom.className = styles.bloom;
  overlay.append(bloom);

  // Stardust: a handful of motes lift off the landmark and drift outward.
  const animations: Animation[] = [];
  const count = coarse ? 9 : 16;
  for (let index = 0; index < count; index++) {
    const mote = document.createElement("span");
    mote.className = styles.mote;
    mote.style.left = `${origin.x}px`;
    mote.style.top = `${origin.y}px`;
    overlay.append(mote);
    // Evenly spread, gently biased upward, with a little variety per mote.
    const angle = -Math.PI / 2 + (index / count - .5) * Math.PI * 1.7 + Math.sin(index * 12.9898) * .25;
    const distance = (coarse ? 50 : 84) + ((index * 37) % 9) * (coarse ? 6 : 10);
    const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance - 18;
    const size = (coarse ? .6 : .9) + ((index * 53) % 7) / 10;
    animations.push(mote.animate([
      { transform: "translate(-50%, -50%) scale(.2)", opacity: 0 },
      { transform: `translate(calc(-50% + ${x * .45}px), calc(-50% + ${y * .45}px)) scale(${size})`, opacity: 1, offset: .25 },
      { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y - 26}px)) scale(${size * .55})`, opacity: 0 },
    ], { duration: 1150 + (index % 5) * 110, delay: (index % 4) * 45, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "both" }));
  }

  // The threshold: the light gathers late in the approach and holds until
  // the destination page is in place beneath it.
  // Work: the window's light opens until it fills the view, and the page is
  // laid in beneath it. Writing and Projects: a halo of lamp or screen light
  // grows behind the notebook or the deck.
  const front = world === "work";
  animations.push(bloom.animate(front ? [
    { opacity: .001, transform: "translate(-50%, -50%) scale(.2)" },
    { opacity: .001, transform: "translate(-50%, -50%) scale(.2)", offset: .55, easing: "cubic-bezier(0.55, 0, 0.45, 1)" },
    { opacity: .9, transform: "translate(-50%, -50%) scale(3.6)" },
  ] : [
    { opacity: 0, transform: "translate(-50%, -50%) scale(.3)" },
    { opacity: 0, transform: "translate(-50%, -50%) scale(.3)", offset: .3, easing: "cubic-bezier(0.3, 0, 0.3, 1)" },
    { opacity: .7, transform: "translate(-50%, -50%) scale(2.3)", offset: .8 },
    { opacity: .62, transform: "translate(-50%, -50%) scale(2.4)" },
  ], { duration: ENTRY_APPROACH_DURATION, fill: "forwards" }));

  document.body.append(overlay);
  let timeout = 0;
  const current: Light = { overlay, bloom, animations, arrived: false, dispose: () => {
    clearTimeout(timeout);
    current.animations.forEach(animation => animation.cancel());
    overlay.remove();
    window.removeEventListener("popstate", current.dispose);
    if (light === current) light = null;
  } };
  light = current;
  window.addEventListener("popstate", current.dispose);
  timeout = window.setTimeout(current.dispose, 12_000);
  return current.dispose;
}

// Writing and Projects carry their object over a dark backdrop of their own:
// the light moves in between the two, so it glows behind the notebook or the
// deck rather than under the dark.
export function holdEntryLight(container: HTMLElement, before: Element) {
  if (!light || light.overlay.dataset.layer !== "behind") return;
  light.overlay.dataset.layer = "held";
  container.insertBefore(light.overlay, before);
}

// The destination page is in place: the light thins away and reveals it.
export function arriveEntryLight(delay = 0) {
  const current = light;
  if (!current || current.arrived) return;
  current.arrived = true;
  const front = current.overlay.dataset.layer === "front";
  const from = getComputedStyle(current.bloom);
  // Through Work's window the light slowly clears off the page; behind the
  // notebook or deck it goes out with them, never lingering on the page.
  const fade = current.bloom.animate([
    { opacity: from.opacity, transform: from.transform === "none" ? "translate(-50%, -50%) scale(1.6)" : from.transform },
    { opacity: 0, transform: `translate(-50%, -50%) scale(${front ? 4.4 : 1.8})` },
  ], { duration: front ? ENTRY_ARRIVAL_DURATION : ENTRY_ARRIVAL_DURATION * .45, delay, easing: front ? "cubic-bezier(0.4, 0, 0.2, 1)" : "ease-out", fill: "forwards" });
  current.animations.push(fade);
  void fade.finished.then(() => { if (light === current) current.dispose(); }).catch(() => {});
}

export function cancelEntryLight() {
  light?.dispose();
}
