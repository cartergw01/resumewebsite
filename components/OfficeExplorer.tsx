"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Pixelify_Sans } from "next/font/google";
import { officeCanStand, officeObjectAt, officeObjects, officeRoomAt, officeRoute, officeStops, officeView, type OfficeFacing, type OfficeStop, type OfficeStopId, type Point } from "@/lib/office-plan";
import OfficePlan, { workerFacing, workerPlace } from "./OfficePlan";
import styles from "./OfficeExplorer.module.css";

// The game's own lettering, for the office's controls: details stay in the site's type.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "600"], preload: false });

type Props = {
  header: ReactNode;
  panels: Record<OfficeStopId, ReactNode>;
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
const objectNear = ([x, y]: Point) => officeObjectAt(x, y)?.id ?? null;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function OfficeExplorer({ header, panels, list, preview = false }: Props) {
  const [selected, setSelected] = useState<OfficeStopId>("now");
  const [lit, setLit] = useState<OfficeStopId | null>("now");
  const [view, setView] = useState<"office" | "list">("office");
  const [near, setNear] = useState<string | null>(null);
  const [walked, setWalked] = useState(false);
  const worker = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const plan = useRef<HTMLDivElement>(null);
  const spot = useRef<Point>(officeStops[0].point);
  const trip = useRef<{ stop: () => void } | null>(null);
  const panelId = useId();
  const index = officeStops.findIndex(item => item.id === selected);
  const stop = officeStops[index];
  const next = officeStops[(index + 1) % officeStops.length];
  const nearby = officeObjects.find(item => item.id === near);

  const stand = useCallback((point: Point, facing?: OfficeFacing) => {
    spot.current = point;
    const marker = worker.current;
    if (!marker) return;
    marker.style.transform = workerPlace(point);
    if (facing) marker.style.backgroundPositionY = workerFacing(facing);
  }, []);

  // Sent to a room: he walks there by the doors. The room behind goes dark as he
  // leaves, and the details change at once so nobody waits for the walk.
  const goTo = useCallback((target: OfficeStop) => {
    const marker = worker.current;
    trip.current?.stop();
    setSelected(target.id);
    setNear(null);
    setWalked(true);
    if (!marker) return;
    if (preview || reducedMotion()) {
      stand(target.point, target.facing);
      setLit(target.id);
      setNear(objectNear(target.point));
      return;
    }
    const route = officeRoute(spot.current, target.point);
    const lengths = route.map((point, at) => at ? Math.abs(point[0] - route[at - 1][0]) + Math.abs(point[1] - route[at - 1][1]) : 0);
    const distance = lengths.reduce((sum, length) => sum + length, 0);
    if (!distance) { stand(target.point, target.facing); setLit(target.id); setNear(objectNear(target.point)); return; }
    setLit(null);
    let travelled = 0;
    const frames = route.map((point, at) => {
      travelled += lengths[at];
      return { transform: workerPlace(point), offset: travelled / distance };
    });
    const timing = { duration: Math.min(1900, Math.max(420, distance * 5.5)), easing: "linear" };
    const faces = route.map((point, at) => {
      const ahead = route[at + 1];
      if (!ahead) return { backgroundPositionY: workerFacing(target.facing), offset: 1, easing: "steps(1, end)" };
      const dx = ahead[0] - point[0], dy = ahead[1] - point[1];
      const facing: OfficeFacing = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
      return { backgroundPositionY: workerFacing(facing), offset: frames[at].offset, easing: "steps(1, end)" };
    });
    marker.dataset.walking = "true";
    const animations = [marker.animate(frames, timing), marker.animate(faces, timing)];
    const arrive = window.setTimeout(() => setLit(target.id), Math.max(0, timing.duration - 160));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(arrive);
      marker.dataset.walking = "false";
      trip.current = null;
    };
    animations[0].onfinish = () => {
      finish();
      stand(target.point, target.facing);
      setLit(target.id);
      setNear(objectNear(target.point));
    };
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
        stand(point);
        marker.style.backgroundPositionY = getComputedStyle(marker).backgroundPositionY;
      },
    };
  }, [preview, stand]);

  // Arrow keys put you in his shoes, whenever the office is on screen. The details
  // follow him: walk into a room and it lights, and its story is what you read.
  useEffect(() => {
    if (preview || view !== "office") return;
    const held: string[] = [];
    let frame = 0, last = 0;
    let room: OfficeStopId | null = officeRoomAt(...spot.current);
    let object: string | null = null;

    const step = (now: number) => {
      const marker = worker.current;
      const key = held.at(-1);
      if (!marker || !key) { frame = 0; if (marker) marker.dataset.walking = "false"; return; }
      const { facing, dx, dy } = ARROWS[key];
      const distance = Math.min(40, now - last) / 1000 * SPEED;
      last = now;
      marker.style.backgroundPositionY = workerFacing(facing);
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
          if (here) setSelected(here);
        }
        const reachable = objectNear(moved);
        if (reachable !== object) { object = reachable; setNear(reachable); }
      }
      frame = requestAnimationFrame(step);
    };

    const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    const onScreen = () => {
      const bounds = map.current?.getBoundingClientRect();
      return Boolean(bounds && bounds.bottom > 80 && bounds.top < innerHeight - 80);
    };
    const down = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      // Enter opens what he is standing at, unless the keyboard has moved focus to a control.
      if (event.key === "Enter" && !(document.activeElement?.matches("button:focus-visible, a:focus-visible"))) {
        const link = plan.current?.querySelector<HTMLAnchorElement>("[data-object][data-near='true']");
        if (link) { event.preventDefault(); link.click(); }
        return;
      }
      if (!ARROWS[event.key] || !onScreen()) return;
      event.preventDefault();
      if (held.includes(event.key)) return;
      trip.current?.stop();
      room = officeRoomAt(...spot.current);
      held.push(event.key);
      setWalked(true);
      if (!frame) { last = performance.now(); frame = requestAnimationFrame(step); }
    };
    const up = (event: KeyboardEvent) => { const at = held.indexOf(event.key); if (at >= 0) held.splice(at, 1); };
    const release = () => { held.length = 0; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, [preview, view, stand]);

  useEffect(() => () => trip.current?.stop(), []);

  // Next sits at the end of the details, so bring the walk back into view.
  function walkOn() {
    goTo(next);
    const target = map.current;
    if (target && matchMedia("(max-width: 960px)").matches && target.getBoundingClientRect().top < 0) {
      target.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
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
      onClick={event => {
        // A pointer press shouldn't keep focus here, or Enter would press this again.
        if (event.detail) event.currentTarget.blur();
        goTo(item);
      }}
    />;
  };

  // The same links as the copy beside it, so these stay out of the tab order.
  const renderObject = (item: (typeof officeObjects)[number]) => {
    const [x, y, width, height] = item.box;
    const external = item.href.startsWith("http");
    return <a
      key={item.id}
      className={styles.object}
      data-object={item.id}
      data-person={item.person || undefined}
      data-near={near === item.id}
      href={item.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      tabIndex={-1}
      aria-hidden="true"
      style={{ left: percent(x, officeView.width), top: percent(y, officeView.height), width: percent(width, officeView.width), height: percent(height, officeView.height) }}
      onPointerEnter={() => setNear(item.id)}
      onPointerLeave={() => setNear(objectNear(spot.current))}
    />;
  };

  const viewSwitch = <button type="button" className={`${styles.viewSwitch} ${pixel.className}`} onClick={() => setView(view === "office" ? "list" : "office")}>
    {view === "office" ? "View as list" : "Back to office"}
  </button>;

  return <div className={styles.explorer} data-office-explorer data-view={view} data-selected={selected}>
    <div className={styles.intro}>{header}</div>
    <h2 className={styles.visuallyHidden}>The Office</h2>
    {view !== "office" && viewSwitch}
    <div className={styles.mapColumn} ref={map} hidden={view !== "office"}>
      <div className={styles.plan} ref={plan} role="group" aria-label="Rooms in the office">
        <OfficePlan workerRef={worker} lit={lit} active="now" bubble={!preview && !walked && !nearby && <div className={`${styles.prompt} ${pixel.className}`} aria-hidden="true"><span>Walk with the arrow keys</span></div>}>
          {officeStops.map(renderRoom)}
          {!preview && officeObjects.filter(item => item.room === selected).map(renderObject)}
          {!preview && nearby && <div className={`${styles.prompt} ${styles.promptOver} ${pixel.className}`} data-under={nearby.box[1] < 24} aria-hidden="true" style={{
            left: percent(Math.min(officeView.width - 48, Math.max(48, nearby.box[0] + nearby.box[2] / 2)), officeView.width),
            top: percent(nearby.box[1] < 24 ? nearby.box[1] + nearby.box[3] : nearby.box[1], officeView.height),
          }}>
            <span>{nearby.label}</span><kbd>Enter</kbd>
          </div>}
        </OfficePlan>
      </div>
    </div>
    <div className={styles.detail} id={panelId} role="region" aria-label={stop.label} aria-live={preview ? "off" : "polite"} aria-atomic="true" hidden={view !== "office"}>
      <div key={selected} className={styles.detailEnter}>{panels[selected]}</div>
      <div className={styles.detailEnd}>
        <button type="button" className={`${styles.nextRoom} ${pixel.className}`} onClick={walkOn}>
          <span>Next: {next.label}</span>
          <svg viewBox="0 0 5 7" aria-hidden="true" shapeRendering="crispEdges"><path d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0Z" /></svg>
        </button>
        {viewSwitch}
      </div>
    </div>
    <div hidden={view !== "list"} className={styles.list}>{list}</div>
  </div>;
}
