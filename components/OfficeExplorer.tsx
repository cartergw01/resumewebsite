"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Pixelify_Sans } from "next/font/google";
import { officeRoute, officeStops, officeView, type OfficeFacing, type OfficeStop, type OfficeStopId } from "@/lib/office-plan";
import OfficePlan, { workerFacing, workerPlace } from "./OfficePlan";
import styles from "./OfficeExplorer.module.css";

// The game's own lettering, for the menu only: details stay in the site's type.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "600"], preload: false });

type Props = {
  header: ReactNode;
  panels: Record<OfficeStopId, ReactNode>;
  list: ReactNode;
  preview?: boolean;
};

const percent = (part: number, whole: number) => `${part / whole * 100}%`;

export default function OfficeExplorer({ header, panels, list, preview = false }: Props) {
  const [selected, setSelected] = useState<OfficeStopId>("now");
  const [lit, setLit] = useState<OfficeStopId | null>("now");
  const [view, setView] = useState<"office" | "list">("office");
  const worker = useRef<HTMLDivElement>(null);
  const names = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const previous = useRef<OfficeStopId>(selected);
  const panelId = useId();
  const index = officeStops.findIndex(item => item.id === selected);
  const stop = officeStops[index];
  const next = officeStops[(index + 1) % officeStops.length];

  // The menu is two columns of four: up and down stay in a column, left and right cross it.
  function moveCursor(event: KeyboardEvent<HTMLDivElement>) {
    const column = index < 4 ? 0 : 4, row = index - column;
    const target = event.key === "ArrowDown" ? column + (row + 1) % 4
      : event.key === "ArrowUp" ? column + (row + 3) % 4
      : event.key === "ArrowLeft" || event.key === "ArrowRight" ? (index + 4) % 8 : -1;
    if (target < 0) return;
    event.preventDefault();
    setSelected(officeStops[target].id);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-stop="${officeStops[target].id}"]`)?.focus();
  }

  // Next sits at the end of the details, so bring the walk back into view.
  function walkOn() {
    setSelected(next.id);
    const narrow = matchMedia("(max-width: 960px)").matches;
    const target = narrow ? map.current : names.current;
    if (target && target.getBoundingClientRect().top < 0) {
      target.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }

  useEffect(() => {
    const marker = worker.current;
    const from: OfficeStop = officeStops.find(item => item.id === previous.current)!;
    previous.current = selected;
    if (!marker) return;
    marker.style.transform = workerPlace(stop.point);
    marker.style.backgroundPositionY = workerFacing(stop.facing);
    marker.dataset.walking = "false";
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    if (preview || from.id === selected || preference.matches) {
      const instant = requestAnimationFrame(() => setLit(selected));
      return () => cancelAnimationFrame(instant);
    }
    // The room behind goes dark as he leaves. The next one lights as he arrives.
    const leaving = requestAnimationFrame(() => setLit(null));
    const route = officeRoute(from, stop);
    const lengths = route.map((point, at) => at ? Math.abs(point[0] - route[at - 1][0]) + Math.abs(point[1] - route[at - 1][1]) : 0);
    const distance = lengths.reduce((sum, length) => sum + length, 0);
    let travelled = 0;
    const frames = route.map((point, at) => {
      travelled += lengths[at];
      return { transform: workerPlace(point), offset: travelled / distance };
    });
    const timing = { duration: Math.min(1900, Math.max(520, distance * 5.5)), easing: "linear" };
    marker.dataset.walking = "true";
    const faces = route.map((point, at) => {
      const ahead = route[at + 1];
      if (!ahead) return { backgroundPositionY: workerFacing(stop.facing), offset: 1, easing: "steps(1, end)" };
      const dx = ahead[0] - point[0], dy = ahead[1] - point[1];
      const facing: OfficeFacing = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
      return { backgroundPositionY: workerFacing(facing), offset: frames[at].offset, easing: "steps(1, end)" };
    });
    const animations = [marker.animate(frames, timing), marker.animate(faces, timing)];
    const arrive = window.setTimeout(() => setLit(selected), Math.max(0, timing.duration - 160));
    animations[0].onfinish = () => { marker.dataset.walking = "false"; };
    const finish = () => { if (preference.matches) { animations.forEach(animation => animation.finish()); setLit(selected); marker.dataset.walking = "false"; } };
    preference.addEventListener("change", finish);
    return () => {
      cancelAnimationFrame(leaving);
      clearTimeout(arrive);
      animations.forEach(animation => animation.cancel());
      marker.dataset.walking = "false";
      preference.removeEventListener("change", finish);
    };
  }, [selected, stop, preview, view]);

  // A floor is a pointer shortcut. The menu carries the names and the keyboard.
  const renderFloor = ({ id, box: [x, y, width, height] }: OfficeStop) => <button
    key={id}
    type="button"
    className={styles.room}
    data-stop={id}
    tabIndex={-1}
    aria-hidden="true"
    style={{ left: percent(x, officeView.width), top: percent(y, officeView.height), width: percent(width, officeView.width), height: percent(height, officeView.height) }}
    onClick={() => setSelected(id)}
  />;

  const renderName = (item: OfficeStop) => <button
    key={item.id}
    type="button"
    className={styles.name}
    data-stop={item.id}
    aria-label={item.label}
    aria-pressed={selected === item.id}
    aria-controls={panelId}
    onClick={() => setSelected(item.id)}
  >
    <svg className={styles.cursor} viewBox="0 0 5 7" aria-hidden="true" shapeRendering="crispEdges"><path d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0Z" /></svg>
    {item.id === "slug" ? "Slug Fund" : item.label}
  </button>;

  const viewSwitch = <button type="button" className={`${styles.viewSwitch} ${pixel.className}`} onClick={() => setView(view === "office" ? "list" : "office")}>
    {view === "office" ? "View as list" : "Back to office"}
  </button>;

  return <div className={styles.explorer} data-office-explorer data-view={view} data-selected={selected}>
    <div className={styles.intro}>{header}</div>
    <h2 className={styles.visuallyHidden}>The Office</h2>
    {view === "office"
      ? <div className={`${styles.menu} ${pixel.className}`} ref={names} role="group" aria-label="Rooms in the office" onKeyDown={moveCursor}>
        <div className={styles.menuBody}>
          <div className={styles.nameGroup} role="group" aria-label="886 Studios">{officeStops.slice(0, 4).map(renderName)}</div>
          <div className={styles.nameGroup}>{officeStops.slice(4).map(renderName)}</div>
        </div>
      </div>
      : viewSwitch}
    <div className={styles.mapColumn} ref={map} hidden={view !== "office"}>
      <div className={styles.plan}>
        <OfficePlan workerRef={worker} lit={lit} active={selected} />
        {officeStops.map(renderFloor)}
      </div>
    </div>
    <div className={styles.detail} id={panelId} role="region" aria-label={stop.label} aria-live={preview ? "off" : "polite"} aria-atomic="true" hidden={view !== "office"}>
      <div key={selected} className={styles.detailEnter}>{panels[selected]}</div>
      <div className={styles.detailEnd}>
        <button type="button" className={`${styles.nextRoom} ${pixel.className}`} onClick={walkOn}>
          <span>Next: {next.id === "slug" ? "Slug Fund" : next.label}</span>
          <svg viewBox="0 0 5 7" aria-hidden="true" shapeRendering="crispEdges"><path d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0Z" /></svg>
        </button>
        {viewSwitch}
      </div>
    </div>
    <div hidden={view !== "list"} className={styles.list}>{list}</div>
  </div>;
}
