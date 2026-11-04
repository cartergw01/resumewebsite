"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { officeRoute, officeSize, officeStops, type OfficeStopId } from "@/lib/office-plan";
import OfficePlan from "./OfficePlan";
import styles from "./OfficeExplorer.module.css";

type Props = {
  panels: Record<OfficeStopId, ReactNode>;
  list: ReactNode;
  preview?: boolean;
};

export default function OfficeExplorer({ panels, list, preview = false }: Props) {
  const [selected, setSelected] = useState<OfficeStopId>("now");
  const [view, setView] = useState<"office" | "list">("office");
  const [sheetOpen, setSheetOpen] = useState(false);
  const worker = useRef<SVGGElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const sheetContent = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const previous = useRef(selected);
  const panelId = useId();
  const sheetId = useId();
  const companyId = useId();
  const stop = officeStops.find(item => item.id === selected)!;

  function select(id: OfficeStopId, button: HTMLButtonElement) {
    setSelected(id);
    selectedButton.current = button;
    if (matchMedia("(max-width: 700px)").matches) {
      setSheetOpen(true);
    }
  }

  function selectRelated(id: OfficeStopId) {
    setSelected(id);
    requestAnimationFrame(() => {
      const content = sheetOpen ? sheetContent.current : detail.current;
      if (content) {
        content.scrollTop = 0;
        content.focus({ preventScroll: true });
      }
    });
  }

  useEffect(() => {
    const dialog = sheet.current;
    if (!sheetOpen || !dialog) return;
    const officeMap = map.current;
    const position = { left: window.scrollX, top: window.scrollY };
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    const rootGutter = document.documentElement.style.scrollbarGutter;
    // Keep the plan's width when a classic scrollbar disappears behind the sheet.
    if (window.innerWidth > document.documentElement.clientWidth) document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    const mobile = matchMedia("(max-width: 700px)");
    const closeOnDesktop = () => { if (!mobile.matches) setSheetOpen(false); };
    mobile.addEventListener("change", closeOnDesktop);
    return () => {
      dialog.close();
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      document.documentElement.style.scrollbarGutter = rootGutter;
      window.scrollTo({ ...position, behavior: "instant" });
      const target = officeMap?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? selectedButton.current;
      target?.focus({ preventScroll: true });
      mobile.removeEventListener("change", closeOnDesktop);
    };
  }, [sheetOpen]);

  useEffect(() => {
    const marker = worker.current;
    const from = officeStops.find(item => item.id === previous.current)!;
    previous.current = selected;
    if (!marker) return;
    const transform = (point: readonly [number, number]) => `translate(${point[0]}px, ${point[1]}px)`;
    marker.style.transform = transform(stop.point);
    marker.dataset.walking = "false";
    if (preview || from.id === selected || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const route = officeRoute(from, stop);
    const lengths = route.map((point, index) => index ? Math.hypot(point[0] - route[index - 1][0], point[1] - route[index - 1][1]) : 0);
    const distance = lengths.reduce((sum, length) => sum + length, 0);
    let travelled = 0;
    const frames = route.map((point, index) => {
      travelled += lengths[index];
      return { transform: transform(point), offset: travelled / distance };
    });
    const timing = { duration: Math.min(1400, Math.max(400, distance * 2.3)), easing: "linear" };
    marker.dataset.walking = "true";
    const animation = marker.animate(frames, timing);
    const facing = marker.querySelector<SVGGElement>("[data-worker-facing]");
    const turn = facing?.animate(route.map((point, index) => {
      const next = route[index + 1];
      const angle = next ? Math.atan2(next[0] - point[0], point[1] - next[1]) * 180 / Math.PI : stop.facing;
      return { transform: `rotate(${angle}deg)`, offset: frames[index].offset, easing: "steps(1, end)" };
    }), timing);
    animation.onfinish = () => { marker.dataset.walking = "false"; };
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => { if (preference.matches) { animation.finish(); turn?.finish(); marker.dataset.walking = "false"; } };
    preference.addEventListener("change", finish);
    return () => { animation.cancel(); turn?.cancel(); marker.dataset.walking = "false"; preference.removeEventListener("change", finish); };
  }, [selected, stop, preview, view]);

  const content = <>
    {panels[selected]}
    {selected === "now" && <div className={styles.workLinks}>
      {officeStops.slice(1, 4).map(item => <button type="button" key={item.id} onClick={() => selectRelated(item.id)}>
        <span>{item.label}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
      </button>)}
    </div>}
  </>;

  const renderRoom = (item: (typeof officeStops)[number]) => <button
    key={item.id}
    type="button"
    className={styles.room}
    data-stop={item.id}
    style={{ left: `${item.box[0] / officeSize.width * 100}%`, top: `${item.box[1] / officeSize.height * 100}%`, width: `${item.box[2] / officeSize.width * 100}%`, height: `${item.box[3] / officeSize.height * 100}%` }}
    aria-label={item.label}
    aria-pressed={selected === item.id}
    aria-controls={preview ? panelId : `${panelId} ${sheetId}`}
    onClick={event => select(item.id, event.currentTarget)}
  >
    <span className={styles.roomLabel}><strong>{item.id === "slug" ? <>Slug Fund<br />Investment Group</> : item.label}</strong></span>
  </button>;

  return <div className={styles.explorer} data-office-explorer data-view={view} data-selected={selected}>
    <div className={styles.toolbar}>
      <h2>The Office</h2>
      <button type="button" className={styles.viewSwitch} onClick={() => setView(view === "office" ? "list" : "office")}>
        {view === "office" ? "View as list" : "Back to office"}
      </button>
    </div>
    <div className={styles.office} hidden={view !== "office"}>
      <div className={styles.mapColumn} ref={map}>
        <div className={styles.plan} role="group" aria-label="Explore the office">
          <OfficePlan workerRef={worker} active={selected} />
          <div role="group" aria-labelledby={companyId}>
            <h3 className={styles.groupTitle} id={companyId}>886 Studios</h3>
            {officeStops.slice(0, 4).map(renderRoom)}
          </div>
          {officeStops.slice(4).map(renderRoom)}
        </div>
      </div>
      <div className={styles.detail} ref={detail} tabIndex={-1} id={panelId} role="region" aria-label={stop.label} aria-live={preview ? "off" : "polite"} aria-atomic="true">
        {content}
      </div>
    </div>
    <div hidden={view !== "list"} className={styles.list}>{list}</div>
    {!preview && <dialog ref={sheet} id={sheetId} className={styles.sheet} aria-label={stop.label}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={event => { event.preventDefault(); setSheetOpen(false); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientX > bounds.right) setSheetOpen(false);
      }}>
      <div className={styles.sheetBar}>
        <button type="button" className={styles.close} onClick={() => setSheetOpen(false)} aria-label="Close details">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
      </div>
      <div className={styles.sheetContent} ref={sheetContent} tabIndex={-1} aria-live="polite" aria-atomic="true">
        {sheetOpen && content}
      </div>
    </dialog>}
  </div>;
}
