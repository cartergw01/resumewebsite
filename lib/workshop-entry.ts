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
// Projects lifts the laptop screen as a deck of every project, fans it out,
// then deals each card into its row. Writing lifts the island's open notebook
// until its pages fill the view, then opens them onto the whole archive.
let entry: Entry | null = null;
const plane = (x: number, y: number, width: number, height: number, sourceWidth: number, sourceHeight: number) =>
  `matrix(${width / sourceWidth},0,0,${height / sourceHeight},${x},${y})`;

export function beginWorkshopEntry(source: SVGImageElement) {
  const posters: string[] = JSON.parse(source.dataset.posters ?? "[]");
  if (!posters.length) posters.push(source.href.baseVal);
  // Stacked last-to-first, so the laptop's own screen starts on top.
  const deck = document.createDocumentFragment();
  posters.map((src, index) => {
    const card = document.createElement("div");
    card.className = styles.screen;
    card.dataset.projectCard = String(index);
    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    card.append(image);
    return card;
  }).reverse().forEach(card => deck.append(card));
  return beginEntry(source, deck, "workshop", 320, 200);
}

const matrixOf = (m: DOMMatrix) => `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
// A card of the given width, centred at (x, y) and turned by `angle` degrees,
// expressed against its 320x200 layout box and a top-left transform origin.
function cardPose(x: number, y: number, width: number, angle: number) {
  const scale = width / 320;
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians) * scale;
  const sin = Math.sin(radians) * scale;
  return `matrix(${cos},${sin},${-sin},${cos},${x - (cos * 160 - sin * 100)},${y - (sin * 160 + cos * 100)})`;
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
  screen.className = kind === "book" ? `${styles.screen} ${styles.notebook}` : styles.deck;
  // The notebook is laid out at full-viewport size so its ruling stays crisp
  // when it lands; its start transform shrinks it back onto the island. Each
  // project card keeps the laptop screen's 320x200 box.
  const layoutWidth = kind === "book" ? innerWidth : sourceWidth;
  const layoutHeight = kind === "book" ? innerHeight : sourceHeight;
  if (kind === "book") {
    screen.style.width = `${layoutWidth}px`;
    screen.style.height = `${layoutHeight}px`;
  }
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
  timeout = window.setTimeout(current.dispose, 10_000);

  if (kind === "book") {
    // Start exactly on the island's pages, then flatten until they fill the view.
    const sx = sourceWidth / layoutWidth;
    const sy = sourceHeight / layoutHeight;
    screen.style.transform = "none";
    current.animations.push(screen.animate([
      { transform: `matrix(${matrix.a * sx},${matrix.b * sx},${matrix.c * sy},${matrix.d * sy},${matrix.e},${matrix.f})` },
      { transform: "matrix(1,0,0,1,0,0)" },
    ], { duration: 1250, easing: "cubic-bezier(0.55, 0.05, 0.25, 1)", fill: "forwards" }));
    current.animations.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1250, easing: "ease-in", fill: "forwards" }));
    return current.dispose;
  }
  // The deck rises off the laptop to the centre, then fans into an arc of
  // equal cards, like a hand of posters, pivoting about a point below it.
  const cards = Array.from(screen.children) as HTMLElement[];
  const count = cards.length;
  const narrow = innerWidth < 760;
  const width = Math.min(innerWidth * (narrow ? 0.4 : 0.24), innerHeight * 0.45, 340);
  const radius = width * (narrow ? 1.9 : 2.4);
  const spread = Math.min(count - 1, 7) * (narrow ? 5 : 7.5);
  const centerX = innerWidth / 2;
  const centerY = innerHeight / 2 + width * 0.12;
  for (const card of cards) {
    const index = Number(card.dataset.projectCard);
    const angle = count > 1 ? -spread / 2 + index * spread / (count - 1) : 0;
    const radians = angle * Math.PI / 180;
    const x = centerX + radius * Math.sin(radians);
    const y = centerY + radius * (1 - Math.cos(radians));
    current.animations.push(card.animate([
      { transform: matrixOf(matrix), offset: 0, easing: "cubic-bezier(0.22, 0.65, 0.24, 1)" },
      { transform: cardPose(centerX, centerY, width, 0), offset: 0.5, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
      { transform: cardPose(x, y, width, angle), offset: 1 },
    ], { duration: 1800, fill: "forwards" }));
  }
  current.animations.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 800, easing: "ease-in-out", fill: "forwards" }));
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
  // Let the notebook land or the fan finish opening, and hold a beat on it,
  // before the pages open or the cards are dealt.
  const settled = Promise.all(current.animations.map(animation => animation.finished));
  void settled.then(() => new Promise(resolve => setTimeout(resolve, 280))).then(() => {
    if (entry !== current) return;
    arrive(current, target, kind, attribute);
  }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
}

function arrive(current: Entry, target: HTMLElement, kind: Entry["kind"], attribute: string) {
  // Wait for Next's scroll restoration and the destination layout together.
  current.frames.push(requestAnimationFrame(() => {
    current.frames.push(requestAnimationFrame(() => {
      if (entry !== current || !target.isConnected) return;
      const from = getComputedStyle(current.screen).transform;
      if (kind === "book") {
        // The pages swing open like doors onto the whole archive at once.
        document.documentElement.dataset[attribute] = "revealing";
        const open = { duration: 1300, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" } as const;
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
          current.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, easing: "ease-out", fill: "forwards" }),
        );
        void dock.finished.then(() => {
          if (entry !== current) return;
          target.focus({ preventScroll: true });
          current.dispose();
        }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
        return;
      }
      // Deal each card into its own row's shot while the list fades in.
      document.documentElement.dataset[attribute] = "revealing";
      const shots = Array.from(document.querySelectorAll<HTMLElement>("[data-project-shot]"));
      const cards = Array.from(current.screen.children) as HTMLElement[];
      const docks = cards.map(card => {
        const index = Number(card.dataset.projectCard);
        const shot = (shots[index] ?? target).getBoundingClientRect();
        return card.animate([
          { transform: getComputedStyle(card).transform },
          { transform: plane(shot.x, shot.y, shot.width, shot.height, current.width, current.height) },
        ], { duration: 950, delay: index * 70, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
      });
      current.animations.push(...docks, current.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, easing: "ease-out", fill: "forwards" }));
      void Promise.all(docks.map(dock => dock.finished)).then(() => {
        if (entry !== current) return;
        target.closest<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
        current.dispose();
      }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
    }));
  }));
}
