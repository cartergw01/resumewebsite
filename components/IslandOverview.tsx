import Image from "next/image";
import { overviewOrder } from "@/lib/island-overview";
import { islandArtwork as islands, islandLandmarks } from "@/lib/island-artwork";
import { artworkOutline } from "@/lib/artwork-perspective";
import { essays, projects } from "@/content/portfolio";
import orbitAssets from "@/lib/island-orbit-assets.json";
import IslandLink from "./IslandLink";
import IslandOrbit from "./IslandOrbit";
import PerspectiveArtwork from "./PerspectiveArtwork";
import styles from "./IslandHome.module.css";

// Distant islands use the same entry controller and landmark geometry as the
// individual stops. The Work camera warms only on pointer or keyboard intent.
export default function IslandOverview({ variant }: { variant: "intro" | "outro" }) {
  return (
    <nav className={`${styles.overview} ${styles[variant]}`} aria-label="Islands" data-overview={variant}>
      {overviewOrder.map((id) => {
        const island = islands[id];
        return (
          <IslandLink
            key={id}
            href={`/${id}`}
            title={island.title} prompt={island.prompt}
            landmark={islandLandmarks[island.title]}
            overview book={id === "writing"} workshop={id === "projects"}
          >
            <span className={styles.overviewVisual} data-island-visual>
              <Image
                src={island.src} alt="" width={island.width} height={island.height}
                sizes="(max-width: 760px) 60vw, 34vw" quality={90}
                priority={variant === "intro"} draggable={false} className={styles.overviewImage}
              />
              <svg className={styles.overviewDetails} viewBox="0 0 1200 800" aria-hidden="true">
                {id === "work" ? <path data-city-entry-window data-corners={JSON.stringify(islands.work.entryWindow)} d={artworkOutline(islands.work.entryWindow)} fill="#eacd96" /> : null}
                {id === "writing" ? <path data-book-spread data-corners={JSON.stringify(islands.writing.spread)} data-titles={JSON.stringify(essays.map(essay => essay.title))} d={artworkOutline(islands.writing.spread)} fill="none" /> : null}
                {id === "projects" ? <g data-workshop-screen data-corners={JSON.stringify(islands.projects.screen)} data-src={projects[0]?.image} data-posters={JSON.stringify(projects.map(project => project.image))}>
                  <PerspectiveArtwork corners={islands.projects.screen} width={320} height={200}>
                    <image href={projects[0]?.image} width="320" height="200" preserveAspectRatio="xMidYMin slice" />
                  </PerspectiveArtwork>
                </g> : null}
              </svg>
              {id === "work" ? <IslandOrbit world="work" asset={orbitAssets.work} anchors={{ landmark: [islands.work.landmark], entryWindow: islands.work.entryWindow }} interactive={false} /> : null}
            </span>
          </IslandLink>
        );
      })}
    </nav>
  );
}
