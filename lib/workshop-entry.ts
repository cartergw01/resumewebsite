import styles from "@/components/WorkshopEntry.module.css";
import { artworkTransform } from "./artwork-perspective";
import { arriveEntryLight, holdEntryLight } from "./entry-light";
import { ENTRY_ARRIVAL_DURATION, ENTRY_HANDOFF_DURATION, ENTRY_LIFT_DURATION, ENTRY_STAGGER_DURATION } from "./island-entry-motion";

type Entry = {
  kind: "workshop" | "book";
  width: number;
  height: number;
  overlay: HTMLDivElement;
  screen: HTMLDivElement;
  // What fades: the notebook's own layer. Fading the notebook itself would
  // flatten its 3D context and paint leaves in DOM order, not by depth.
  fader: HTMLDivElement;
  backdrop: HTMLDivElement;
  animations: Animation[];
  frames: number[];
  dispose: () => void;
};

// This one visual belongs to the journey, so it survives the source route.
// Projects lifts the laptop screen as a deck of every project, fans it out,
// then deals each card into its row. Writing lifts the island's open notebook
// until its pages fill the view, thumbs through the essays, then dissolves
// into the archive.
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

export type NotebookEssay = { title: string; date: string; subtitle: string };

export function beginBookEntry(source: SVGGraphicsElement) {
  // The notebook is a bound collection of Carter's essays (not the reading
  // lists), one spread each: the title page on the left, its standfirst set
  // large on the right. Thumbing through it riffles past them, newest first,
  // and it falls open on the last one, which dissolves into the Writing page.
  const essays: NotebookEssay[] = JSON.parse(source.dataset.essays ?? "[]");
  // Each leaf turns from one essay's spread to the next.
  const leaves = Math.max(1, Math.min(bookLeaves(), essays.length - 1));
  const line = (className: string, text: string) => {
    const part = document.createElement("p");
    part.className = className;
    part.textContent = text;
    return part;
  };
  // An essay's two pages, typeset like the page lying open on the island
  // (EssayLeaf): the masthead, the date and the title on the left; the
  // standfirst and the byline on the right.
  const typeset = (essay: NotebookEssay, half: "title" | "standfirst") => {
    const sheet = document.createElement("div");
    sheet.className = styles.essay;
    const rule = document.createElement("span");
    rule.className = styles.rule;
    if (half === "title") {
      const body = document.createElement("div");
      body.className = styles.body;
      body.append(line(styles.headline, essay.title), rule);
      sheet.append(line(styles.masthead, "flying Arrows"), line(styles.dated, essay.date.toUpperCase()), body);
    } else {
      const body = document.createElement("div");
      body.className = styles.standfirst;
      body.append(rule, line(styles.dek, essay.subtitle));
      sheet.append(body, line(styles.byline, "Carter Wang"));
    }
    return sheet;
  };
  // A whole printed page. The two static pages are named for the arrival.
  const page = (side: "left" | "right", essay: NotebookEssay | undefined, named = false) => {
    const leaf = document.createElement("div");
    leaf.className = `${styles.leaf} ${styles[side]}`;
    if (named) leaf.dataset.notebookPage = side;
    if (essay) leaf.append(typeset(essay, side === "left" ? "title" : "standfirst"));
    return leaf;
  };
  // One face of a leaf: a whole page, front or back.
  const face = (side: "left" | "right", back: boolean, essay: NotebookEssay | undefined) => {
    const pane = document.createElement("div");
    pane.className = `${styles.face}${back ? ` ${styles.back}` : ""}`;
    pane.append(page(side, essay));
    return pane;
  };
  // The spread opens on the newest essay; each leaf carries the right page
  // of one essay on its front and the left page of the next on its back; the
  // page under all the leaves is the last essay's right page.
  const spread = document.createDocumentFragment();
  spread.append(page("left", essays[0], true));
  // The right page lies under the leaves, so it comes first: in DOM order
  // too, so any engine that paints this flat keeps it under the leaves.
  spread.append(page("right", essays[leaves], true));
  for (let index = 0; index < leaves; index++) {
    // Each leaf is one stiff sheet, hinged on the spine. (Bending it in two
    // hinged halves made engines sort and shade the halves apart, which
    // flickered as the page turned.)
    const leaf = document.createElement("div");
    leaf.className = styles.turn;
    leaf.dataset.notebookLeaf = String(index);
    leaf.append(face("right", false, essays[index]), face("left", true, essays[index + 1]));
    spread.append(leaf);
  }
  return beginEntry(source, spread, "book", 640, 400);
}

// Writing opens like a notebook: it lifts off the desk and comes up close,
// settles at reading distance, then is thumbed through, past the essays.
// Phones turn fewer leaves: every face is its own layer.
const bookLeaves = () => innerWidth < 760 ? 5 : 7;
// When each leaf starts to turn after the notebook settles, and how long it
// takes: a riffle under the thumb, the first a touch deliberate, picking up
// pace through the middle with two or three leaves in the air at once, the
// last laid down gently.
const BOOK_LIFT = 1100;
// The notebook's perspective (WorkshopEntry.module.css .fader). A leaf lying a
// few pixels proud of the spread is shrunk by exactly what that perspective
// magnifies, so its printed words stay pixel-sharp at rest.
const BOOK_PERSPECTIVE = 3000;
const flat = (depth: number) => (BOOK_PERSPECTIVE - depth) / BOOK_PERSPECTIVE;
const LEAF_STARTS = [0, 360, 650, 900, 1130, 1350, 1580];
const LEAF_TURNS = [820, 760, 700, 680, 680, 720];
const LAST_LEAF_TURN = 880;
// A landscape spread on wide screens; on a phone, a taller pocket notebook so
// the essays still read at a comfortable size.
const bookSize = () => {
  if (innerWidth < 760) {
    const width = Math.min(innerWidth * .94, 520);
    return { width, height: Math.min(innerHeight * .72, width * 1.05) };
  }
  const width = Math.min(innerWidth * .82, innerHeight * .78 * 1.6, 1180);
  return { width, height: width / 1.6 };
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
    screen.style.width = `${layoutWidth}px`;
    screen.style.height = `${layoutHeight}px`;
    screen.style.margin = `${-layoutHeight / 2}px 0 0 ${-layoutWidth / 2}px`;
    // The printed pages are set like the island's 320 x 400 page, scaled to fit.
    screen.style.setProperty("--u", `${Math.min(layoutWidth / 2 / 320, layoutHeight / 400)}px`);
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
  const fader = document.createElement("div");
  fader.className = styles.fader;
  if (kind === "book") { fader.append(screen); overlay.append(backdrop, fader); }
  else overlay.append(backdrop, screen);
  document.body.append(overlay);
  // The island's light glows behind what it carries, in front of the dark.
  holdEntryLight(overlay, kind === "book" ? fader : screen);
  document.documentElement.dataset[attribute] = "entering";

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let timeout = 0;
  const current: Entry = { kind, width: layoutWidth, height: layoutHeight, overlay, screen, fader, backdrop, animations: [], frames: [], dispose: () => {
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
    const lift = { duration: BOOK_LIFT, fill: "forwards" } as const;
    const rest = bookPose(innerWidth / 2, innerHeight / 2, 0, 0, 1);
    const rise = Math.min(70, innerHeight * .08);
    current.animations.push(
      // It comes up off the desk with some weight: first straight up, still
      // lying back as it was, then it swings up to face you and keeps coming,
      // close enough to fill your view, before easing back to reading size.
      screen.animate([
        { transform: bookPose(cx, cy, angle, tilt, scale), offset: 0, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
        { transform: bookPose(cx, cy - rise, angle * .75, tilt * .85, scale * 1.15), offset: .26, easing: "cubic-bezier(0.4, 0, 0.3, 1)" },
        { transform: bookPose(innerWidth / 2, innerHeight / 2 + innerHeight * .015, 0, -.1, 1.17), offset: .68, easing: "cubic-bezier(0.35, 0, 0.25, 1)" },
        { transform: rest, offset: 1 },
      ], lift),
      fader.animate([{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1 }], lift),
      backdrop.animate([{ opacity: 0 }, { opacity: 1, offset: .55 }, { opacity: 1 }], { ...lift, easing: "ease-in-out" }),
    );
    // Then it is thumbed through, leaf by leaf, overlapping like pages under
    // a thumb. A leaf turns the way paper does: the corner lifts first, the
    // page swings over through upright, then floats down, slowing onto the
    // left-hand stack; a slight skew in the air reads as the sheet flexing.
    // No shading or cast shadows: they flickered as the pages turned.
    const leaves = Array.from(screen.querySelectorAll<HTMLElement>("[data-notebook-leaf]"));
    const timing = (index: number) => {
      const last = index === leaves.length - 1;
      return { delay: BOOK_LIFT + LEAF_STARTS[index], duration: last ? LAST_LEAF_TURN : LEAF_TURNS[index] };
    };
    leaves.forEach((leaf, index) => {
      const turn = { ...timing(index), fill: "both" } as const;
      const below = (leaves.length - index) * 2, above = (index + 1) * 2 + 2;
      current.animations.push(leaf.animate([
        { transform: `translateZ(${below}px) rotateY(0deg) skewY(0deg) scale(${flat(below)})`, easing: "cubic-bezier(0.45, 0, 0.7, 0.55)" },
        { transform: `translateZ(${below + 6}px) rotateY(-24deg) skewY(-1.2deg) scale(1)`, offset: .24, easing: "cubic-bezier(0.3, 0.25, 0.55, 1)" },
        { transform: `translateZ(${below + 14}px) rotateY(-122deg) skewY(1deg) scale(1)`, offset: .62, easing: "cubic-bezier(0.2, 0.45, 0.35, 1)" },
        { transform: `translateZ(${above}px) rotateY(-180deg) skewY(0deg) scale(${flat(above)})` },
      ], turn));
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

// The notebook has finished opening (or there is none). Writing's route is
// swapped in only then, so the work of mounting the page never lands while a
// leaf is in the air.
export function bookOpened() {
  const current = entry;
  if (!current || current.kind !== "book") return Promise.resolve();
  return Promise.all(current.animations.map(animation => animation.finished)).then(() => undefined);
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
        // The lamplight behind it fades with the notebook.
        arriveEntryLight(ENTRY_ARRIVAL_DURATION * .5);
        // The last spread holds a beat, then the notebook dissolves before the
        // page's rows rise into place (WritingWorld.module.css), so the
        // essays on the pages never sit on top of the archive's titles.
        document.documentElement.dataset[attribute] = "revealing";
        const open = { duration: ENTRY_ARRIVAL_DURATION, fill: "forwards" } as const;
        const rest = bookPose(innerWidth / 2, innerHeight / 2, 0, 0, 1);
        const dock = current.fader.animate([
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: .4, easing: "cubic-bezier(0.4, 0, 0.8, 1)" },
          { opacity: 0, offset: .9 },
          { opacity: 0, offset: 1 },
        ], open);
        current.animations.push(
          dock,
          current.screen.animate([
            { transform: rest, offset: 0 },
            { transform: rest, offset: .4, easing: "cubic-bezier(0.4, 0, 0.8, 1)" },
            { transform: rest.replace(/scale\([^)]*\)$/, "scale(1.025)"), offset: .9 },
            { transform: rest.replace(/scale\([^)]*\)$/, "scale(1.025)"), offset: 1 },
          ], open),
          current.backdrop.animate([{ opacity: 1 }, { opacity: 1, offset: .4 }, { opacity: 0, offset: .9 }, { opacity: 0 }], { ...open, easing: "ease-out" }),
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
      arriveEntryLight();
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
        // Sucked into place: the card gives a little back first, away from
        // its row, then is pulled in faster and faster and snaps home.
        const fan = getComputedStyle(card).transform;
        const from = fan === "none" ? "matrix(1, 0, 0, 1, 0, 0)" : fan;
        const box = card.getBoundingClientRect();
        const dx = box.x + box.width / 2 - (shot.x + shot.width / 2), dy = box.y + box.height / 2 - (shot.y + shot.height / 2);
        const give = Math.min(22, Math.hypot(dx, dy) * .06) / (Math.hypot(dx, dy) || 1);
        return card.animate([
          { transform: `translate(0px, 0px) ${from} scale(1)`, easing: "cubic-bezier(0.3, 0, 0.4, 1)" },
          { transform: `translate(${dx * give}px, ${dy * give}px) ${from} scale(1.035)`, offset: .22, easing: "cubic-bezier(0.7, 0, 0.98, 0.55)" },
          { transform: `translate(0px, 0px) ${plane(shot.x, shot.y, shot.width, shot.height, current.width, current.height)} scale(1)` },
        ], { duration: dockDuration, delay: cards.length > 1 ? index / (cards.length - 1) * stagger : 0, fill: "forwards" });
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
