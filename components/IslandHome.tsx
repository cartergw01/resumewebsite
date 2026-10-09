import type { ReactNode } from "react";
import Link from "next/link";
import SiteNav from "./SiteNav";
import IslandScrollTransport from "./IslandScrollTransport";
import IslandOverview from "./IslandOverview";
import LivingIsland from "./LivingIsland";
import WritingIsland from "./WritingIsland";
import IslandLine from "./IslandLine";
import { WorkWindowPreview } from "./WorkRoom";
import { essays, projects } from "@/content/portfolio";
import { siteConfig } from "@/lib/seo";
import { islandArtwork, islandLandmarks } from "@/lib/island-artwork";
import styles from "./IslandHome.module.css";

const stops = [
  { id: "intro" },
  { id: "work", title: "Work" },
  { id: "writing", title: "Writing" },
  { id: "projects", title: "Projects" },
  { id: "hello" },
] as const;

function Out({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function Copy({ id }: { id: (typeof stops)[number]["id"] }) {
  switch (id) {
    case "intro":
      return <>
        <h1 id="hero-title">Carter Wang</h1>
        <p className={styles.description}>
          backing early-stage startups alongside the founders of Twitch and Guitar Hero at <Out href="https://886studios.com">886 Studios</Out>.
        </p>
        {/* Plain text links go straight to their page; the islands carry the flight. */}
        <p className={styles.description}>
          <Link href="/writing">writing</Link> and <Link href="/projects">building</Link> things for fun on the side.
        </p>
        {/* One click from landing to something Carter wrote. */}
        <p className={styles.latest}>
          <span>latest essay</span> <Out href={essays[0].href}>{essays[0].title}</Out>
        </p>
      </>;
    case "work":
      return <>
        <h2 id="work-heading"><a href="/work" data-enter-island>Work</a></h2>
        <p className={styles.description}><IslandLine id="work" /></p>
      </>;
    case "writing":
      return <>
        <h2 id="writing-heading"><a href="/writing" data-enter-island>Writing</a></h2>
        <p className={styles.description}><IslandLine id="writing" /></p>
      </>;
    case "projects":
      return <>
        <h2 id="projects-heading"><a href="/projects" data-enter-island>Projects</a></h2>
        <p className={styles.description}><IslandLine id="projects" /></p>
      </>;
    case "hello":
      return <>
        <h2 id="hello-heading">say hi!</h2>
        <ul className={`${styles.facts} ${styles.contact}`} aria-label="Contact">
          <li><a href={`mailto:${siteConfig.email}`}>Email</a></li>
          <li><Out href={siteConfig.social.x}>X</Out></li>
          <li><Out href={siteConfig.social.linkedin}>LinkedIn</Out></li>
          <li><Out href={siteConfig.social.substack}>Substack</Out></li>
        </ul>
      </>;
  }
}

function Art({ id }: { id: (typeof stops)[number]["id"] }) {
  switch (id) {
    case "intro": return <IslandOverview variant="intro" />;
    case "hello": return <IslandOverview variant="outro" />;
    // One server-side manifest supplies overview images, live media and anchors.
    // New renders remount the client media so a stale still cannot persist.
    case "writing": return <WritingIsland key={islandArtwork.writing.src} artwork={islandArtwork.writing} landmark={islandLandmarks.Writing} essay={{ title: essays[0].title, subtitle: essays[0].subtitle, date: essays[0].date, href: essays[0].href }} titles={essays.map((essay) => essay.title)} />;
    default: return <LivingIsland key={islandArtwork[id].src} artwork={islandArtwork} landmark={islandLandmarks[id === "work" ? "Work" : "Projects"]} world={id} preview={id === "projects" ? projects[0]?.image : undefined} posters={id === "projects" ? projects.map((project) => project.image) : undefined} />;
  }
}

export default function IslandHome() {
  return (
    <div className={styles.home}>
      <WorkWindowPreview />
      {/* Without JavaScript only the opening view exists: no empty scroll track,
          no camera controls that can't move. The island links still work. */}
      <noscript dangerouslySetInnerHTML={{ __html: "<style>#islands{height:100svh!important}[data-next-scene],[data-scene-nav]{display:none!important}</style>" }} />
      <a className={styles.skipLink} href="#islands">Skip to content</a>
      <SiteNav hidePrimary />
      <IslandScrollTransport worlds={stops.map((stop) => ({ id: stop.id, title: "title" in stop ? stop.title : undefined }))}>
        {stops.map((stop, index) => (
          <section
            key={stop.id}
            id={stop.id}
            className={`${styles.scene} ${styles[stop.id]}`}
            data-island-scene
            data-active={index === 0}
            aria-labelledby={index === 0 ? "hero-title" : `${stop.id}-heading`}
            aria-hidden={index !== 0}
            inert={index !== 0}
          >
            <div className={styles.copy} data-scene-copy><Copy id={stop.id} /></div>
            <div className={styles.art} data-scene-art><span className={styles.artGlow} data-reads={`island-lights:opacity:${stop.id === "work" ? .8 : 1}`} aria-hidden="true" /><Art id={stop.id} /></div>
          </section>
        ))}
      </IslandScrollTransport>
    </div>
  );
}
