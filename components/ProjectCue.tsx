import { useId, type CSSProperties } from "react";
import styles from "./WorkshopObjects.module.css";

// Small details traced onto the existing render, in its 1200 × 800 space.
// Their parent shares the physical object's depth and pointer target.
export default function ProjectCue({ id, bounds, style }: { id: string; bounds: number[]; style: CSSProperties }) {
  const clip = useId().replaceAll(":", "");
  const screen = id === "taipei-run" ? "M169 302 229 310 231 354 171 346Z" : "M489 302 538 305 538 331 489 328Z";
  return <svg aria-hidden="true" className={styles.cue} data-project-cue={id} viewBox={bounds.join(" ")} style={style}>
    <defs><clipPath id={clip}><path d={screen} /></clipPath></defs>
    {id === "taipei-run" && <>
      <g clipPath={`url(#${clip})`}>
        <path className={styles.screenWash} d={screen} fill="#b7e8ef" />
        <g className={styles.road} stroke="#fff5cc" strokeWidth="1.6">
          <path d="m197 321-3 8m-2 6-3 10m16-22 2 9m1 7 3 10" />
        </g>
        <path className={styles.screenSweep} d="M158 312 239 322 239 330 158 320Z" fill="#d7fbff" />
      </g>
      <path className={styles.edge} d="m159 287 72 10-2 66" stroke="#92dfdf" />
    </>}
    {id === "poker-odds" && <g className={styles.cardCorner}>
      <path d="m433 376 14 1-4 9-13-1Z" fill="#efe8d5" stroke="#fff1cd" strokeWidth=".65" />
      <path d="m436 378 5 1-1 3-5-.5Z" fill="#243041" />
      <path d="m430 385 13 1" stroke="#8a7051" strokeWidth="1" />
    </g>}
    {id === "stocker" && <g clipPath={`url(#${clip})`}>
      <path className={styles.screenWash} d={screen} fill="#c3e5e7" />
      <path className={styles.stockTrace} d="m492 323 8-4 6 2 8-8 6 3 12-6" fill="none" stroke="#b0ddc9" strokeWidth="1.3" pathLength="1" />
    </g>}
    {id === "taipei-guide" && <>
      <path className={styles.mapRoute} d="m676 367 4-9 14 1 5-8" fill="none" stroke="#e8b882" strokeWidth="1.5" pathLength="1" />
      <g className={styles.mapPin}><path d="m703 352 1-6" stroke="#d56a57" strokeWidth="1.4" /><circle cx="704" cy="346" r="2.5" fill="#ed8872" /></g>
    </>}
    {id === "night-night-ko" && <path className={styles.moon} d="M327 311c-13 1-13 19 0 20-9-5-9-15 0-20Z" fill="#f3d392" />}
  </svg>;
}
