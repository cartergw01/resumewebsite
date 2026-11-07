"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import { officeDetails, officeStops, officeView, type OfficeStopId } from "@/lib/office-plan";
import styles from "./OfficeLife.module.css";

function Steam({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <path className={styles.steam} d="M0 0v-2h1v-2H0v-2" />
    <path className={styles.steam} style={{ animationDelay: "-1.6s" }} d="M3 1v-2h1v-2H3v-2" />
  </g>;
}

// One lived-in detail per occupied room. Everything is drawn in the map's own
// pixels, and loops are limited to the small screen or cup they belong to.
function RoomLife({ room }: { room: OfficeStopId }) {
  switch (room) {
    case "now": return <g className={styles.arrival}>
      <path className={styles.lamplight} d="M43 50h14l5 9H38Z" />
      <Steam x={65} y={53} />
    </g>;
    case "accelerator": return <g>
      <rect x="145" y="10" width="29" height="18" fill="#f7f5ec" />
      {[4, 7, 10, 15].map((height, i) => <rect key={i} className={styles.presentationBar} style={{ animationDelay: `${i * 65}ms` }} x={146 + i * 7} y={28 - height} width="5" height={height} fill={i === 3 ? "#e7c693" : "#8a8f98"} />)}
    </g>;
    case "founders": return <g className={styles.arrival}><Steam x={224} y={65} /><Steam x={251} y={64} /></g>;
    case "community": return <g className={styles.arrival}>
      {[297, 313].map(x => <path key={x} className={styles.lamplight} d={`M${x - 1} 34h2l9 15h-20Z`} />)}
    </g>;
    case "research": return <g className={styles.arrival}>
      <path className={styles.lamplight} d="M14 204h4l8 12H8Z" />
      <Steam x={39} y={212} />
    </g>;
    case "slug": return <g className={styles.arrival}>
      {[126, 134, 142, 186, 194, 202].map((x, i) => <rect key={x} className={styles.marketTick} style={{ animationDelay: `${i * 55}ms` }} x={x} y="178" width="3" height="1" fill={i % 3 ? "#75cda1" : "#d78e87"} />)}
    </g>;
    case "side": return <g className={styles.arrival}><path className={styles.lamplight} d="M227 227h5l7 11h-18Z" /></g>;
    case "about": return <g className={styles.arrival}><Steam x={357} y={232} /></g>;
  }
}

export default function OfficeLife({ room, attention }: { room: OfficeStopId | null; attention: string | null }) {
  const ref = useRef<SVGSVGElement>(null);
  const bounds = useRef<SVGRectElement>(null);
  const clip = useId();
  const detail = officeDetails.find(item => item.id === attention && item.room === room);
  const occupied = officeStops.find(item => item.id === room);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.dataset.running = "false";
    const target = bounds.current;
    if (!target) return;
    let visible = false;
    const sync = () => { node.dataset.running = String(visible && !document.hidden); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(target);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [room]);

  return <svg ref={ref} className={styles.life} viewBox={`0 0 ${officeView.width} ${officeView.height}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false" data-office-life data-room={room ?? ""} data-attention={detail?.id ?? ""} data-running="false">
    {occupied && <rect ref={bounds} x={occupied.box[0]} y={occupied.box[1]} width={occupied.box[2]} height={occupied.box[3]} fill="none" />}
    {room && <RoomLife key={room} room={room} />}
    {detail && <g key={detail.id} className={styles.attention} data-kind={detail.kind}>
      <defs><clipPath id={clip}><rect x={detail.box[0]} y={detail.box[1]} width={detail.box[2]} height={detail.box[3]} /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        {detail.kind === "screen" ? <>
          <rect className={styles.screenLight} x={detail.box[0]} y={detail.box[1]} width={detail.box[2]} height={detail.box[3]} />
          <g transform={`translate(${detail.box[0]} ${detail.box[1]})`}>
            <rect className={styles.screenWake} style={{ "--travel": `${detail.box[3]}px` } as CSSProperties} width={detail.box[2]} height="1" />
            {detail.id === "code" || detail.id === "scan" ? <rect className={styles.cursor} x="2" y={detail.box[3] - 2} width="1" height="1" /> : null}
            {detail.id === "book" || detail.id === "tape" ? <g className={styles.marketUpdate}><rect x="2" y="3" width="4" height="1" fill="#75cda1" /><rect x="15" y="7" width="3" height="1" fill="#d78e87" /></g> : null}
            {detail.id === "tv" && <rect className={styles.ball} x="3" y="5" width="1" height="1" fill="#f0d2a0" />}
          </g>
        </> : <>
          <rect className={styles.wallLight} x={detail.box[0]} y={detail.box[1]} width={detail.box[2]} height={detail.box[3]} />
          <path className={styles.frameEdge} d={`M${detail.box[0]} ${detail.box[1] + detail.box[3]}V${detail.box[1]}h${detail.box[2]}`} />
          {detail.kind === "window" && <g transform={`translate(${detail.box[0]} ${detail.box[1]})`}><path className={styles.windowReflection} d={`M2 1l4 ${detail.box[3] - 2}M5 1l4 ${detail.box[3] - 2}`} /></g>}
        </>}
      </g>
    </g>}
  </svg>;
}
