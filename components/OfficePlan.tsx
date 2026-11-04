import Image from "next/image";
import type { CSSProperties, ReactNode, Ref } from "react";
import art from "@/lib/office-art.json";
import { officeScreens, officeStart, officeStops, officeView, type OfficeFacing, type OfficeStopId, type Point } from "@/lib/office-plan";
import styles from "./OfficeExplorer.module.css";

const percent = (part: number, whole: number) => `${part / whole * 100}%`;

// The sprite sheet holds one row per facing and three frames per row, with his
// feet at the 22nd pixel of each 16 by 24 cell.
const facingRows: Record<OfficeFacing, number> = { down: 0, left: 1, right: 2, up: 3 };
export const workerFacing = (facing: OfficeFacing) => `${facingRows[facing] / 3 * 100}%`;
export const workerPlace = ([x, y]: Point) => `translate(${(x - 8) / 16 * 100}%, ${(y - 22) / 24 * 100}%)`;

/** The office at night: baked art, a pane of dark over every unlit room, and screens that change as he nears them. */
export default function OfficePlan({ workerRef, lit, screen, preview, sign, children }: { workerRef: Ref<HTMLDivElement>; lit: OfficeStopId | null; screen: string | null; preview?: boolean; sign?: ReactNode; children?: ReactNode }) {
  return <div className={styles.drawing} style={{ "--sheet": `url(${art.worker})`, "--screens": `url(${art.screens})` } as CSSProperties}>
    <Image className={styles.scene} src={art.scene} alt="" width={officeView.width} height={officeView.height} loading="eager" fetchPriority={preview ? "low" : "high"} unoptimized />
    {officeScreens.map(({ id, box: [x, y, width, height] }) => <span
      key={id}
      className={styles.screen}
      data-on={screen === id}
      style={{ clipPath: `inset(${percent(y, officeView.height)} ${percent(officeView.width - x - width, officeView.width)} ${percent(officeView.height - y - height, officeView.height)} ${percent(x, officeView.width)})` }}
    />)}
    <span className={styles.hallDark} />
    {officeStops.map(({ id, box: [x, y, width, height] }) => <div key={id} className={styles.station} data-station={id} data-active={lit === id}>
      <span className={styles.roomDark} style={{ left: percent(x, officeView.width), top: percent(y, officeView.height), width: percent(width, officeView.width), height: percent(height, officeView.height) }} />
    </div>)}
    <div className={styles.worker} ref={workerRef} data-walking="false" style={{ transform: workerPlace(officeStart), backgroundPositionY: workerFacing("up") }}>{sign}</div>
    {children}
  </div>;
}
