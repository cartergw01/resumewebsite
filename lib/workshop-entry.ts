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
  // lists), one essay to a page, every page set the same way. Thumbing
  // through it riffles past them, newest first, and it falls open on the
  // last spread, which dissolves into the Writing page.
  const essays: NotebookEssay[] = JSON.parse(source.dataset.essays ?? "[]");
  // Each leaf turns a page over: the spread shows essays 0 and 1, and every
  // leaf brings two more. Only as many leaves as there are essays to fill
  // both of their faces, so no page is ever blank.
  const leaves = Math.max(0, Math.min(bookLeaves(), Math.floor((essays.length - 2) / 2)));
  const line = (className: string, text: string) => {
    const part = document.createElement("p");
    part.className = className;
    part.textContent = text;
    return part;
  };
  // One essay's page, typeset like the page lying open on the island
  // (EssayLeaf): the masthead and the date, the title closed by a short rule,
  // the standfirst under it, and the byline at the foot.
  const typeset = (essay: NotebookEssay) => {
    const sheet = document.createElement("div");
    sheet.className = styles.essay;
    const rule = document.createElement("span");
    rule.className = styles.rule;
    const body = document.createElement("div");
    body.className = styles.body;
    body.append(line(styles.headline, essay.title), rule, line(styles.dek, essay.subtitle));
    sheet.append(line(styles.masthead, "flying Arrows"), line(styles.dated, essay.date.toUpperCase()), body, line(styles.byline, "Carter Wang"));
    return sheet;
  };
  // A whole printed page. The two static pages are named for the arrival.
  const page = (side: "left" | "right", essay: NotebookEssay | undefined, named = false) => {
    const leaf = document.createElement("div");
    leaf.className = `${styles.leaf} ${styles[side]}`;
    if (named) leaf.dataset.notebookPage = side;
    if (essay) leaf.append(typeset(essay));
    return leaf;
  };
  // One face of a leaf: a whole page, front or back.
  const face = (side: "left" | "right", back: boolean, essay: NotebookEssay | undefined) => {
    const pane = document.createElement("div");
    pane.className = `${styles.face}${back ? ` ${styles.back}` : ""}`;
    pane.append(page(side, essay));
    return pane;
  };
  // Pages run 0, 1, 2, ...: the spread opens on 0 and 1; leaf i carries page
  // 2i + 1 on its front and 2i + 2 on its back; the page under all the leaves
  // is the last right-hand page, 2 x leaves + 1.
  const spread = document.createDocumentFragment();
  spread.append(page("left", essays[0], true));
  // The right page lies under the leaves, so it comes first: in DOM order
  // too, so any engine that paints this flat keeps it under the leaves.
  spread.append(page("right", essays[2 * leaves + 1], true));
  for (let index = 0; index < leaves; index++) {
    // Each leaf is one stiff sheet, hinged on the spine. (Bending it in two
    // hinged halves made engines sort and shade the halves apart, which
    // flickered as the page turned.)
    const leaf = document.createElement("div");
    leaf.className = styles.turn;
    leaf.dataset.notebookLeaf = String(index);
    leaf.append(face("right", false, essays[2 * index + 1]), face("left", true, essays[2 * index + 2]));
    spread.append(leaf);
  }
  return beginEntry(source, spread, "book", 640, 400);
}

// Writing opens like a notebook: it lifts off the desk and comes up close,
// settles at reading distance, then is thumbed through, past the essays.
// Phones turn fewer leaves: every face is its own layer.
const bookLeaves = () => innerWidth < 760 ? 5 : 7;
// How long the notebook takes from the desk to reading distance.
const BOOK_LIFT = 1800;
// The notebook's perspective (bookPose): a camera about one and a half
// spreads away, close enough that the notebook foreshortens as it turns and
// grows as a real thing does when it's brought towards you. A leaf lying a
// few pixels proud of the spread is shrunk by exactly what that perspective
// magnifies, so its printed words stay pixel-sharp at rest.
let bookPerspective = 1600;
const flat = (depth: number) => (bookPerspective - depth) / bookPerspective;
// The riffle, like pages let go from under a thumb: the first leaves part
// slowly, they come fastest through the middle, and the last is laid down
// gently. Leaves start about LEAF_GAP apart (at most RIFFLE_SPAN for them
// all), each turns in LEAF_TURN, the last a little slower.
const RIFFLE_SPAN = 1500;
const LEAF_GAP = 420;
const LEAF_TURN = 820;
const LAST_LEAF_TURN = 960;
const leafStart = (index: number, count: number) => {
  if (count < 2) return 0;
  const x = index / (count - 1);
  return Math.min(RIFFLE_SPAN, (count - 1) * LEAF_GAP) * (x + .4 / (2 * Math.PI) * Math.sin(2 * Math.PI * x));
};
// The first leaf lifts just before the notebook comes to rest, so the flight
// runs straight on into the riffle with no pause between them.
const RIFFLE_OVERLAP = 150;
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
// physical lift and turn rather than blending two flat matrices. The
// perspective is the notebook's own, centred on it wherever it is on screen:
// one fixed at the screen's centre skewed it lopsided as it flew in from the
// desk off to one side. Its size on screen comes from its distance, not a
// scale: far off on the desk it is small and nearly flat, and as it comes
// towards you it grows and its near edge looms larger than its far one.
const bookPose = (x: number, y: number, angle: number, tilt: number, size: number, yaw = 0) =>
  `translate(${x}px, ${y}px) perspective(${bookPerspective}px) translateZ(${bookPerspective * (1 - 1 / size)}px) rotate(${angle}rad) rotateY(${yaw}rad) rotateX(${tilt}rad) scale(1)`;
// Eases in and out with no jolt at either end (smootherstep), and the same
// eased over part of the way.
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const during = (t: number, from: number, to: number) => smooth(Math.max(0, Math.min(1, (t - from) / (to - from))));
// A CSS-style cubic-bezier easing, for motions sampled into keyframes.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (s: number, a: number, b: number) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  return (t: number) => {
    let s = t;
    for (let i = 0; i < 8; i++) {
      const slope = 3 * (1 - s) * (1 - s) * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2);
      if (Math.abs(slope) < 1e-6) break;
      s = Math.max(0, Math.min(1, s - (at(s, x1, x2) - t) / slope));
    }
    return at(s, y1, y2);
  };
}
// The approach: an unhurried start and a long, gentle arrival.
const approach = bezier(.45, 0, .15, 1);
// The notebook's flight from the desk to reading distance, as finely sampled
// keyframes of one motion. It is picked up first: it rises just clear of the
// desk, still lying back as it was. Then, already on its way up, it comes
// out of the room towards you: it pitches up and turns in to face you, its
// edges catching the eye as it swings, travels to the centre and grows to
// reading size as it closes in, slowing all the while, so it settles into
// place rather than rushing at you. It tips a breath past upright and
// settles back, as a held book does. Everything comes to rest together.
function bookFlight(cx: number, cy: number, angle: number, tilt: number, scale: number, rise: number) {
  const steps = 60, endX = innerWidth / 2, endY = innerHeight / 2;
  const side = Math.sign(cx - endX);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const lifted = during(t, 0, .3);
    const come = approach(Math.max(0, (t - .1) / .9));
    const x = cx + (endX - cx) * come;
    const y = (cy - rise * lifted) * (1 - come) + endY * come;
    const turn = during(t, .1, .85);
    const settle = -.07 * Math.sin(Math.PI * during(t, .6, 1));
    // Turned in towards the middle of the screen, where you are, while it's
    // off to one side, and square to you once it's in front of you.
    const yaw = -.22 * side * Math.sin(Math.PI * Math.min(1, come * 1.15)) * (1 - during(t, .7, 1));
    const size = Math.exp(Math.log(scale * (1 + .2 * lifted)) * (1 - come));
    return { transform: bookPose(x, y, angle * (1 - turn), tilt * (1 - turn) + settle, size, yaw), offset: t };
  });
}
// One leaf's turn, as finely sampled keyframes of one motion: the sheet lifts
// off the stack, swings over through upright without pausing, arcs a little
// towards you on the way and floats down onto the left-hand stack, flexing
// slightly as it goes. Words stay pixel-sharp where it rests (see flat).
const leafTurn = bezier(.42, 0, .3, 1);
function leafFlight(below: number, above: number) {
  const steps = 24;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = leafTurn(i / steps);
    const depth = below + (above - below) * f + 16 * Math.sin(Math.PI * f);
    const flex = -1.2 * Math.sin(2 * Math.PI * f);
    return { transform: `translateZ(${depth}px) rotateY(${-180 * f}deg) skewY(${flex}deg) scale(${flat(depth)})`, offset: i / steps };
  });
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
    bookPerspective = Math.max(layoutWidth, layoutHeight) * 1.5;
    // The block of pages under the spread, as deep as a real notebook's half:
    // its edges show as the notebook tips and turns.
    screen.style.setProperty("--thickness", `${Math.max(10, Math.min(30, layoutWidth * .026))}px`);
    for (const side of ["top", "bottom", "left", "right"] as const) {
      const edge = document.createElement("div");
      edge.className = `${styles.edge} ${styles[side]}`;
      screen.append(edge);
    }
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
  // Writing shows its desk without the notebook (the "lifted" still) while
  // the notebook is carried off, drawn as a still rather than the parallax.
  const visual = kind === "book" ? source.closest<HTMLElement>("[data-island-visual]") : null;
  if (visual) visual.dataset.entryStill = "true";
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
    if (visual) delete visual.dataset.entryStill;
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
    // How far it rises off the desk before it comes to you: just clear of
    // it, in proportion to how large the book looks there.
    const rise = Math.min(innerHeight * .08, Math.max(30, shown * .5));
    const start = bookPose(cx, cy, angle, tilt, scale);
    // Where it lay, a soft shadow stays on the desk and fades as it rises.
    const shadow = document.createElement("div");
    shadow.className = styles.deskShadow;
    shadow.style.width = `${layoutWidth}px`; shadow.style.height = `${layoutHeight}px`;
    shadow.style.margin = screen.style.margin;
    shadow.style.transform = start;
    fader.before(shadow);
    current.animations.push(
      // The island holds still while the notebook is picked up off the desk
      // and brought to you (bookFlight), one continuous motion that never
      // stops part-way and starts again. The island's own notebook is gone
      // from the desk beneath it (the "lifted" still), so it's the one book,
      // carried off.
      screen.animate(bookFlight(cx, cy, angle, tilt, scale, rise), { ...lift, easing: "linear" }),
      shadow.animate([
        { opacity: .7, transform: `${start} scale(1)`, easing: "ease-out" },
        { opacity: 0, transform: `${start} scale(1.25)`, offset: .35 },
        { opacity: 0, transform: `${start} scale(1.25)` },
      ], lift),
      // The night closes in only once the notebook is in the air.
      backdrop.animate([{ opacity: 0 }, { opacity: 0, offset: .35, easing: "ease-in-out" }, { opacity: 1, offset: .75 }, { opacity: 1 }], lift),
    );
    // Then it is thumbed through, leaf by leaf, overlapping like pages under
    // a thumb, each in one unbroken motion (leafFlight).
    // No shading or cast shadows: they flickered as the pages turned.
    const leaves = Array.from(screen.querySelectorAll<HTMLElement>("[data-notebook-leaf]"));
    const timing = (index: number) => {
      const last = index === leaves.length - 1;
      return { delay: BOOK_LIFT - RIFFLE_OVERLAP + leafStart(index, leaves.length), duration: last ? LAST_LEAF_TURN : LEAF_TURN };
    };
    leaves.forEach((leaf, index) => {
      const turn = { ...timing(index), fill: "both" } as const;
      const below = (leaves.length - index) * 2, above = (index + 1) * 2 + 2;
      current.animations.push(leaf.animate(leafFlight(below, above), { ...turn, easing: "linear" }));
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
        // The last spread holds only a breath, then the notebook dissolves as
        // the page's rows rise into place (WritingWorld.module.css); it is
        // nearly gone before they appear, so the essays on the pages never
        // sit on top of the archive's titles.
        document.documentElement.dataset[attribute] = "revealing";
        const open = { duration: ENTRY_ARRIVAL_DURATION, fill: "forwards" } as const;
        const rest = bookPose(innerWidth / 2, innerHeight / 2, 0, 0, 1);
        const dock = current.fader.animate([
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: .15, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
          { opacity: 0, offset: .9 },
          { opacity: 0, offset: 1 },
        ], open);
        current.animations.push(
          dock,
          current.screen.animate([
            { transform: rest, offset: 0 },
            { transform: rest, offset: .15, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
            { transform: rest.replace(/scale\([^)]*\)$/, "scale(1.025)"), offset: .9 },
            { transform: rest.replace(/scale\([^)]*\)$/, "scale(1.025)"), offset: 1 },
          ], open),
          current.backdrop.animate([{ opacity: 1 }, { opacity: 1, offset: .15, easing: "cubic-bezier(0.45, 0, 0.55, 1)" }, { opacity: 0, offset: .9 }, { opacity: 0 }], open),
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
