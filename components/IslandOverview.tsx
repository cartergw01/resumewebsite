import Image from "next/image";
import Link from "next/link";
import { overviewOrder, tipSide } from "@/lib/island-overview";
import styles from "./IslandHome.module.css";

const islands = {
  work: { title: "Work", prompt: "learn about my work", src: "/world-work-cutout-v3.webp", width: 1672, height: 941 },
  writing: { title: "Writing", prompt: "read my writing", src: "/world-writing-cutout-v3.webp", width: 1689, height: 931 },
  projects: { title: "Projects", prompt: "see what I’ve built", src: "/world-projects-workshop-v5.webp", width: 1200, height: 800 },
};

// All three islands at a distance. Each one opens its page directly.
export default function IslandOverview({ variant }: { variant: "intro" | "outro" }) {
  return (
    <nav className={`${styles.overview} ${styles[variant]}`} aria-label="Islands" data-overview={variant}>
      {overviewOrder.map((id) => {
        const island = islands[id];
        return (
          <Link
            key={id}
            href={`/${id}`}
            className={styles.overviewIsland}
            data-overview-island={id}
            data-tip={island.prompt}
            data-tip-side={tipSide[id]}
            aria-label={`${island.prompt}. Enter ${island.title} island`}
          >
            <Image
              src={island.src} alt="" width={island.width} height={island.height}
              sizes="(max-width: 760px) 60vw, 34vw" quality={90}
              priority={variant === "intro"} draggable={false} className={styles.overviewImage}
            />
            <span className={styles.overviewLabel}>{island.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
