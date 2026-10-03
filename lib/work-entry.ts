import { windowCameraFor, type ScreenMatrix, type WindowFlight } from "./island-orbit-bridge";
import styles from "@/components/WorkEntry.module.css";

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
  const endScale = Math.max(innerWidth / width, innerHeight / height) * 2;
  const visibility = visual.style.visibility;
  return {
    sample(progress) {
      const t = smooth((progress - .08) / .92);
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
  const animation = overlay.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1650, fill: "forwards" });
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
    // The warm occupied office resolves into a readable interior as we reach
    // the glass. Content remains at its destination size behind the opening.
    glass.style.opacity = String(1 - smooth((progress - .5) / .25));
    preview.style.opacity = String(smooth((progress - .46) / .22));
  };
  const tick = () => {
    if (disposed) return;
    sample(Math.min(1, Number(animation.currentTime ?? 0) / 1650));
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
    finishAnimation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
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
