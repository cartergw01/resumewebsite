import styles from "@/components/WorkshopEntry.module.css";

type Entry = {
  kind: "workshop" | "book";
  width: number;
  height: number;
  overlay: HTMLDivElement;
  screen: HTMLDivElement;
  backdrop: HTMLDivElement;
  animations: Animation[];
  frames: number[];
  dispose: () => void;
};

// This one visual belongs to the journey, so it survives the source route.
// The destination takes it over once its real screen or essay is laid out.
let entry: Entry | null = null;
const plane = (x: number, y: number, width: number, height: number, sourceWidth: number, sourceHeight: number) =>
  `matrix(${width / sourceWidth},0,0,${height / sourceHeight},${x},${y})`;

export function beginWorkshopEntry(source: SVGImageElement) {
  const image = document.createElement("img");
  image.src = source.href.baseVal;
  image.alt = "";
  return beginEntry(source, image, "workshop", 320, 200);
}

export function beginBookEntry(source: SVGSVGElement) {
  const paper = source.cloneNode(true) as SVGSVGElement;
  paper.removeAttribute("data-book-page");
  return beginEntry(source, paper, "book", 320, 400);
}

function beginEntry(source: SVGGraphicsElement, content: Element, kind: Entry["kind"], sourceWidth: number, sourceHeight: number) {
  const matrix = source.getScreenCTM();
  if (!matrix || matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  entry?.dispose();
  const overlay = document.createElement("div");
  overlay.className = styles.overlay;
  const attribute = `${kind}Transition`;
  overlay.dataset[attribute] = "entering";
  overlay.setAttribute("aria-hidden", "true");
  const backdrop = document.createElement("div");
  backdrop.className = styles.backdrop;
  const screen = document.createElement("div");
  screen.className = `${styles.screen} ${kind === "book" ? styles.paper : ""}`;
  screen.style.width = `${sourceWidth}px`;
  screen.style.height = `${sourceHeight}px`;
  screen.append(content);
  overlay.append(backdrop, screen);
  document.body.append(overlay);
  document.documentElement.dataset[attribute] = "entering";

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let timeout = 0;
  const current: Entry = { kind, width: sourceWidth, height: sourceHeight, overlay, screen, backdrop, animations: [], frames: [], dispose: () => {
    clearTimeout(timeout);
    current.frames.forEach(cancelAnimationFrame);
    current.animations.forEach(animation => animation.cancel());
    overlay.remove();
    window.removeEventListener("popstate", current.dispose);
    window.removeEventListener("resize", current.dispose);
    motion.removeEventListener("change", current.dispose);
    if (entry === current) {
      delete document.documentElement.dataset[attribute];
      entry = null;
    }
  } };
  entry = current;
  window.addEventListener("popstate", current.dispose);
  window.addEventListener("resize", current.dispose);
  motion.addEventListener("change", current.dispose);
  timeout = window.setTimeout(current.dispose, 8_000);

  const ratio = sourceWidth / sourceHeight;
  const width = kind === "book" ? Math.min(innerWidth * 0.82, innerHeight * 0.7 * ratio, 420) : Math.min(innerWidth * 0.88, innerHeight * 0.92, 1040);
  const height = width / ratio;
  screen.style.transform = plane((innerWidth - width) / 2, (innerHeight - height) / 2, width, height, sourceWidth, sourceHeight);
  current.animations.push(screen.animate([
    { transform: `matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.e},${matrix.f})` },
    { transform: screen.style.transform },
  ], { duration: 720, easing: "cubic-bezier(0.22, 0.65, 0.24, 1)", fill: "forwards" }));
  current.animations.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: "ease-in-out", fill: "forwards" }));
  return current.dispose;
}

export function arriveAtWorkshop(target: HTMLElement) {
  arriveAtEntry(target, "workshop");
}

export function arriveAtBook(target: HTMLElement) {
  arriveAtEntry(target, "book");
}

function arriveAtEntry(target: HTMLElement, kind: Entry["kind"]) {
  const current = entry;
  const attribute = `${kind}Transition`;
  if (!current || current.kind !== kind || current.overlay.dataset[attribute] !== "entering") return;
  current.overlay.dataset[attribute] = "arriving";
  document.documentElement.dataset[attribute] = "arriving";
  // Wait for Next's scroll restoration and the destination layout together.
  current.frames.push(requestAnimationFrame(() => {
    current.frames.push(requestAnimationFrame(() => {
      if (entry !== current || !target.isConnected) return;
      const bounds = target.getBoundingClientRect();
      const from = getComputedStyle(current.screen).transform;
      const dock = current.screen.animate([
        { transform: from },
        { transform: plane(bounds.x, bounds.y, bounds.width, bounds.height, current.width, current.height) },
      ], { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
      current.animations.push(dock, current.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 560, easing: "ease-out", fill: "forwards" }));
      void dock.finished.then(() => {
        if (entry !== current) return;
        document.documentElement.dataset[attribute] = "revealing";
        target.closest<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
        current.dispose();
      }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
    }));
  }));
}
