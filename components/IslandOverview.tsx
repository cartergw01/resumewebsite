import Image from "next/image";
import { introPlacements, outroPlacements } from "@/lib/island-overview";
import styles from "./IslandHome.module.css";

const islands = {
  work: { title: "Work", src: "/world-work-cutout-v3.webp", width: 1672, height: 941 },
  writing: { title: "Writing", src: "/world-writing-cutout-v3.webp", width: 1689, height: 931 },
  projects: { title: "Projects", src: "/world-projects-workshop-v5.webp", width: 1200, height: 800 },
};

// All three islands at a distance. Each one flies the camera to its stop.
export default function IslandOverview({ variant }: { variant: "intro" | "outro" }) {
  const placements = variant === "intro" ? introPlacements : outroPlacements;
  return (
    <nav className={`${styles.overview} ${styles[variant]}`} aria-label="Islands" data-overview={variant}>
      {placements.map(({ id, x, y, size }) => {
        const island = islands[id];
        return (
          <a
            key={id}
            href={`#${id}`}
            data-jump={id}
            className={styles.overviewIsland}
            data-overview-island={id}
            style={{ left: `${x - size / 2}%`, top: `${y - size / 2}%`, width: `${size}%`, height: `${size}%` }}
          >
            <Image
              src={island.src} alt="" width={island.width} height={island.height}
              sizes={`(max-width: 760px) ${Math.round(size * 1.2)}vw, ${Math.round(size * 0.7)}vw`}
              priority={variant === "intro"} draggable={false} className={styles.overviewImage}
            />
            <span className={styles.overviewLabel}>{island.title}</span>
          </a>
        );
      })}
    </nav>
  );
}
