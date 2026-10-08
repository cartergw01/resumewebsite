import styles from "@/components/WorkshopEntry.module.css";
import { artworkTransform } from "./artwork-perspective";
import { ENTRY_ARRIVAL_DURATION, ENTRY_HANDOFF_DURATION, ENTRY_LIFT_DURATION, ENTRY_STAGGER_DURATION } from "./island-entry-motion";

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

export function beginWorkshopEntry(source: SVGGraphicsElement) {
  const posters: string[] = JSON.parse(source.dataset.posters ?? "[]");
  if (!posters.length) posters.push(source.dataset.src ?? "");
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
  // notebook is the whole archive rather than any one essay. The left half is
  // written on the back of the last leaf to turn; the right half waits under
  // the leaves on the right-hand page.
  const titles: string[] = JSON.parse(source.dataset.titles ?? "[]");
  const half = Math.ceil(titles.length / 2);
  const written = (entries: string[]) => {
    const list = document.createElement("ol");
    list.className = styles.titles;
    for (const title of entries) {
      const item = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = title;
      item.append(text);
      list.append(item);
    }
    return list;
  };
  const page = (side: "left" | "right", entries?: string[]) => {
    const leaf = document.createElement("div");
    leaf.className = `${styles.leaf} ${styles[side]}`;
    if (entries) { leaf.dataset.notebookPage = side; leaf.append(written(entries)); }
    return leaf;
  };
  const spread = document.createDocumentFragment();
  spread.append(page("left"));
  for (let index = 0; index < BOOK_LEAVES; index++) {
    const leaf = document.createElement("div");
    leaf.className = styles.turn;
    leaf.dataset.notebookLeaf = String(index);
    const front = page("right"), back = page("left", index === BOOK_LEAVES - 1 ? titles.slice(0, half) : undefined);
    front.classList.add(styles.face); back.classList.add(styles.face, styles.back);
    for (const face of [front, back]) { const shade = document.createElement("span"); shade.className = styles.shade; face.append(shade); }
    leaf.append(front, back);
    spread.append(leaf);
  }
  // Last in reading order; the leaves' depth keeps them stacked above it.
  spread.append(page("right", titles.slice(half)));
  return beginEntry(source, spread, "book", 640, 400);
}

// Writing opens like a notebook: it lifts off the desk to face you, then its
// leaves turn over the spine until the archive lies open.
const BOOK_LEAVES = 3;
// A landscape spread on wide screens; on a phone, a taller pocket notebook so
// the archive still reads at a comfortable size. The ruling follows the page.
const bookSize = () => {
  if (innerWidth < 760) {
    const width = Math.min(innerWidth * .94, 520);
    const height = Math.min(innerHeight * .72, width * 1.05);
    return { width, height, rule: height / 22 };
  }
  const width = Math.min(innerWidth * .82, innerHeight * .78 * 1.6, 1180);
  return { width, height: width / 1.6, rule: Math.min(34, width / 1.6 / 21) };
};
// A pose as one consistent list of functions, so the browser interpolates a
// physical lift and turn rather than blending two flat matrices.
const bookPose = (x: number, y: number, angle: number, tilt: number, scale: number) =>
  `translate(${x}px, ${y}px) rotate(${angle}rad) rotateX(${tilt}rad) scale(${scale})`;

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
  screen.className = kind === "book" ? styles.notebook : styles.deck;
  // The notebook is laid out at its final reading size so its ruling stays
  // crisp when it lands. Each project card keeps the laptop screen's box.
  const book = bookSize();
  const layoutWidth = kind === "book" ? book.width : sourceWidth;
  const layoutHeight = kind === "book" ? book.height : sourceHeight;
  if (kind === "book") {
    overlay.classList.add(styles.depth);
    screen.style.width = `${layoutWidth}px`;
    screen.style.height = `${layoutHeight}px`;
    screen.style.margin = `${-layoutHeight / 2}px 0 0 ${-layoutWidth / 2}px`;
    screen.style.setProperty("--rule", `${book.rule}px`);
  }
  const projected: number[][] = JSON.parse(source.dataset.corners ?? "[]");
  if (projected.length !== 4) return null;
  // getScreenCTM still returns SVGMatrix in some engines, which has no
  // DOMMatrix.transformPoint method. Its six affine coefficients are portable.
  const corners = projected.map(([x, y]) => [
    matrix.a * x + matrix.c * y + matrix.e,
    matrix.b * x + matrix.d * y + matrix.f,
  ]);
  const startTransform = artworkTransform(corners, layoutWidth, layoutHeight);
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
    // Start on the island's open notebook: its place, the angle of its spine
    // and how far it lies back on the desk, read from its projected corners.
    const [tl, tr, bl, br] = corners;
    const cx = (tl[0] + tr[0] + bl[0] + br[0]) / 4, cy = (tl[1] + tr[1] + bl[1] + br[1]) / 4;
    const across = [(tr[0] - tl[0] + br[0] - bl[0]) / 2, (tr[1] - tl[1] + br[1] - bl[1]) / 2];
    const shown = Math.hypot(across[0], across[1]);
    const angle = Math.atan2(across[1], across[0]);
    const deep = Math.hypot((bl[0] + br[0] - tl[0] - tr[0]) / 2, (bl[1] + br[1] - tl[1] - tr[1]) / 2);
    const scale = shown / layoutWidth;
    const tilt = Math.acos(Math.max(.2, Math.min(1, deep / (layoutHeight * scale))));
    const lift = { duration: ENTRY_LIFT_DURATION, fill: "forwards" } as const;
    current.animations.push(
      // It rises and turns up to face you, settling at reading size.
      screen.animate([
        { transform: bookPose(cx, cy, angle, tilt, scale), opacity: 0, offset: 0, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
        { opacity: 1, offset: .14 },
        { transform: bookPose(innerWidth / 2, innerHeight / 2, 0, 0, 1), opacity: 1, offset: .56 },
        { transform: bookPose(innerWidth / 2, innerHeight / 2, 0, 0, 1), opacity: 1, offset: 1 },
      ], lift),
      backdrop.animate([{ opacity: 0 }, { opacity: 1, offset: .5 }, { opacity: 1 }], { ...lift, easing: "ease-in-out" }),
    );
    // Then its leaves turn over the spine, one after another, each shading
    // as it lifts away from the light and catching it again as it lands.
    const leaves = Array.from(screen.querySelectorAll<HTMLElement>("[data-notebook-leaf]"));
    leaves.forEach((leaf, index) => {
      const depth = (from: number, to: number) => [{ transform: `translateZ(${from}px) rotateY(0deg)` }, { transform: `translateZ(${to}px) rotateY(-180deg)` }];
      const turn = { duration: ENTRY_LIFT_DURATION * .36, delay: ENTRY_LIFT_DURATION * (.42 + index * .1), easing: "cubic-bezier(0.42, 0, 0.25, 1)", fill: "both" } as const;
      const [front, back] = Array.from(leaf.querySelectorAll<HTMLElement>(`.${styles.shade}`));
      current.animations.push(
        leaf.animate(depth((leaves.length - index) * .6, (index + 1) * .6), turn),
        front.animate([{ opacity: 0 }, { opacity: .55, offset: .5 }, { opacity: .55 }], turn),
        back.animate([{ opacity: .55 }, { opacity: .55, offset: .5 }, { opacity: 0 }], turn),
      );
    });
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
      { transform: startTransform, offset: 0, easing: "cubic-bezier(0.22, 0.65, 0.24, 1)" },
      { transform: cardPose(centerX, centerY, width, 0), offset: 0.5, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
      { transform: cardPose(x, y, width, angle), offset: 1 },
    ], { duration: ENTRY_LIFT_DURATION, fill: "forwards" }));
  }
  current.animations.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ENTRY_LIFT_DURATION, easing: "ease-in-out", fill: "forwards" }));
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
  // Continue directly from the approach into the reveal, without a hold
  // that makes an already-loaded destination feel unresponsive.
  const settled = Promise.all(current.animations.map(animation => animation.finished));
  void settled.then(() => {
    if (entry !== current) return;
    arrive(current, target, kind, attribute);
  }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
}

function arrive(current: Entry, target: HTMLElement, kind: Entry["kind"], attribute: string) {
  // Wait for Next's scroll restoration and the destination layout together.
  current.frames.push(requestAnimationFrame(() => {
    current.frames.push(requestAnimationFrame(() => {
      if (entry !== current || !target.isConnected) return;
      if (kind === "book") {
        // The open archive eases a little closer and gives way to the page.
        document.documentElement.dataset[attribute] = "revealing";
        const open = { duration: ENTRY_ARRIVAL_DURATION, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" } as const;
        const rest = bookPose(innerWidth / 2, innerHeight / 2, 0, 0, 1);
        const dock = current.screen.animate([
          { transform: rest, opacity: 1 },
          { transform: rest.replace(/scale\([^)]*\)$/, "scale(1.04)"), opacity: 0 },
        ], open);
        current.animations.push(
          dock,
          current.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { ...open, easing: "ease-out" }),
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
      const stagger = cards.length > 1 ? ENTRY_STAGGER_DURATION : 0;
      const dockDuration = ENTRY_ARRIVAL_DURATION - ENTRY_HANDOFF_DURATION - stagger;
      // Give the row thumbnails a moment to decode so the hand-off never
      // reveals an empty frame.
      const thumbnails = shots.map(shot => shot.querySelector("img")).filter((image): image is HTMLImageElement => Boolean(image));
      void Promise.all(thumbnails.map(image => image.decode().catch(() => undefined)));
      const docks = cards.map(card => {
        const index = Number(card.dataset.projectCard);
        const destination = shots[index] ?? target;
        const shot = destination.getBoundingClientRect();
        // The mobile crop eases in as its card lands, preserving the visual
        // connection between the workshop screen and the readable preview.
        const image = card.querySelector("img");
        const preview = destination.querySelector("img");
        if (image && preview && matchMedia("(max-width: 760px)").matches) {
          const style = getComputedStyle(preview);
          image.style.transformOrigin = style.objectPosition;
          current.animations.push(image.animate([
            { transform: "scale(1)", objectPosition: "50% 0%" },
            { transform: style.transform, objectPosition: style.objectPosition },
          ], { duration: dockDuration, delay: cards.length > 1 ? index / (cards.length - 1) * stagger : 0, easing: "ease-out", fill: "forwards" }));
        }
        return card.animate([
          { transform: getComputedStyle(card).transform },
          { transform: plane(shot.x, shot.y, shot.width, shot.height, current.width, current.height) },
        ], { duration: dockDuration, delay: cards.length > 1 ? index / (cards.length - 1) * stagger : 0, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
      });
      current.animations.push(...docks, current.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ENTRY_ARRIVAL_DURATION, easing: "ease-out", fill: "forwards" }));
      void Promise.all(docks.map(dock => dock.finished)).then(() => {
        if (entry !== current) return;
        // Show the real thumbnails under the landed cards, then fade the
        // cards away, so the hand-off is a crossfade rather than a swap.
        document.documentElement.dataset[attribute] = "landed";
        const fade = current.screen.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ENTRY_HANDOFF_DURATION, easing: "ease-out", fill: "forwards" });
        current.animations.push(fade);
        return fade.finished;
      }).then(() => {
        if (entry !== current) return;
        target.closest<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
        current.dispose();
      }).catch(() => { /* A back gesture or reduced-motion change ends the journey. */ });
    }));
  }));
}
