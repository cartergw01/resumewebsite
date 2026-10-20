import Image, { getImageProps } from "next/image";
import { overviewOrder } from "@/lib/island-overview";
import { islandArtwork as islands, islandLandmarks } from "@/lib/island-artwork";
import { artworkOutline } from "@/lib/artwork-perspective";
import { ownEssays, projects } from "@/content/portfolio";
import { projectPosters } from "@/lib/project-posters";
import IslandLink from "./IslandLink";
import PerspectiveArtwork from "./PerspectiveArtwork";
import StudyClock from "./StudyClock";
import type { Life } from "./IslandLife";
import styles from "./IslandHome.module.css";

// Distant islands use the same entry controller and landmark geometry as the
// individual stops. The Work camera warms only on pointer or keyboard intent.
export default function IslandOverview({ variant }: { variant: "intro" | "outro" }) {
  // A distant monitor needs only a thumbnail. The full project image stays
  // deferred until the visitor enters or travels to the workshop.
  const screenPreview = getImageProps({ src: projects[0].image, alt: "", width: 96, height: 60 }).props.src;
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
                sizes="(max-width: 760px) 60vw, 34vw" quality={75}
                priority={variant === "intro"} draggable={false} className={styles.overviewImage}
              />
              <svg className={styles.overviewDetails} viewBox="0 0 1200 800" aria-hidden="true">
                {id === "work" ? <path data-city-entry-window data-corners={JSON.stringify(islands.work.entryWindow)} d={artworkOutline(islands.work.entryWindow)} fill="#eacd96" /> : null}
                {id === "writing" ? <path data-book-spread data-corners={JSON.stringify(islands.writing.spread)} data-essays={JSON.stringify(ownEssays.map(({ title, date, subtitle }) => ({ title, date, subtitle })))} d={artworkOutline(islands.writing.spread)} fill="none" /> : null}
                {id === "projects" ? <g data-workshop-screen data-corners={JSON.stringify(islands.projects.screen)} data-src={projects[0]?.image} data-posters={JSON.stringify(projectPosters)}>
                  <PerspectiveArtwork corners={islands.projects.screen} width={320} height={200}>
                    <image href={screenPreview} width="320" height="200" preserveAspectRatio="xMidYMin slice" />
                  </PerspectiveArtwork>
                </g> : null}
              </svg>
              {id === "writing" && (islands.writing.life as Life)?.clock ?
                <StudyClock face={(islands.writing.life as Life).clock!} className={styles.overviewDetails} /> : null}
            </span>
          </IslandLink>
        );
      })}
    </nav>
  );
}
