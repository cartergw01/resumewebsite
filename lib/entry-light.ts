import styles from "@/components/EntryLight.module.css";
import { ENTRY_APPROACH_DURATION, ENTRY_ARRIVAL_DURATION } from "./island-entry-motion";

// Entering an island happens in four beats: the island answers (a puff of
// stardust lifts off its landmark), the camera approaches, the landmark's
// own object carries you through (Taipei's lit letters, the notebook, the
// deck), and the page condenses out of it.
// This module owns the shared light. Everything animates transform and
// opacity only, so the compositor carries it and input stays responsive.

export type EntryWorld = "work" | "writing" | "projects";
type Light = { overlay: HTMLDivElement; bloom: HTMLDivElement | null; animations: Animation[]; arrived: boolean; dispose: () => void };

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
  // Each island carries its own object (Taipei's letters, the notebook, the
  // deck) through the threshold, so the light glows behind it. Taipei's
  // letters carry their own light: it has no halo.
  overlay.dataset.layer = "behind";
  const bloom = world === "work" ? null : document.createElement("div");
  if (bloom) { bloom.className = styles.bloom; overlay.append(bloom); }

  // Stardust: a handful of motes lift off the landmark and drift outward.
  // Taipei by night answers with a burst off its spire instead (CityFireworks).
  const animations: Animation[] = [];
  const count = world === "work" && !day ? 0 : coarse ? 9 : 16;
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
    ], { duration: 640 + (index % 5) * 60, delay: (index % 4) * 25, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "both" }));
  }

  // The threshold: a halo of lamp or screen light grows behind the notebook
  // or the deck, and holds until the page is in place.
  // A glow, not a wash: at .7 it filled a phone's screen near-white.
  if (bloom) animations.push(bloom.animate([
    { opacity: 0, transform: "translate(-50%, -50%) scale(.3)" },
    { opacity: 0, transform: "translate(-50%, -50%) scale(.3)", offset: .3, easing: "cubic-bezier(0.3, 0, 0.3, 1)" },
    { opacity: .42, transform: "translate(-50%, -50%) scale(2.3)", offset: .8 },
    { opacity: .38, transform: "translate(-50%, -50%) scale(2.4)" },
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
  if (!current.bloom) { current.dispose(); return; }
  const from = getComputedStyle(current.bloom);
  // It goes out with what it carried, never lingering on the page, and
  // starts gently: an ease-out dropped most of its light in one frame.
  const fade = current.bloom.animate([
    { opacity: from.opacity, transform: from.transform === "none" ? "translate(-50%, -50%) scale(1.6)" : from.transform },
    { opacity: 0, transform: "translate(-50%, -50%) scale(1.8)" },
  ], { duration: ENTRY_ARRIVAL_DURATION * .6, delay, easing: "cubic-bezier(0.45, 0, 0.55, 1)", fill: "forwards" });
  current.animations.push(fade);
  void fade.finished.then(() => { if (light === current) current.dispose(); }).catch(() => {});
}

export function cancelEntryLight() {
  light?.dispose();
}
