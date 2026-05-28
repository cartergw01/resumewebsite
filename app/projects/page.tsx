import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import { projects } from "@/content/portfolio";

export default function ProjectsPage() {
  return (
    <div className="cosmic-subpage subpage-projects subpage-topic topic-page">
      <SiteNav active="projects" />

      <main className="subpage-main topic-main projects-main">
        <header className="subpage-hero topic-hero projects-hero">
          <h1>Projects</h1>
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
                >
                  <span className="project-shot">
                    <Image
                      src={project.image}
                      alt={`${project.title} website screenshot`}
                      fill
                      priority={index === 0}
                      quality={86}
                      sizes="(max-width: 760px) calc(100vw - 1.5rem), (max-width: 1200px) 31vw, 360px"
                    />
                  </span>
                  <span className="project-row-copy">
                    <strong>{project.title}</strong>
                    <span>{project.description}</span>
                    <em>Open project</em>
                  </span>
                </a>
              ))}
            </section>

          </section>
        </section>
      </main>
    </div>
  );
}
