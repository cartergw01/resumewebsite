"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Pixelify_Sans } from "next/font/google";
import { officeCanStand, officeDetailAt, officeObjectAt, officeObjects, officeRoomAt, officeRoute, officeScreenAt, officeStart, officeStops, officeView, type OfficeFacing, type OfficeStop, type OfficeStopId, type Point } from "@/lib/office-plan";
import OfficePlan, { workerFacing, workerPlace } from "./OfficePlan";
import styles from "./OfficeExplorer.module.css";

// The game's own lettering, for everything that belongs to the office: its controls and
// its text box. The room details beside it stay in the site's type.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "600"], preload: false });

type Props = {
  header: ReactNode;
  /** Who and when, for each room. */
  cards: Record<OfficeStopId, ReactNode>;
  /** What happened there, in the copy's own words, for each room's text box. */
  stories: Record<OfficeStopId, ReactNode>;
  /** The job and its dates, at the top of the text box on a phone. */
  roles?: Partial<Record<OfficeStopId, { role: string; dates: string }[]>>;
  list: ReactNode;
  preview?: boolean;
};

const percent = (part: number, whole: number) => `${part / whole * 100}%`;
const ARROWS: Record<string, { facing: OfficeFacing; dx: number; dy: number }> = {
  ArrowUp: { facing: "up", dx: 0, dy: -1 }, ArrowDown: { facing: "down", dx: 0, dy: 1 },
  ArrowLeft: { facing: "left", dx: -1, dy: 0 }, ArrowRight: { facing: "right", dx: 1, dy: 0 },
};
const SPEED = 92; // Pixels of art a second, on foot under the player's control.
const SLIDE = 9; // How far off a gap he can be and still be steered into it.
const TYPE_RATE = 110; // Characters a second in the text box.
const objectNear = ([x, y]: Point) => officeObjectAt(x, y)?.id ?? null;
const screenNear = ([x, y]: Point) => officeScreenAt(x, y);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Kept out of React's way: once a page is on screen its characters are wrapped one by one.
const StoryPage = memo(function StoryPage({ node }: { node: ReactNode }) {
  return <div>{node}</div>;
});

function Arrow({ direction }: { direction: OfficeFacing }) {
  const turn = { right: 0, down: 90, left: 180, up: 270 }[direction];
  return <svg viewBox="0 0 5 7" aria-hidden="true" shapeRendering="crispEdges" style={{ transform: `rotate(${turn}deg)` }}><path d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0Z" /></svg>;
}

// The real cluster, inverted T and all. Each key lights while it's held.
function ArrowKeys() {
  return <span className={styles.arrowKeys} role="img" aria-label="Arrow keys">
    {(["up", "left", "down", "right"] as const).map(direction => <kbd key={direction} className={styles.key} data-arrow={direction}><Arrow direction={direction} /></kbd>)}
  </span>;
}

// A pair of eyes, in the art's own pixels, looking across the office.
function TourIcon() {
  const eye = (x: number) => <g key={x} transform={`translate(${x} 0)`}>
    <path fill="currentColor" d="M2 0h4v1h1v1h1v10H7v1H6v1H2v-1H1v-1H0V2h1V1h1Z" />
    <path fill="#ffffff" d="M2 1h4v1h1v10H6v1H2v-1H1V2h1Z" />
    <rect fill="#15121c" x="4" y="5" width="3" height="5" />
  </g>;
  return <svg className={styles.eyes} viewBox="0 0 18 14" aria-hidden="true" shapeRendering="crispEdges">{[0, 10].map(eye)}</svg>;
}

function ListIcon() {
  return <svg className={styles.modeIcon} viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path d="M1 3h3v3H1Zm5 0h9v3H6ZM1 10h3v3H1Zm5 0h9v3H6Z" /></svg>;
}

export default function OfficeExplorer({ header, cards, stories, roles, list, preview = false }: Props) {
  const [selected, setSelected] = useState<OfficeStopId>("now");
  const [lit, setLit] = useState<OfficeStopId | null>("now");
  const [view, setView] = useState<"office" | "list">("office");
  const [near, setNear] = useState<string | null>(null);
  const [screen, setScreen] = useState<string | null>(null);
  const [attention, setAttention] = useState<string | null>(null);
  const [walked, setWalked] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [typing, setTyping] = useState(false);
  const [more, setMore] = useState(false);
  const worker = useRef<HTMLDivElement>(null);
  const tour = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const plan = useRef<HTMLDivElement>(null);
  const storyEl = useRef<HTMLDivElement>(null);
  const storyBody = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLDivElement>(null);
  const spot = useRef<Point>(officeStart);
  const facingRef = useRef<OfficeFacing>("up");
  const trip = useRef<{ stop: () => void } | null>(null);
  const finishTyping = useRef<(() => void) | null>(null);
  const firstPage = useRef(true);
  const followRef = useRef<() => void>(() => {});
  const lookAt = useRef<Point | null>(null);
  const keys = useRef<{ press: (key: string) => void; release: (key: string) => void }>({ press: () => {}, release: () => {} });
  const panelId = useId();
  const index = officeStops.findIndex(item => item.id === selected);
  const stop = officeStops[index];
  const nearby = officeObjects.find(item => item.id === near);

  const leaveFullscreen = useCallback(async () => {
    if (document.fullscreenElement === tour.current) await document.exitFullscreen().catch(() => {});
    setExpanded(false);
  }, []);

  async function toggleFullscreen() {
    if (expanded) { await leaveFullscreen(); return; }
    setExpanded(true);
    // Keep the viewport-filling layout if this browser does not offer native fullscreen.
    try { await tour.current?.requestFullscreen?.(); } catch {}
  }

  useEffect(() => {
    if (!expanded) return;
    const trigger = expandButton.current;
    const desktop = matchMedia("(min-width: 961px)");
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const changed = () => {
      if (document.fullscreenElement !== tour.current) setExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") void leaveFullscreen();
    };
    const resized = () => { if (!desktop.matches) void leaveFullscreen(); };
    document.addEventListener("fullscreenchange", changed);
    window.addEventListener("keydown", escape);
    desktop.addEventListener("change", resized);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("fullscreenchange", changed);
      window.removeEventListener("keydown", escape);
      desktop.removeEventListener("change", resized);
      trigger?.focus({ preventScroll: true });
    };
  }, [expanded, leaveFullscreen]);

  // With the whole office on a phone, a long name near a wall would run off the map. Slide it back in.
  const bubble = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = bubble.current;
    const frame = stage.current;
    if (!el || !frame) return;
    el.style.translate = "";
    if (zoomed) return;
    const box = el.getBoundingClientRect();
    const edge = frame.getBoundingClientRect();
    el.style.translate = `${Math.max(edge.left + 4 - box.left, 0) + Math.min(edge.right - 4 - box.right, 0)}px`;
  }, [near, zoomed, expanded]);

  const enter = useCallback((id: OfficeStopId) => {
    setSelected(id);
  }, []);

  const sense = useCallback((point: Point) => {
    setNear(objectNear(point));
    setScreen(screenNear(point));
    setAttention(officeDetailAt(...point, facingRef.current));
  }, []);

  const stand = useCallback((point: Point, facing?: OfficeFacing) => {
    spot.current = point;
    if (facing) facingRef.current = facing;
    const marker = worker.current;
    if (!marker) return;
    marker.style.transform = workerPlace(point);
    if (facing) marker.style.backgroundPositionY = workerFacing(facing);
  }, []);

  // Sent somewhere: he walks by the doors. The room behind goes dark as he leaves,
  // and the story changes at once so nobody waits for the walk.
  const goTo = useCallback((target: OfficeStop, exact?: Point) => {
    const marker = worker.current;
    trip.current?.stop();
    lookAt.current = null;
    setWalked(true);
    setNear(null);
    setScreen(null);
    setAttention(null);
    const moving = officeRoomAt(...spot.current) !== target.id;
    if (selected !== target.id) enter(target.id);
    if (!marker) return;
    const goal: Point = exact ?? target.point;
    const arrive = (facing?: OfficeFacing) => {
      stand(goal, facing ?? (exact ? undefined : target.facing));
      setLit(target.id);
      sense(goal);
    };
    if (preview || reducedMotion()) { arrive(); followRef.current(); return; }
    const route = officeRoute(spot.current, goal);
    const lengths = route.map((point, at) => at ? Math.abs(point[0] - route[at - 1][0]) + Math.abs(point[1] - route[at - 1][1]) : 0);
    const distance = lengths.reduce((sum, length) => sum + length, 0);
    if (!distance) { arrive(); return; }
    if (moving) setLit(null);
    let travelled = 0;
    const frames = route.map((point, at) => {
      travelled += lengths[at];
      return { transform: workerPlace(point), offset: travelled / distance };
    });
    const timing = { duration: Math.min(1900, Math.max(320, distance * 5.5)), easing: "linear" };
    const facingOf = (from: Point, to: Point): OfficeFacing => to[0] > from[0] ? "right" : to[0] < from[0] ? "left" : to[1] > from[1] ? "down" : "up";
    const lastFacing = facingOf(route[route.length - 2], route[route.length - 1]);
    const settled = exact ? lastFacing : target.facing;
    const faces = route.map((point, at) => {
      const ahead = route[at + 1];
      if (!ahead) return { backgroundPositionY: workerFacing(settled), offset: 1, easing: "steps(1, end)" };
      return { backgroundPositionY: workerFacing(facingOf(point, ahead)), offset: frames[at].offset, easing: "steps(1, end)" };
    });
    marker.dataset.walking = "true";
    const animations = [marker.animate(frames, timing), marker.animate(faces, timing)];
    const light = window.setTimeout(() => setLit(target.id), Math.max(0, timing.duration - 160));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(light);
      marker.dataset.walking = "false";
      trip.current = null;
    };
    animations[0].onfinish = () => { finish(); arrive(settled); followRef.current(); };
    followRef.current();
    trip.current = {
      // Interrupted: he stops where he has got to, not where he was going.
      stop: () => {
        const progress = Number(animations[0].currentTime ?? 0) / timing.duration;
        let left = progress * distance, at = 1;
        while (at < route.length - 1 && left > lengths[at]) { left -= lengths[at]; at++; }
        const a = route[at - 1], b = route[at], share = lengths[at] ? Math.min(1, left / lengths[at]) : 1;
        const point: Point = [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share];
        finish();
        animations.forEach(animation => animation.cancel());
        stand(point, facingOf(a, b));
      },
    };
  }, [preview, stand, sense, enter, selected]);

  // Is there more of the story below the fold of the text box?
  const measureMore = useCallback(() => {
    const body = storyBody.current;
    setMore(Boolean(body && body.scrollTop + body.clientHeight < body.scrollHeight - 6));
  }, []);

  // A long story reads like the games': finish this page, then on to the next.
  const readOn = useCallback(() => {
    if (finishTyping.current) { finishTyping.current(); return; }
    const body = storyBody.current;
    if (!body || body.scrollTop + body.clientHeight >= body.scrollHeight - 6) return;
    // The next page starts on the line the fold cut, so it never opens on half a line.
    const box = body.getBoundingClientRect();
    const words = document.createRange();
    words.selectNodeContents(body);
    const cut = [...words.getClientRects()].find(line => line.height > 0 && line.height < 48 && line.top > box.top + 8 && line.bottom > box.bottom - 30);
    words.detach();
    body.scrollBy({ top: cut ? cut.top - box.top - 8 : Math.max(body.clientHeight - 48, 48), behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);

  // The one action, for Enter and the Open button: open what he is standing at, or read on.
  const actRef = useRef<() => void>(() => {});
  useEffect(() => {
    actRef.current = () => {
      const link = plan.current?.querySelector<HTMLAnchorElement>("a[data-object][data-near='true']");
      if (link) { link.click(); return; }
      readOn();
    };
  });

  // Every room's story starts from its top.
  useLayoutEffect(() => {
    if (storyBody.current) storyBody.current.scrollTop = 0;
    measureMore();
  }, [selected, view, measureMore]);

  useEffect(() => {
    const body = storyBody.current;
    if (!body || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measureMore);
    watch.observe(body);
    return () => watch.disconnect();
  }, [view, measureMore]);

  // Type the story out when the room changes. The text is all there from the start, so the box
  // doesn't jump and links stay real; only the characters' visibility moves.
  useEffect(() => {
    const box = storyEl.current;
    if (firstPage.current) { firstPage.current = false; return; }
    if (!box || preview || reducedMotion()) return;
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const letters: HTMLSpanElement[] = [];
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const character of node.data) {
        const letter = document.createElement("span");
        letter.textContent = character;
        letter.style.visibility = "hidden";
        letters.push(letter);
        fragment.append(letter);
      }
      node.replaceWith(fragment);
    }
    // Only this page of the box types out. What's below the fold is simply there when you get to it,
    // so scrolling never finds a blank, and screen readers and Tab always have all of it.
    const fold = (storyBody.current?.getBoundingClientRect().bottom ?? Infinity) - 14;
    let low = 0, high = letters.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (letters[middle].getBoundingClientRect().bottom > fold) high = middle; else low = middle + 1;
    }
    const end = low;
    let frame = 0, shown = 0;
    const started = performance.now();
    const finish = () => {
      cancelAnimationFrame(frame);
      for (const letter of letters) letter.replaceWith(document.createTextNode(letter.textContent ?? ""));
      box.normalize();
      finishTyping.current = null;
      setTyping(false);
    };
    const tick = (now: number) => {
      const target = Math.min(end, Math.floor((now - started) / 1000 * TYPE_RATE));
      while (shown < target) letters[shown++].style.visibility = "";
      if (shown >= end) { finish(); return; }
      frame = requestAnimationFrame(tick);
    };
    finishTyping.current = finish;
    frame = requestAnimationFrame(tick);
    const beginning = requestAnimationFrame(() => setTyping(true));
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(beginning); finishTyping.current = null; };
  }, [selected, preview]);

  // The camera keeps him in the middle of the frame, stopping at the walls.
  useEffect(() => {
    const frameEl = stage.current, sheet = plan.current, marker = worker.current;
    if (preview || view !== "office" || !frameEl || !sheet || !marker) return;
    let frame = 0, x = 0, y = 0, placed = false, last = 0;
    const measure = () => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(marker).transform);
      const clamp = (value: number, low: number) => Math.min(0, Math.max(low, value));
      const scale = sheet.offsetWidth / officeView.width;
      const [lookX, lookY] = lookAt.current
        ? [lookAt.current[0] * scale, lookAt.current[1] * scale]
        : [matrix.e + marker.offsetWidth / 2, matrix.f + marker.offsetHeight / 2];
      return [
        clamp(frameEl.clientWidth / 2 - lookX, frameEl.clientWidth - sheet.offsetWidth),
        clamp(frameEl.clientHeight / 2 - lookY, frameEl.clientHeight - sheet.offsetHeight),
      ];
    };
    const paint = (now: number) => {
      frame = 0;
      if (!zoomed) { sheet.style.transform = ""; placed = false; return; }
      const [goalX, goalY] = measure();
      const ease = placed ? 1 - Math.exp(-(now - last) / 110) : 1;
      x += (goalX - x) * ease; y += (goalY - y) * ease;
      placed = true; last = now;
      sheet.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      if (marker.dataset.walking === "true" || Math.abs(goalX - x) > .5 || Math.abs(goalY - y) > .5) frame = requestAnimationFrame(paint);
    };
    const follow = () => { if (!frame) frame = requestAnimationFrame(paint); };
    followRef.current = follow;
    follow();
    const resize = new ResizeObserver(follow);
    resize.observe(frameEl);
    window.addEventListener("resize", follow);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      followRef.current = () => {};
      window.removeEventListener("resize", follow);
      sheet.style.transform = "";
    };
  }, [preview, view, zoomed]);

  // Walking. The keys and the on-screen pad press the same buttons. The details follow
  // him: walk into a room and it lights, and its story is what you read.
  useEffect(() => {
    if (preview || view !== "office") return;
    const held: string[] = [];
    let frame = 0, last = 0;
    let room: OfficeStopId | null = officeRoomAt(...spot.current);
    let tabbing = false;

    const lightKey = (key: string, on: boolean) => {
      const name = ARROWS[key]?.facing;
      if (name) legend.current?.querySelector(`[data-arrow="${name}"]`)?.toggleAttribute("data-held", on);
    };

    const step = (now: number) => {
      const marker = worker.current;
      const key = held.at(-1);
      if (!marker || !key) { frame = 0; if (marker) marker.dataset.walking = "false"; return; }
      const { facing, dx, dy } = ARROWS[key];
      const distance = Math.min(40, now - last) / 1000 * SPEED;
      last = now;
      marker.style.backgroundPositionY = workerFacing(facing);
      facingRef.current = facing;
      const [x, y] = spot.current;
      let moved: Point = [x + dx * distance, y + dy * distance];
      let free = officeCanStand(...moved);
      // Clipping a corner slides him round it, so doors don't need lining up exactly.
      for (let slide = 1; !free && slide <= SLIDE; slide++) {
        for (const side of [1, -1]) {
          if (free || !officeCanStand(moved[0] + dy * side * slide, moved[1] + dx * side * slide)) continue;
          moved = [x + dy * side * distance, y + dx * side * distance];
          free = officeCanStand(...moved);
        }
      }
      marker.dataset.walking = free ? "true" : "false";
      if (free) {
        stand(moved);
        const here = officeRoomAt(...moved);
        if (here !== room) {
          room = here;
          setLit(here);
          if (here) enter(here);
        }
        followRef.current();
      }
      // Turning at a desk or a wall still changes what he is looking at.
      sense(spot.current);
      frame = requestAnimationFrame(step);
    };

    const press = (key: string) => {
      if (!ARROWS[key] || held.includes(key)) return;
      trip.current?.stop();
      room = officeRoomAt(...spot.current);
      held.push(key);
      setWalked(true);
      lightKey(key, true);
      if (!frame) { last = performance.now(); frame = requestAnimationFrame(step); }
    };
    const release = (key: string) => { const at = held.indexOf(key); if (at >= 0) held.splice(at, 1); lightKey(key, false); };
    keys.current = { press, release };

    const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    const onScreen = () => {
      const bounds = stage.current?.getBoundingClientRect();
      return Boolean(bounds && bounds.bottom > 80 && bounds.top < innerHeight - 80);
    };
    // Someone tabbing to a link or the details is reading: leave their keys alone.
    const reading = () => {
      const active = document.activeElement;
      return tabbing && active instanceof HTMLElement && active !== document.body && !active.closest("[data-office-map]");
    };
    const down = (event: KeyboardEvent) => {
      if (event.key === "Tab") { tabbing = true; return; }
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target) || reading()) return;
      if (event.key === "Enter") {
        // Focused controls own Enter even if focus arrived before this effect
        // heard Tab (or came from assistive technology). Do not swallow it.
        if (document.activeElement?.matches("button, a")) return;
        if (!onScreen()) return;
        event.preventDefault();
        actRef.current();
        return;
      }
      if (!ARROWS[event.key] || !onScreen()) return;
      event.preventDefault();
      press(event.key);
    };
    const up = (event: KeyboardEvent) => release(event.key);
    const pointer = () => { tabbing = false; };
    const blur = () => { for (const key of [...held]) release(key); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerdown", pointer);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerdown", pointer);
      window.removeEventListener("blur", blur);
    };
  }, [preview, view, stand, sense, enter]);

  useEffect(() => () => trip.current?.stop(), []);

  // Pressing a floor: another room sends him to its usual spot, his own lets him walk to that spot.
  function pressFloor(item: OfficeStop, event: React.MouseEvent<HTMLButtonElement>) {
    if (event.detail) event.currentTarget.blur();
    const bounds = plan.current?.getBoundingClientRect();
    if (bounds && event.detail && item.id === officeRoomAt(...spot.current)) {
      const goal: Point = [(event.clientX - bounds.left) / bounds.width * officeView.width, (event.clientY - bounds.top) / bounds.height * officeView.height];
      if (officeCanStand(...goal)) { goTo(item, goal); return; }
    }
    goTo(item);
  }

  const renderRoom = (item: OfficeStop) => {
    const [x, y, width, height] = item.box;
    return <button
      key={item.id}
      type="button"
      className={styles.room}
      data-stop={item.id}
      aria-label={item.label}
      aria-pressed={selected === item.id}
      aria-controls={panelId}
      style={{ left: percent(x, officeView.width), top: percent(y, officeView.height), width: percent(width, officeView.width), height: percent(height, officeView.height) }}
      onClick={event => pressFloor(item, event)}
      onFocus={event => {
        if (!event.currentTarget.matches(":focus-visible")) return;
        lookAt.current = [x + width / 2, y + height / 2];
        followRef.current();
      }}
      onBlur={() => { lookAt.current = null; followRef.current(); }}
    />;
  };

  // Real links on the map: a pointer, a walk or the Tab key all reach them, and focus names them.
  const renderObject = (item: (typeof officeObjects)[number]) => {
    const [x, y, width, height] = item.box;
    const place = { left: percent(x, officeView.width), top: percent(y, officeView.height), width: percent(width, officeView.width), height: percent(height, officeView.height) };
    const pointer = {
      onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType === "mouse") setNear(item.id); },
      onPointerLeave: (event: React.PointerEvent) => { if (event.pointerType === "mouse") setNear(objectNear(spot.current)); },
    };
    // Someone without a page of their own just says who they are.
    if (!item.href) return <span key={item.id} className={styles.object} data-object={item.id} data-near={near === item.id} data-person style={{ ...place, cursor: "default" }} {...pointer} />;
    const external = item.href.startsWith("http");
    return <a
      key={item.id}
      className={styles.object}
      data-object={item.id}
      data-near={near === item.id}
      data-person={item.person || undefined}
      href={item.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={item.label}
      style={place}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setNear(item.id); }}
      onBlur={() => setNear(objectNear(spot.current))}
      {...pointer}
    />;
  };

  const padButton = (key: string, facing: OfficeFacing) => <button
    type="button"
    tabIndex={-1}
    aria-hidden="true"
    className={styles.padKey}
    data-key={facing}
    onPointerDown={event => {
      event.preventDefault();
      // Keep walking if a thumb slides off the key. Some browsers refuse capture, and that's fine.
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
      keys.current.press(key);
      // Keep the map and the pad on screen together on small phones.
      const pad = event.currentTarget.parentElement!.getBoundingClientRect();
      if (pad.bottom > innerHeight - 80) stage.current?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }}
    onPointerUp={() => keys.current.release(key)}
    onPointerCancel={() => keys.current.release(key)}
    onContextMenu={event => event.preventDefault()}
  ><Arrow direction={facing} /></button>;

  return <div className={styles.explorer} data-office-explorer data-view={view} data-selected={selected} data-expanded={expanded}
    onClick={event => { if (event.target instanceof Element && event.target.closest("button, [data-office-map]")) event.stopPropagation(); }}>
    <div className={styles.tourView} ref={tour}>
    <div className={styles.intro}>
      {header}
    <div className={`${styles.toolbar} ${pixel.className}`}>
      {/* Say up front that this is a place you can walk, and offer the fast way past it. */}
      <div className={styles.modes} role="group" aria-label="How to read this page">
        <button type="button" aria-pressed={view === "office"} onClick={event => { if (event.detail) event.currentTarget.blur(); setView("office"); }}><TourIcon />Tour the office</button>
        {!preview && view === "office" && <button type="button" className={`${styles.utilityButton} ${styles.mapToggle}`} aria-label={zoomed ? "See whole office" : "Zoom in"} title={zoomed ? "See whole office" : "Zoom in"} onClick={event => {
          if (event.detail) event.currentTarget.blur();
          setZoomed(!zoomed);
        }}>
          <svg className={styles.zoomIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" /><path d="m10 10 4 4M4 6.5h5" />{!zoomed && <path d="M6.5 4v5" />}</svg>
        </button>}
        {!preview && view === "office" && <button ref={expandButton} type="button" className={`${styles.utilityButton} ${styles.expandButton}`} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen (Esc)" : "Full screen"} aria-pressed={expanded} onClick={toggleFullscreen}>
          <svg className={styles.modeIcon} viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.5" d={expanded ? "M1 5h4V1m6 0v4h4M1 11h4v4m6 0v-4h4" : "M1 6V1h5m4 0h5v5M1 10v5h5m4 0h5v-5"} /></svg>
        </button>}
        <button type="button" className={styles.listButton} aria-label="Read as a list" aria-pressed={view === "list"} onClick={async event => {
          if (event.detail) event.currentTarget.blur();
          await leaveFullscreen();
          setView("list");
        }}><ListIcon /><span>Read as a list</span></button>
      </div>
    </div>
    </div>
    {view === "office" && <div className={styles.world}>
      <div className={styles.stage} ref={stage} data-zoomed={zoomed} data-fresh={!walked && !preview} data-office-map onScroll={event => {
        // Tabbing to an off-camera room makes the browser scroll here. The camera does that job.
        event.currentTarget.scrollTop = 0;
        event.currentTarget.scrollLeft = 0;
      }}>
        <div className={styles.plan} ref={plan} role="group" aria-label="Rooms in the office">
          <OfficePlan workerRef={worker} lit={lit} screen={screen} attention={attention} preview={preview} sign={!walked && <div className={`${styles.youAreHere} ${pixel.className}`}>You are here</div>}>
            {officeStops.map(renderRoom)}
            {!preview && officeObjects.filter(item => item.room === selected).map(renderObject)}
            {!preview && nearby && <div ref={bubble} className={`${styles.prompt} ${pixel.className}`} data-under={nearby.box[1] < 24} aria-hidden="true" style={{
              left: percent(Math.min(officeView.width - 48, Math.max(48, nearby.box[0] + nearby.box[2] / 2)), officeView.width),
              top: percent(nearby.box[1] < 24 ? nearby.box[1] + nearby.box[3] : nearby.box[1], officeView.height),
            }}>
              <span>{nearby.label}</span>{nearby.href && <kbd className={styles.key}>Enter</kbd>}
            </div>}
          </OfficePlan>
        </div>
      </div>

      <div className={styles.side}>
      {!preview && <div className={styles.pad} aria-hidden="true">
          <div className={styles.padCross}>
            {padButton("ArrowUp", "up")}
            {padButton("ArrowLeft", "left")}
            {padButton("ArrowRight", "right")}
            {padButton("ArrowDown", "down")}
            <button type="button" tabIndex={-1} className={`${styles.padAction} ${pixel.className}`} data-ready={Boolean(nearby?.href)} onClick={() => actRef.current()}>Open</button>
          </div>
        </div>}
      {/* The story, in the game: typed out, with Enter or a tap to skip ahead and read on. */}
      <div className={`${styles.textBox} ${pixel.className}`} data-typing={typing} data-more={more} onClick={event => {
        if (event.target instanceof Element && event.target.closest("a")) return;
        readOn();
      }}>
        <div className={styles.textBoxBody} ref={storyBody} onScroll={measureMore}>
          <p className={styles.textBoxName}>{stop.label}</p>
          {roles?.[selected]?.map(item => <p key={item.role} className={styles.textBoxRole}><span>{item.role}</span> <span>{item.dates}</span></p>)}
          <div className={styles.textBoxPage} ref={storyEl} role="region" aria-label={`The story of ${stop.label}`} aria-busy={typing}>
            <StoryPage key={selected} node={stories[selected]} />
          </div>
        </div>
        {more && !typing && <span className={styles.textBoxMore} aria-hidden="true"><Arrow direction="down" /></span>}
      </div>

      <div className={`${styles.legend} ${pixel.className}`} ref={legend} data-fresh={!walked && !preview}>
        <span><ArrowKeys /> walk</span>
        <span><kbd className={styles.key}>Enter</kbd> open</span>
      </div>

      </div>
    </div>}
    </div>
    {view === "office" && cards[selected] && <div className={styles.detail} id={panelId} role="region" aria-label={stop.label} aria-live={preview ? "off" : "polite"} aria-atomic="true" tabIndex={0}>
        <div key={selected} className={styles.detailEnter}>
          <div className={styles.card}>{cards[selected]}</div>
        </div>
      </div>}
    {view === "list" && <div className={styles.list}>{list}</div>}
  </div>;

}
