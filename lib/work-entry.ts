import { artworkTransform } from "./artwork-perspective";
import styles from "@/components/WorkEntry.module.css";

type Journey = {
  overlay: HTMLDivElement;
  pane: HTMLDivElement;
  glazing: HTMLDivElement;
  spark: HTMLDivElement;
  animations: Animation[];
  frames: number[];
  reveal: () => void;
  dispose: () => void;
};

// A single piece of the tower's glazing survives the route change. It uses
// camera-projected corners, so the journey begins on the actual Blender facade.
let journey: Journey | null = null;
const SVG = "http://www.w3.org/2000/svg";
const sparkShape = "M6 0C6.6 4.6 7.4 5.4 12 6C7.4 6.6 6.6 7.4 6 12C5.4 7.4 4.6 6.6 0 6C4.6 5.4 5.4 4.6 6 0Z";

function makeSpark() {
  const spark = document.createElement("div");
  spark.className = styles.spark;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", sparkShape);
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  spark.append(svg);
  return spark;
}

export function beginWorkEntry(source: SVGGraphicsElement) {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const matrix = source.getScreenCTM();
  const corners: number[][] = JSON.parse(source.dataset.corners ?? "[]");
  if (motion.matches || !matrix || corners.length !== 4) return null;
  journey?.dispose();
  const viewportCorners = corners.map(([x, y]) => [matrix.a * x + matrix.c * y + matrix.e, matrix.b * x + matrix.d * y + matrix.f]);
  const overlay = document.createElement("div");
  overlay.className = styles.overlay;
  overlay.dataset.workTransition = "entering";
  overlay.setAttribute("aria-hidden", "true");
  overlay.inert = true;
  const pane = document.createElement("div");
  pane.className = styles.window;
  pane.dataset.cityWindow = "true";
  const spark = makeSpark();
  const preview = document.createElement("div");
  preview.className = styles.preview;
  const sourceContent = document.querySelector("[data-work-window-content]");
  if (sourceContent) preview.append(...Array.from(sourceContent.children, child => child.cloneNode(true)));
  const glazing = document.createElement("div");
  glazing.className = styles.glazing;
  pane.append(preview, glazing, spark);
  overlay.append(pane);
  document.body.append(overlay);
  document.documentElement.dataset.workTransition = "entering";
  let timeout = 0;
  let disposed = false;
  const current: Journey = { overlay, pane, glazing, spark, animations: [], frames: [], reveal: () => {}, dispose: () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout);
    current.frames.forEach(cancelAnimationFrame);
    current.animations.forEach(animation => animation.cancel());
    overlay.remove();
    window.removeEventListener("popstate", current.dispose);
    window.removeEventListener("resize", current.dispose);
    window.removeEventListener("keydown", dismiss);
    motion.removeEventListener("change", current.dispose);
    if (journey === current) {
      delete document.documentElement.dataset.workTransition;
      journey = null;
    }
  } };
  journey = current;
  function dismiss(event: KeyboardEvent) {
    // During the approach, IslandLink owns Escape and restores the island.
    if ((event.key === "Escape" || event.key === "Tab") && overlay.dataset.workTransition === "arriving") current.reveal();
  }
  window.addEventListener("popstate", current.dispose);
  window.addEventListener("resize", current.dispose);
  window.addEventListener("keydown", dismiss);
  motion.addEventListener("change", current.dispose);
  timeout = window.setTimeout(current.dispose, 8000);
  const flight = pane.animate([
    { transform: artworkTransform(viewportCorners, innerWidth, innerHeight) },
    { transform: "matrix(1,0,0,1,0,0)" },
  ], { duration: 850, easing: "cubic-bezier(0.64, 0, 0.22, 1)", fill: "forwards" });
  current.animations.push(flight, spark.animate([
    { opacity: 0, transform: "scale(0.3) rotate(-30deg)" },
    { opacity: 1, transform: "scale(1.2) rotate(0deg)", offset: 0.7 },
    { opacity: 1, transform: "scale(1) rotate(0deg)" },
  ], { duration: 850, fill: "forwards" }));
  return current.dispose;
}

export function arriveAtWork(target: Element, content: HTMLElement) {
  const current = journey;
  if (!current || current.overlay.dataset.workTransition !== "entering") return;
  current.overlay.dataset.workTransition = "arriving";
  // Wait for both the carried window and Next's destination scroll/layout.
  void Promise.all(current.animations.map(animation => animation.finished)).then(() => {
    current.frames.push(requestAnimationFrame(() => {
      current.frames.push(requestAnimationFrame(() => {
        if (journey !== current || !target.isConnected) return;
        revealWork(current, target, content);
      }));
    }));
  }).catch(() => { /* Resizing, back or reduced motion can end the journey. */ });
}

function revealWork(current: Journey, target: Element, content: HTMLElement) {
  document.documentElement.dataset.workTransition = "arriving";
  const destination = target.getBoundingClientRect();
  const end = { x: destination.x + destination.width / 2, y: destination.y + destination.height / 2 };
  const start = { x: innerWidth / 2, y: innerHeight / 2 };
  // The same spark leaves the window on a shallow arc and rests at the crown
  // of the small Taipei mark. No random particles or full-screen flash.
  const control = { x: end.x + (start.x - end.x) * 0.16, y: Math.max(36, end.y - 80) };
  const point = (t: number) => ({
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
  });
  const svg = document.createElementNS(SVG, "svg");
  svg.classList.add(styles.flight);
  svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
  const trail = document.createElementNS(SVG, "path");
  trail.classList.add(styles.trail);
  trail.setAttribute("d", `M${start.x} ${start.y}Q${control.x} ${control.y} ${end.x} ${end.y}`);
  svg.append(trail);
  current.overlay.append(svg);
  const length = trail.getTotalLength();
  trail.style.strokeDasharray = `${length * 0.16} ${length}`;
  const spark = makeSpark();
  spark.dataset.workArrivalSpark = "true";
  current.overlay.append(spark);
  current.spark.style.visibility = "hidden";
  const finish = () => {
    const heading = content.querySelector<HTMLElement>("h1");
    current.dispose();
    if (heading?.isConnected) heading.focus({ preventScroll: true });
  };
  current.reveal = finish;
  const easing = "cubic-bezier(0.22, 0.7, 0.25, 1)";
  const dock = spark.animate(Array.from({ length: 25 }, (_, index) => {
    const t = index / 24;
    const p = point(t);
    return { transform: `translate(${p.x - 6}px, ${p.y - 6}px) scale(${1 - t * 0.55}) rotate(${t * 90}deg)` };
  }), { duration: 680, easing, fill: "forwards" });
  current.animations.push(dock,
    trail.animate([
      { strokeDashoffset: length * 0.16, opacity: 0 },
      { opacity: 0.55, offset: 0.15 },
      { opacity: 0.35, offset: 0.7 },
      { strokeDashoffset: -length, opacity: 0 },
    ], { duration: 680, easing, fill: "forwards" }),
    current.pane.animate([
      { opacity: 1 },
      { opacity: 0 },
    ], { duration: 460, easing: "cubic-bezier(0.3, 0, 0.2, 1)", fill: "forwards" }),
    current.glazing.animate([
      { transform: "scale(1)", opacity: 1 },
      { transform: "scale(1.6)", opacity: 0 },
    ], { duration: 460, easing, fill: "forwards" }),
  );
  void dock.finished.then(finish).catch(() => { /* Disposing cancels the arrival. */ });
}
