import type { ReactNode } from "react";
import Link from "next/link";
import SiteNav from "./SiteNav";
import IslandScrollTransport from "./IslandScrollTransport";
import IslandOverview from "./IslandOverview";
import LivingIsland from "./LivingIsland";
import WritingIsland from "./WritingIsland";
import { essays, projects, workPageEssays, workRoles } from "@/content/portfolio";
import { siteConfig } from "@/lib/seo";
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

const dash = (period: string) => period.replace(" - ", " – ");

function Copy({ id }: { id: (typeof stops)[number]["id"] }) {
  switch (id) {
    case "intro":
      return <>
        <h1 id="hero-title">Carter Wang</h1>
        <p className={styles.description}>
          backing early stage startups alongside the founders of Twitch and Guitar Hero at <Out href="https://886studios.com">886 Studios</Out>
        </p>
        <p className={styles.description}>
          <Link href="/writing">writing</Link> and <Link href="/projects">building</Link> things for fun on the side.
        </p>
      </>;
    case "work":
      return <>
        <h2 id="work-heading"><a href="/work" data-enter-island>Work</a></h2>
        <p className={styles.description}>
          associate at <Out href="https://886studios.com">886 Studios</Out>, working on <Out href="https://withikigai.com">ikigai Launchpad</Out> in Taipei.
        </p>
        <ul className={styles.facts} aria-label="Roles">
          {workRoles.slice(0, 3).map((role) => (
            <li key={role.company}><span>{role.role}, {role.company}</span><span className={styles.factMeta}>{dash(role.period)}</span></li>
          ))}
        </ul>
      </>;
    case "writing":
      return <>
        <h2 id="writing-heading"><a href="/writing" data-enter-island>Writing</a></h2>
        <p className={styles.description}>
          essays on human nature, culture, and technology at <Out href={siteConfig.social.substack}><em>flying Arrows</em></Out>.
        </p>
        <ul className={styles.facts} aria-label="Selected essays">
          {workPageEssays.slice(0, 3).map((essay) => (
            <li key={essay.href}><Out href={essay.href}>{essay.title}</Out></li>
          ))}
        </ul>
      </>;
    case "projects":
      return <>
        <h2 id="projects-heading"><a href="/projects" data-enter-island>Projects</a></h2>
        <p className={styles.description}>fun projects i made.</p>
        <ul className={styles.facts} aria-label="Selected projects">
          {projects.slice(0, 3).map((project) => (
            <li key={project.href}><Out href={project.href}>{project.title}</Out></li>
          ))}
        </ul>
      </>;
    case "hello":
      return <>
        <h2 id="hello-heading">Say hi</h2>
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
    case "writing": return <WritingIsland essay={{ title: essays[0].title, subtitle: essays[0].subtitle, date: essays[0].date, href: essays[0].href }} titles={essays.map((essay) => essay.title)} />;
    default: return <LivingIsland world={id} preview={id === "projects" ? projects[0]?.image : undefined} posters={id === "projects" ? projects.map((project) => project.image) : undefined} />;
  }
}

export default function IslandHome() {
  return (
    <div className={styles.home}>
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
            <div className={styles.art} data-scene-art><Art id={stop.id} /></div>
          </section>
        ))}
      </IslandScrollTransport>
    </div>
  );
}
