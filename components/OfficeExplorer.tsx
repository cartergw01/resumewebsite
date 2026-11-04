"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { officeHitArea, officeProject, officeRoute, officeStops, officeView, type OfficeStop, type OfficeStopId, type Point } from "@/lib/office-plan";
import OfficePlan from "./OfficePlan";
import styles from "./OfficeExplorer.module.css";

type Props = {
  header: ReactNode;
  panels: Record<OfficeStopId, ReactNode>;
  list: ReactNode;
  preview?: boolean;
};

const percent = (part: number, whole: number) => `${part / whole * 100}%`;

// The figure stands facing the way it walks; a seat decides how it ends up.
const faceToward = (away: boolean, left = false) => ({ transform: `scaleX(${left ? -1 : 1})`, front: away ? "0" : "1", back: away ? "1" : "0" });

export default function OfficeExplorer({ header, panels, list, preview = false }: Props) {
  const [selected, setSelected] = useState<OfficeStopId>("now");
  const [lit, setLit] = useState<OfficeStopId | null>("now");
  const [view, setView] = useState<"office" | "list">("office");
  const worker = useRef<SVGGElement>(null);
  const glow = useRef<SVGGElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const previous = useRef<OfficeStopId>(selected);
  const panelId = useId();
  const index = officeStops.findIndex(item => item.id === selected);
  const stop = officeStops[index];
  const next = officeStops[(index + 1) % officeStops.length];
  const before = officeStops[(index - 1 + officeStops.length) % officeStops.length];

  function selectRelated(id: OfficeStopId) {
    setSelected(id);
    requestAnimationFrame(() => detail.current?.focus({ preventScroll: true }));
  }

  // Arrow keys walk the tour from anywhere on the plan.
  function walkWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const target = officeStops[(index + step + officeStops.length) % officeStops.length];
    setSelected(target.id);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-stop="${target.id}"]`)?.focus();
  }

  useEffect(() => {
    const marker = worker.current;
    const carried = glow.current;
    const from: OfficeStop = officeStops.find(item => item.id === previous.current)!;
    previous.current = selected;
    if (!marker || !carried) return;
    const facing = marker.querySelector<SVGGElement>("[data-worker-facing]");
    const hairFront = marker.querySelector<SVGElement>('[data-worker-hair="front"]');
    const hairBack = marker.querySelector<SVGElement>('[data-worker-hair="back"]');
    const place = (point: Point) => { const [x, y] = officeProject(point); return `translate(${x}px, ${y}px)`; };
    const settled = faceToward(stop.away);
    marker.style.transform = carried.style.transform = place(stop.point);
    if (facing) facing.style.transform = settled.transform;
    if (hairFront) hairFront.style.opacity = settled.front;
    if (hairBack) hairBack.style.opacity = settled.back;
    marker.dataset.walking = "false";
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    if (preview || from.id === selected || preference.matches) {
      const instant = requestAnimationFrame(() => setLit(selected));
      return () => cancelAnimationFrame(instant);
    }
    // The room behind goes dark as the figure leaves. The next one lights as it arrives.
    const leaving = requestAnimationFrame(() => setLit(null));
    const route = officeRoute(from, stop);
    const lengths = route.map((point, at) => at ? Math.hypot(point[0] - route[at - 1][0], point[1] - route[at - 1][1]) : 0);
    const distance = lengths.reduce((sum, length) => sum + length, 0);
    let travelled = 0;
    const frames = route.map((point, at) => {
      travelled += lengths[at];
      return { transform: place(point), offset: travelled / distance };
    });
    const timing = { duration: Math.min(1600, Math.max(520, distance * 2.1)), easing: "linear" };
    marker.dataset.walking = "true";
    const faces = route.map((point, at) => {
      const ahead = route[at + 1];
      if (!ahead) return { ...settled, offset: 1 };
      const dx = ahead[0] - point[0], dy = ahead[1] - point[1];
      return { ...faceToward(dx + dy < 0, dx - dy < 0), offset: frames[at].offset };
    });
    const animations = [
      marker.animate(frames, timing),
      carried.animate(frames, timing),
      ...(facing ? [facing.animate(faces.map(face => ({ transform: face.transform, offset: face.offset, easing: "steps(1, end)" })), timing)] : []),
      ...(hairFront ? [hairFront.animate(faces.map(face => ({ opacity: face.front, offset: face.offset, easing: "steps(1, end)" })), timing)] : []),
      ...(hairBack ? [hairBack.animate(faces.map(face => ({ opacity: face.back, offset: face.offset, easing: "steps(1, end)" })), timing)] : []),
    ];
    const arrive = window.setTimeout(() => setLit(selected), Math.max(0, timing.duration - 180));
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

  const renderRoom = (item: OfficeStop) => {
    const area = officeHitArea(item);
    const [tagX, tagY] = officeProject(item.tag);
    return <button
      key={item.id}
      type="button"
      className={styles.room}
      data-stop={item.id}
      style={{
        left: percent(area.left, officeView.width), top: percent(area.top, officeView.height),
        width: percent(area.width, officeView.width), height: percent(area.height, officeView.height),
        "--floor": `polygon(${area.polygon})`,
      } as React.CSSProperties}
      aria-label={item.label}
      aria-pressed={selected === item.id}
      aria-controls={panelId}
      onClick={() => setSelected(item.id)}
    >
      <span className={styles.roomLabel} style={{ left: percent(tagX - area.left, area.width), top: percent(tagY - area.top, area.height) }}>
        {item.id === "slug" ? <>Slug Fund<span className={styles.labelRest}><br />Investment Group</span></> : item.label}
      </span>
    </button>;
  };

  return <div className={styles.explorer} data-office-explorer data-view={view} data-selected={selected}>
    <div className={styles.intro}>{header}</div>
    <div className={styles.tour}>
      <h2 className={styles.visuallyHidden}>The Office</h2>
      {view === "office" && <div className={styles.tourControls}>
        <button type="button" className={styles.step} onClick={() => setSelected(before.id)} aria-label={`Previous: ${before.label}`}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4m5-5-5 5 5 5" /></svg>
        </button>
        <button type="button" className={styles.nextStop} onClick={() => setSelected(next.id)}>
          <span>Next: {next.label}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
        </button>
      </div>}
      <button type="button" className={styles.viewSwitch} onClick={() => setView(view === "office" ? "list" : "office")}>
        {view === "office" ? "View as list" : "Back to office"}
      </button>
    </div>
    {view === "office" && <ol className={styles.track} aria-hidden="true">
      {officeStops.map(item => <li key={item.id} data-on={item.id === selected} />)}
    </ol>}
    <div className={styles.mapColumn} hidden={view !== "office"}>
      <div className={styles.plan} role="group" aria-label="Explore the office" onKeyDown={walkWithKeys}>
        <OfficePlan workerRef={worker} glowRef={glow} lit={lit} active={selected} />
        <div role="group" aria-label="886 Studios">
          {officeStops.slice(0, 4).map(renderRoom)}
        </div>
        {officeStops.slice(4).map(renderRoom)}
      </div>
    </div>
    <div className={styles.detail} ref={detail} tabIndex={-1} id={panelId} role="region" aria-label={stop.label} aria-live={preview ? "off" : "polite"} aria-atomic="true" hidden={view !== "office"}>
      <div key={selected} className={styles.detailEnter}>
        {panels[selected]}
        {selected === "now" && <div className={styles.workLinks}>
          {officeStops.slice(1, 4).map(item => <button type="button" key={item.id} onClick={() => selectRelated(item.id)}>
            <span>{item.label}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
          </button>)}
        </div>}
      </div>
    </div>
    <div hidden={view !== "list"} className={styles.list}>{list}</div>
  </div>;
}
