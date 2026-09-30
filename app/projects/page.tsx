import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import GalaxyBackground from "@/components/GalaxyBackground";
import IslandReturnLink from "@/components/IslandReturnLink";
import ProjectShot from "@/components/ProjectShot";
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
            <section className="project-list" aria-label="Live projects">
              {projects.length === 0 ? (
                <p className="project-empty">Projects will appear here soon.</p>
              ) : projects.map((project, index) => (
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
                  <ProjectShot src={project.image} title={project.title} dock={index === 0} />
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
