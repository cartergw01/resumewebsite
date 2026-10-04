import { windowCameraFor, type ScreenMatrix, type WindowFlight } from "./island-orbit-bridge";
import styles from "@/components/WorkEntry.module.css";
import { artworkTransform } from "./artwork-perspective";
import { WORK_ENTRY_DURATION, workApproach } from "./work-entry-motion";

const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const svgNS = "http://www.w3.org/2000/svg";
type Journey = { overlay: HTMLDivElement; animation: Animation; dispose: () => void; reveal: () => void };
let journey: Journey | null = null;

// A connection without a ready 3D model follows the same window in the still.
// Image and opening share one transform; the window never detaches and floats.
function stillCamera(visual: HTMLElement, host: HTMLElement, matrix: ScreenMatrix, corners: number[][]): WindowFlight {
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
  svg.classList.add(styles.still);
  const image = document.createElementNS(svgNS, "image");
  const poster = visual.querySelector("img")!;
  image.setAttribute("href", poster.currentSrc || poster.src);
  image.setAttribute("width", "1200"); image.setAttribute("height", "800");
  image.style.filter = getComputedStyle(visual.querySelector("img")!).filter;
  svg.append(image); host.prepend(svg);
  const initial = corners.map(([x, y]) => [matrix.a * x + matrix.c * y + matrix.e, matrix.b * x + matrix.d * y + matrix.f]);
  const center = initial.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
  const width = Math.hypot(initial[1][0] - initial[0][0], initial[1][1] - initial[0][1]);
  const height = Math.hypot(initial[2][0] - initial[0][0], initial[2][1] - initial[0][1]);
  const endScale = Math.max(innerWidth / width, innerHeight / height) * 1.2;
  const visibility = visual.style.visibility;
  return {
    sample(progress) {
      const t = workApproach(progress);
      const scale = Math.pow(endScale, t);
      const x = center[0] + (innerWidth / 2 - center[0]) * smooth(t * 2);
      const y = center[1] + (innerHeight / 2 - center[1]) * smooth(t * 2);
      const dx = x - center[0] * scale, dy = y - center[1] * scale;
      image.setAttribute("transform", `matrix(${matrix.a * scale} ${matrix.b * scale} ${matrix.c * scale} ${matrix.d * scale} ${matrix.e * scale + dx} ${matrix.f * scale + dy})`);
      visual.style.visibility = "hidden";
      return initial.map(([a, b]) => [a * scale + dx, b * scale + dy]);
    },
    dispose() { visual.style.visibility = visibility; svg.remove(); },
  };
}

// The page lives inside the window, rather than being cut out of a full-size
// page behind it. Preserve its aspect ratio and let its perspective gently
// flatten only as the opening reaches the edges of the screen.
function contentThroughWindow(points: number[][], width: number, height: number) {
  const [a, b, c, d] = points;
  const spanX = (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(d[0] - c[0], d[1] - c[1])) / 2;
  const spanY = (Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.hypot(d[0] - b[0], d[1] - b[1])) / 2;
  const fit = Math.min(spanX / width, spanY / height);
  // Ease the last quarter into its final size with zero closing velocity.
  // A hard min(1, fit) would visibly stop the page while the camera still moves.
  const settle = Math.max(0, Math.min(1, (fit - .75) / .25));
  const scale = fit < .75 ? fit : .75 + .25 * (settle + settle * settle - settle * settle * settle);
  const u = (1 - scale * width / spanX) / 2;
  const v = (1 - scale * height / spanY) / 2;
  const flatten = smooth((fit - .55) / .45);
  const corners = [[u, v], [1 - u, v], [u, 1 - v], [1 - u, 1 - v]].map(([x, y], i) => {
    const projected = [0, 1].map(axis => (a[axis] * (1 - x) + b[axis] * x) * (1 - y) + (c[axis] * (1 - x) + d[axis] * x) * y);
    const flat = [(width - width * scale) / 2 + (i % 2) * width * scale, (height - height * scale) / 2 + Math.floor(i / 2) * height * scale];
    return projected.map((value, axis) => value + (flat[axis] - value) * flatten);
  });
  return { transform: artworkTransform(corners, width, height), fit };
}

export function beginWorkEntry(source: SVGGraphicsElement, visual: HTMLElement) {
  const matrix = source.getScreenCTM();
  const corners: number[][] = JSON.parse(source.dataset.corners ?? "[]");
  if (!matrix || corners.length !== 4) return null;
  journey?.dispose();
  const overlay = document.createElement("div");
  overlay.className = styles.overlay;
  overlay.dataset.workTransition = "entering";
  overlay.setAttribute("aria-hidden", "true"); overlay.inert = true;
  const opening = document.createElement("div");
  opening.className = styles.window; opening.dataset.cityWindow = "true";
  const preview = document.createElement("div");
  preview.className = styles.preview;
  preview.dataset.workPreview = "true";
  const sourceContent = document.querySelector("[data-work-window-content]");
  if (sourceContent) preview.append(...Array.from(sourceContent.children, child => child.cloneNode(true)));
  const glass = document.createElement("div"); glass.className = styles.glazing;
  opening.append(preview, glass); overlay.append(opening);
  document.body.append(overlay);
  document.documentElement.dataset.workTransition = "entering";
  const camera = windowCameraFor(visual);
  const flight = camera ? camera(overlay, matrix) : stillCamera(visual, overlay, matrix, corners);
  overlay.dataset.workCamera = camera ? "3d" : "still";
  // One clock drives the actual camera and the opening's projection. Keeping
  // it in the Web Animations timeline also respects document suspension.
  const animation = overlay.animate([{ opacity: 1 }, { opacity: 1 }], { duration: WORK_ENTRY_DURATION, fill: "forwards" });
  let frame = 0, disposed = false;
  let finishAnimation: Animation | undefined;
  let lastProgress = -1;
  const sample = (progress: number) => {
    if (progress === lastProgress) return;
    lastProgress = progress;
    const points = flight.sample(progress);
    opening.style.clipPath = `polygon(${[0, 1, 3, 2].map(i => `${points[i][0]}px ${points[i][1]}px`).join(",")})`;
    opening.dataset.corners = JSON.stringify(points);
    overlay.dataset.workProgress = progress.toFixed(3);
    const content = contentThroughWindow(points, innerWidth, innerHeight);
    preview.style.transform = content.transform;
    // Reveal by the physical opening's size, so both the real camera and the
    // lightweight fallback clear the glass when the contents are legible.
    glass.style.opacity = String(1 - smooth((content.fit - .07) / .48));
  };
  const tick = () => {
    if (disposed) return;
    sample(Math.min(1, Number(animation.currentTime ?? 0) / WORK_ENTRY_DURATION));
    if (animation.playState !== "finished") frame = requestAnimationFrame(tick);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    animation.cancel(); finishAnimation?.cancel();
    flight.dispose(); overlay.remove();
    window.removeEventListener("keydown", skip);
    if (journey === current) { journey = null; delete document.documentElement.dataset.workTransition; }
  };
  const current: Journey = { overlay, animation, dispose, reveal: dispose };
  journey = current;
  const timeout = window.setTimeout(dispose, 8000);
  function skip(event: KeyboardEvent) {
    if ((event.key === "Escape" || event.key === "Tab") && overlay.dataset.workTransition === "arriving") current.reveal();
  }
  window.addEventListener("keydown", skip);
  sample(0); frame = requestAnimationFrame(tick);
  void animation.finished.then(() => { if (!disposed) sample(1); }).catch(() => {});
  // Arrival replaces only the pixels already visible through the window.
  current.reveal = () => {
    if (disposed) return;
    finishAnimation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: "forwards" });
    void finishAnimation.finished.then(dispose).catch(() => {});
  };
  return { animation, dispose };
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
