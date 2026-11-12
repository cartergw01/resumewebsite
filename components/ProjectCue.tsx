import type { CSSProperties } from "react";
import objects from "@/lib/workshop-objects.json";
import styles from "./WorkshopObjects.module.css";

const pokerTray = objects["poker-odds"].tray.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ") + "Z";

// Small details traced onto the existing render, in its 1200 × 800 space.
// Their parent shares the physical object's depth and pointer target. Only the
// chip case glints; the arcade and the stock chart show just their artwork.
export default function ProjectCue({ id, bounds, style }: { id: string; bounds: number[]; style: CSSProperties }) {
  return <svg aria-hidden="true" className={styles.cue} data-project-cue={id} viewBox={bounds.join(" ")} style={style}>
    {id === "poker-odds" && <path className={styles.chipTray} data-poker-tray d={pokerTray} fill="none" stroke="#ffe1a3" strokeWidth="1.2" strokeLinejoin="round" pathLength="1" />}
  </svg>;
}
