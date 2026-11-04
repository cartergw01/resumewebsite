import Image from "next/image";
import type { CSSProperties, Ref } from "react";
import art from "@/lib/office-art.json";
import { officeStops, officeView, type OfficeFacing, type OfficeStopId, type Point } from "@/lib/office-plan";
import styles from "./OfficeExplorer.module.css";

const percent = (part: number, whole: number) => `${part / whole * 100}%`;

// The sprite sheet holds one row per facing and three frames per row, with his
// feet at the 22nd pixel of each 16 by 24 cell.
const facingRows: Record<OfficeFacing, number> = { down: 0, left: 1, right: 2, up: 3 };
export const workerFacing = (facing: OfficeFacing) => `${facingRows[facing] / 3 * 100}%`;
export const workerPlace = ([x, y]: Point) => `translate(${(x - 8) / 16 * 100}%, ${(y - 22) / 24 * 100}%)`;

/** The office at night: baked art, with a pane of dark over every unlit room. */
export default function OfficePlan({ workerRef, lit, active }: { workerRef: Ref<HTMLDivElement>; lit: OfficeStopId | null; active: OfficeStopId }) {
  const stop = officeStops.find(item => item.id === active)!;
  return <div className={styles.drawing} aria-hidden="true" style={{ "--names": `url(${art.names})`, "--sheet": `url(${art.worker})` } as CSSProperties}>
    <Image className={styles.scene} src={art.scene} alt="" width={officeView.width} height={officeView.height} loading="eager" unoptimized />
    <span className={styles.hallDark} />
    {officeStops.map(({ id, box: [x, y, width, height] }) => <div key={id} className={styles.station} data-station={id} data-active={lit === id}>
      <span className={styles.floorName} style={{ clipPath: `inset(${percent(y, officeView.height)} ${percent(officeView.width - x - width, officeView.width)} ${percent(officeView.height - y - height, officeView.height)} ${percent(x, officeView.width)})` }} />
      <span className={styles.roomDark} style={{ left: percent(x, officeView.width), top: percent(y, officeView.height), width: percent(width, officeView.width), height: percent(height, officeView.height) }} />
    </div>)}
    <div className={styles.worker} ref={workerRef} data-walking="false" style={{ transform: workerPlace(stop.point), backgroundPositionY: workerFacing(stop.facing) }} />
  </div>;
}
