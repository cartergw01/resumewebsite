import { windowCameraFor, type ScreenMatrix, type WindowFlight } from "./island-orbit-bridge";
import styles from "@/components/WorkEntry.module.css";
import { artworkTransform } from "./artwork-perspective";
import { workApproach, workAlignment } from "./work-entry-motion";
import { ENTRY_APPROACH_DURATION, ENTRY_ARRIVAL_DURATION } from "./island-entry-motion";

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
  const placement = new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]);
  // Align the two window edges with a small affine correction. A perspective
  // warp solved from this tiny pane would severely distort the wider island.
  const upright = new DOMMatrix([
    (initial[1][0] - initial[0][0]) / width, (initial[1][1] - initial[0][1]) / width,
    (initial[2][0] - initial[0][0]) / height, (initial[2][1] - initial[0][1]) / height,
    0, 0,
  ]).inverse();
  const endScale = Math.max(innerWidth / width, innerHeight / height) * 1.2;
  const visibility = visual.style.visibility;
  return {
    sample(progress) {
      const t = workApproach(progress);
      const alignment = workAlignment(progress);
      const scale = Math.pow(endScale, t);
      const x = center[0] + (innerWidth / 2 - center[0]) * smooth(t * 2);
      const y = center[1] + (innerHeight / 2 - center[1]) * smooth(t * 2);
      // Straighten the facade and opening together, preserving their connection
      // instead of enlarging the poster's original slant all the way to arrival.
      const correction = new DOMMatrix([
        1 + (upright.a - 1) * alignment, upright.b * alignment,
        upright.c * alignment, 1 + (upright.d - 1) * alignment, 0, 0,
      ]);
      const transform = new DOMMatrix().translate(x, y).scale(scale).multiply(correction).translate(-center[0], -center[1]);
      const posterTransform = transform.multiply(placement);
      image.setAttribute("transform", posterTransform.toString());
      visual.style.visibility = "hidden";
      return initial.map(([a, b]) => {
        const point = transform.transformPoint(new DOMPoint(a, b));
        return [point.x, point.y];
      });
    },
    dispose() { visual.style.visibility = visibility; svg.remove(); },
  };
}

// Keep the page upright inside the opening. Fit a level rectangle inside all
// four edges, so the facade's perspective never skews readable type.
function contentThroughWindow(points: number[][], width: number, height: number) {
  const center = points.reduce((sum, point) => [sum[0] + point[0] / 4, sum[1] + point[1] / 4], [0, 0]);
  const polygon = [points[0], points[1], points[3], points[2]];
  const fit = Math.min(...polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const distance = Math.abs(dx * (center[1] - a[1]) - dy * (center[0] - a[0]));
    return distance / (Math.abs(dx) * height / 2 + Math.abs(dy) * width / 2);
  }));
  // Ease the last quarter into its final size with zero closing velocity.
  // A hard min(1, fit) would visibly stop the page while the camera still moves.
  const settle = Math.max(0, Math.min(1, (fit - .75) / .25));
  const scale = fit < .75 ? fit : .75 + .25 * (settle + settle * settle - settle * settle * settle);
  const settleCenter = smooth((fit - .55) / .45);
  const x = center[0] + (width / 2 - center[0]) * settleCenter - width * scale / 2;
  const y = center[1] + (height / 2 - center[1]) * settleCenter - height * scale / 2;
  return { transform: `matrix(${scale},0,0,${scale},${x},${y})`, fit };
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
  const reflection = document.createElement("div"); reflection.className = styles.reflection;
  glass.append(reflection);
  const flare = document.createElement("div"); flare.className = styles.flare;
  opening.append(preview, glass); overlay.append(opening, flare);
  document.body.append(overlay);
  document.documentElement.dataset.workTransition = "entering";
  const camera = windowCameraFor(visual);
  const flight = camera ? camera(overlay, matrix) : stillCamera(visual, overlay, matrix, corners);
  overlay.dataset.workCamera = camera ? "3d" : "still";
  // One clock drives the actual camera and the opening's projection. Keeping
  // it in the Web Animations timeline also respects document suspension.
  const animation = overlay.animate([{ opacity: 1 }, { opacity: 1 }], { duration: ENTRY_APPROACH_DURATION, fill: "forwards" });
  // Start the clock now. Waiting for the compositor's first full-size 3D frame
  // can otherwise add a cold-GPU delay that the book and screen don't have.
  animation.startTime = document.timeline.currentTime;
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
    // The reflection belongs to the pane, including its perspective after an
    // orbit. It slips across the glass as the camera squares up to the facade.
    glass.style.transform = artworkTransform(points, 1000, 1000);
    reflection.style.transform = `translate3d(${38 - smooth((progress - .35) / .4) * 78}%,0,0)`;
    // Reveal by the physical opening's size, so both the real camera and the
    // lightweight fallback clear the glass when the contents are legible.
    glass.style.opacity = String(1 - smooth((content.fit - .07) / .48));
    // A warm wash peaks as the camera passes through the pane, then clears.
    const center = points.reduce((sum, point) => [sum[0] + point[0] / 4, sum[1] + point[1] / 4], [0, 0]);
    flare.style.setProperty("--flare-x", `${center[0]}px`);
    flare.style.setProperty("--flare-y", `${center[1]}px`);
    flare.style.opacity = (.85 * smooth((content.fit - .06) / .2) * (1 - smooth((content.fit - .34) / .4))).toFixed(3);
  };
  const tick = () => {
    if (disposed) return;
    sample(Math.min(1, Number(animation.currentTime ?? 0) / ENTRY_APPROACH_DURATION));
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
    finishAnimation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ENTRY_ARRIVAL_DURATION, easing: "ease-in-out", fill: "forwards" });
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
