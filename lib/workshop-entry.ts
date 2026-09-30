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
// Projects docks the screen. Writing lifts the island's open notebook until
// its pages fill the view, then opens them onto the whole archive.
let entry: Entry | null = null;
const plane = (x: number, y: number, width: number, height: number, sourceWidth: number, sourceHeight: number) =>
  `matrix(${width / sourceWidth},0,0,${height / sourceHeight},${x},${y})`;

export function beginWorkshopEntry(source: SVGImageElement) {
  const image = document.createElement("img");
  image.src = source.href.baseVal;
  image.alt = "";
  return beginEntry(source, image, "workshop", 320, 200);
}

export function beginBookEntry(source: SVGGraphicsElement) {
  // Every essay title, written into the ruled pages at the same size, so the
  // notebook is the whole archive rather than any one essay.
  const titles: string[] = JSON.parse(source.dataset.titles ?? "[]");
  const half = Math.ceil(titles.length / 2);
  const spread = document.createDocumentFragment();
  for (const [side, entries] of [["left", titles.slice(0, half)], ["right", titles.slice(half)]] as const) {
    const leaf = document.createElement("div");
    leaf.className = `${styles.leaf} ${styles[side]}`;
    leaf.dataset.notebookPage = side;
    const list = document.createElement("ol");
    list.className = styles.titles;
    for (const title of entries) {
      const item = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = title;
      item.append(text);
      list.append(item);
    }
    leaf.append(list);
    spread.append(leaf);
  }
  return beginEntry(source, spread, "book", 640, 400);
}

function beginEntry(source: SVGGraphicsElement, content: Node, kind: Entry["kind"], sourceWidth: number, sourceHeight: number) {
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
  screen.className = `${styles.screen} ${kind === "book" ? styles.notebook : ""}`;
  // The notebook is laid out at full-viewport size so its ruling stays crisp
  // when it lands; its start transform shrinks it back onto the island.
  const layoutWidth = kind === "book" ? innerWidth : sourceWidth;
  const layoutHeight = kind === "book" ? innerHeight : sourceHeight;
  screen.style.width = `${layoutWidth}px`;
  screen.style.height = `${layoutHeight}px`;
  screen.append(content);
  overlay.append(backdrop, screen);
  document.body.append(overlay);
  document.documentElement.dataset[attribute] = "entering";

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let timeout = 0;
  const current: Entry = { kind, width: layoutWidth, height: layoutHeight, overlay, screen, backdrop, animations: [], frames: [], dispose: () => {
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

  if (kind === "book") {
    // Start exactly on the island's pages, then flatten until they fill the view.
    const sx = sourceWidth / layoutWidth;
    const sy = sourceHeight / layoutHeight;
    screen.style.transform = "none";
    current.animations.push(screen.animate([
      { transform: `matrix(${matrix.a * sx},${matrix.b * sx},${matrix.c * sy},${matrix.d * sy},${matrix.e},${matrix.f})` },
      { transform: "matrix(1,0,0,1,0,0)" },
    ], { duration: 820, easing: "cubic-bezier(0.55, 0.05, 0.25, 1)", fill: "forwards" }));
    current.animations.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 820, easing: "ease-in", fill: "forwards" }));
    return current.dispose;
  }
  const ratio = sourceWidth / sourceHeight;
  const width = Math.min(innerWidth * 0.88, innerHeight * 0.92, 1040);
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
      if (kind === "book") {
        // The pages swing open like doors onto the whole archive at once.
        document.documentElement.dataset[attribute] = "revealing";
        const open = { duration: 900, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" } as const;
        const [left, right] = Array.from(current.screen.children) as HTMLElement[];
        // Each page fades as it turns edge-on, so no sliver lingers at the hinge.
        const swing = (angle: number) => [
          { transform: "rotateY(0deg)", opacity: 1 },
          { transform: `rotateY(${angle * 0.75}deg)`, opacity: 1, offset: 0.7 },
          { transform: `rotateY(${angle}deg)`, opacity: 0 },
        ];
        const dock = right.animate(swing(-104), open);
        current.animations.push(
          dock,
          left.animate(swing(104), open),
          current.screen.animate([{ transform: from }, { transform: "scale(1.08)" }], open),
          current.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: "ease-out", fill: "forwards" }),
        );
        void dock.finished.then(() => {
          if (entry !== current) return;
          target.focus({ preventScroll: true });
          current.dispose();
        }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
        return;
      }
      const duration = 560;
      const dock = current.screen.animate([
        { transform: from },
        { transform: plane(bounds.x, bounds.y, bounds.width, bounds.height, current.width, current.height) },
      ], { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
      current.animations.push(dock, current.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: "ease-out", fill: "forwards" }));
      void dock.finished.then(() => {
        if (entry !== current) return;
        document.documentElement.dataset[attribute] = "revealing";
        target.closest<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
        current.dispose();
      }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
    }));
  }));
}
