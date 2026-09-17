import type { Metadata } from "next";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import GalaxyBackground from "@/components/GalaxyBackground";
import IslandReturnLink from "@/components/IslandReturnLink";
import ProjectScreen from "@/components/ProjectScreen";
import worldStyles from "@/components/ProjectsWorld.module.css";
import { projects } from "@/content/portfolio";
import {
  breadcrumbJsonLd,
  buildMetadata,
  jsonLdScript,
  projectsItemListJsonLd,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata("projects");

export default function ProjectsPage() {
  const [featured, ...remaining] = projects;
  return (
    <div className={`cosmic-subpage subpage-projects subpage-topic topic-page ${worldStyles.page}`} data-rocket-launch-zone data-island-page>
      <script
        {...jsonLdScript([
          webPageJsonLd("projects", "CollectionPage"),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Projects", path: "/projects" },
          ]),
          projectsItemListJsonLd(),
        ])}
      />
      <SiteNav active="projects" />
      <GalaxyBackground page />

      <main className={`subpage-main topic-main projects-main ${worldStyles.main}`}>
        <header className={`subpage-hero topic-hero projects-hero ${worldStyles.hero}`} data-workshop-reveal>
          <div className={worldStyles.heading}>
            <IslandReturnLink island="projects" />
            <h1>Projects</h1>
            <p>fun projects i made.</p>
          </div>
        </header>

        <section className="topic-layout projects-layout" aria-label="Projects world">
          <aside className="subpage-world-art topic-world-art" aria-hidden="true" />

          <section className="projects-workshop" aria-label="Project workshop">
            {featured ? <a className={worldStyles.featured} href={featured.href} target="_blank" rel="noopener noreferrer"
              aria-label={`Open ${featured.title} live project in a new tab`}>
              <ProjectScreen src={featured.image} title={featured.title} />
              <span className={worldStyles.featuredCopy} data-workshop-reveal>
                <strong>{featured.title}</strong>
                <span>{featured.description}</span>
                <em>View project <span aria-hidden="true">↗</span></em>
              </span>
            </a> : null}
            <section className="project-list" aria-label="Live projects">
              {projects.length === 0 ? (
                <p className="project-empty">Projects will appear here soon.</p>
              ) : remaining.map((project, index) => (
                <a
                  className="project-row"
                  key={project.href}
                  href={project.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${project.title} live project in a new tab`}
                  style={{ animationDelay: `${0.08 + index * 0.045}s` }}
                  data-workshop-reveal
                >
                  <span className="project-shot">
                    <Image
                      src={project.image}
                      alt={`${project.title} website screenshot`}
                      fill
                      quality={86}
                      sizes="(max-width: 760px) calc(100vw - 1.5rem), (max-width: 1200px) 31vw, 360px"
                    />
                  </span>
                  <span className="project-row-copy">
                    <strong>{project.title}</strong>
                    <span>{project.description}</span>
                  </span>
                  <em>View →</em>
                </a>
              ))}
            </section>

          </section>
        </section>
      </main>
    </div>
  );
}
