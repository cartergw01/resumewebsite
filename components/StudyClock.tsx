"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ARTWORK_PARALLAX_EVENT, artworkProjection } from "@/lib/artwork-perspective";
import { CLOCK_HANDS, clockHandPoints, STUDY_TIME_ZONE, studyTime, type ClockHand, type StudyClockFace } from "@/lib/study-clock";
import type { ParallaxState } from "./IslandLife";

export default function StudyClock({ face, className }: { face: StudyClockFace; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const offsetRef = useRef<SVGGElement>(null);
  const [time, setTime] = useState<ReturnType<typeof studyTime> | null>(null);
  const projection = useMemo(() => artworkProjection(face.corners), [face.corners]);
  const [a, b, c, d, e, f, g, h] = projection;
  const project = (x: number, y: number) => {
    const u = (x + 1) / 2, v = (1 - y) / 2, z = g * u + h * v + 1;
    return [(a * u + b * v + c) / z, (d * u + e * v + f) / z];
  };
  const [cx, cy] = project(0, 0);

  useEffect(() => {
    const svg = svgRef.current, offset = offsetRef.current;
    const visual = svg?.closest<HTMLElement>("[data-island-visual]") as (HTMLElement & { parallax?: ParallaxState }) | null;
    const scene = svg?.closest<HTMLElement>("[data-island-scene]");
    const stage = svg?.closest<HTMLElement>("[data-island-stage]");
    if (!svg || !offset || !visual || !scene || !stage) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let timer = 0, previous = "";
    const visible = () => !document.hidden && scene.dataset.active === "true";
    const tick = () => {
      if (!visible()) return;
      // Read the wall clock each time; background tabs never accumulate drift.
      setTime(studyTime());
      timer = window.setTimeout(tick, 1005 - Date.now() % 1000);
    };
    const follow = () => {
      const p = visual.parallax;
      const tracking = !reduced.matches && fine.matches && visual.dataset.parallax === "on" && !visual.hasAttribute("data-entry-still");
      const depth = tracking && p?.depth ? p.depth(cx, cy) - p.focus : 0;
      const transform = `translate(${-(p?.x ?? 0) * depth * 1200} ${-(p?.y ?? 0) * depth * 800})`;
      if (transform !== previous) { offset.setAttribute("transform", transform); previous = transform; }
    };
    const sync = () => {
      clearTimeout(timer);
      tick(); follow();
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    const surface = new MutationObserver(follow);
    surface.observe(visual, { attributes: true, attributeFilter: ["data-parallax", "data-entry-still"] });
    visual.addEventListener(ARTWORK_PARALLAX_EVENT, follow);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync); fine.addEventListener("change", sync);
    sync();
    return () => {
      clearTimeout(timer); observer.disconnect(); surface.disconnect();
      visual.removeEventListener(ARTWORK_PARALLAX_EVENT, follow);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync); fine.removeEventListener("change", sync);
    };
  }, [cx, cy]);

  const outline = (points: number[][]) => points.map(([x, y], i) => `${i ? "L" : "M"}${project(x, y).join(" ")}`).join("") + "Z";
  const pivot = Array.from({ length: 24 }, (_, i) => [Math.cos(i * Math.PI / 12) * .038, Math.sin(i * Math.PI / 12) * .038]);
  return <svg ref={svgRef} className={className} viewBox="0 0 1200 800" aria-hidden="true"
    data-study-clock data-time-zone={STUDY_TIME_ZONE} data-clock-time={time?.label}>
    <title>{time ? `Taipei time ${time.label}` : "Taipei clock"}</title>
    <g ref={offsetRef} data-clock-offset>
      {time ? <>
        <g fill="#d8ffe5" style={{ filter: "drop-shadow(0 0 0.65px #83edb4)" }} data-clock-lume>
          {(Object.keys(CLOCK_HANDS) as ClockHand[]).map(name =>
            <path key={name} data-clock-hand={name} data-angle={time[name]}
              d={outline(clockHandPoints(name, time[name]))} />)}
        </g>
        <path d={outline(pivot)} fill="#d1e6dc" />
      </> : null}
    </g>
  </svg>;
}
