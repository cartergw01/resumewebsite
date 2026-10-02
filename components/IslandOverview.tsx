import Image from "next/image";
import Link from "next/link";
import { overviewOrder, tipSide } from "@/lib/island-overview";
import { islandArtwork as islands } from "@/lib/island-artwork";
import styles from "./IslandHome.module.css";

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
