import styles from "@/components/WorkshopEntry.module.css";

type Entry = {
  overlay: HTMLDivElement;
  screen: HTMLDivElement;
  backdrop: HTMLDivElement;
  animations: Animation[];
  frames: number[];
  dispose: () => void;
};

// This one visual belongs to the journey, so it survives the source route.
// The destination takes it over once its real project screen is laid out.
let entry: Entry | null = null;
const plane = (x: number, y: number, width: number, height: number) =>
  `matrix(${width / 320},0,0,${height / 200},${x},${y})`;

export function beginWorkshopEntry(source: SVGImageElement) {
  const matrix = source.getScreenCTM();
  if (!matrix || matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  entry?.dispose();
  const overlay = document.createElement("div");
  overlay.className = styles.overlay;
  overlay.dataset.workshopTransition = "entering";
  overlay.setAttribute("aria-hidden", "true");
  const backdrop = document.createElement("div");
  backdrop.className = styles.backdrop;
  const screen = document.createElement("div");
  screen.className = styles.screen;
  const image = document.createElement("img");
  image.src = source.href.baseVal;
  image.alt = "";
  screen.append(image);
  overlay.append(backdrop, screen);
  document.body.append(overlay);
  document.documentElement.dataset.workshopTransition = "entering";

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let timeout = 0;
  const current: Entry = { overlay, screen, backdrop, animations: [], frames: [], dispose: () => {
    clearTimeout(timeout);
    current.frames.forEach(cancelAnimationFrame);
    current.animations.forEach(animation => animation.cancel());
    overlay.remove();
    window.removeEventListener("popstate", current.dispose);
    window.removeEventListener("resize", current.dispose);
    motion.removeEventListener("change", current.dispose);
    if (entry === current) {
      delete document.documentElement.dataset.workshopTransition;
      entry = null;
    }
  } };
  entry = current;
  window.addEventListener("popstate", current.dispose);
  window.addEventListener("resize", current.dispose);
  motion.addEventListener("change", current.dispose);
  timeout = window.setTimeout(current.dispose, 8_000);

  const width = Math.min(innerWidth * 0.88, innerHeight * 0.92, 1040);
  const height = width / 1.6;
  screen.style.transform = plane((innerWidth - width) / 2, (innerHeight - height) / 2, width, height);
  current.animations.push(screen.animate([
    { transform: `matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.e},${matrix.f})` },
    { transform: screen.style.transform },
  ], { duration: 720, easing: "cubic-bezier(0.22, 0.65, 0.24, 1)", fill: "forwards" }));
  current.animations.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: "ease-in-out", fill: "forwards" }));
  return current.dispose;
}

export function arriveAtWorkshop(target: HTMLElement) {
  const current = entry;
  if (!current || current.overlay.dataset.workshopTransition !== "entering") return;
  current.overlay.dataset.workshopTransition = "arriving";
  document.documentElement.dataset.workshopTransition = "arriving";
  // Wait for Next's scroll restoration and the destination layout together.
  current.frames.push(requestAnimationFrame(() => {
    current.frames.push(requestAnimationFrame(() => {
      if (entry !== current || !target.isConnected) return;
      const bounds = target.getBoundingClientRect();
      const from = getComputedStyle(current.screen).transform;
      const dock = current.screen.animate([
        { transform: from },
        { transform: plane(bounds.x, bounds.y, bounds.width, bounds.height) },
      ], { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
      current.animations.push(dock, current.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 560, easing: "ease-out", fill: "forwards" }));
      void dock.finished.then(() => {
        if (entry !== current) return;
        document.documentElement.dataset.workshopTransition = "revealing";
        target.closest<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
        current.dispose();
      }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
    }));
  }));
}
