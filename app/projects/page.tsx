import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import { projectOpenSlots, projects } from "@/content/portfolio";

export default function ProjectsPage() {
  return (
    <div className="cosmic-subpage subpage-projects subpage-topic topic-page">
      <SiteNav active="projects" />

      <main className="subpage-main topic-main projects-main">
        <header className="subpage-hero topic-hero projects-hero">
          <span>Projects</span>
          <h1>Projects</h1>
          <p>
            A few tools I have shipped or prototyped, mostly around Taipei, movies, games, and
            personal curiosity.
          </p>
          <div className="topic-meta-strip" aria-label="Project types">
            <span>Tools</span>
            <span>Taipei</span>
            <span>Games</span>
          </div>
        </header>

        <section className="topic-layout projects-layout" aria-label="Projects world">
          <aside className="subpage-world-art topic-world-art" aria-hidden="true" />

          <section className="project-grid project-grid-showcase" aria-label="Project grid">
            {projects.map((project, index) => (
              <a
                className="project-card-live"
                key={project.href}
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ animationDelay: `${0.08 + index * 0.045}s` }}
              >
                <span className="project-shot">
                  <Image
                    src={project.image}
                    alt={`${project.title} website screenshot`}
                    fill
                    sizes="(max-width: 760px) 100vw, (max-width: 1100px) 46vw, 360px"
                  />
                </span>
                <span className="project-meta">
                  <small>{project.label}</small>
                  <strong>{project.title}</strong>
                  <span>{project.description}</span>
                </span>
              </a>
            ))}

            {projectOpenSlots.map((slot, index) => (
              <article
                className="project-slot project-slot-open"
                key={slot}
                style={{ animationDelay: `${0.24 + index * 0.045}s` }}
              >
                <span>Open slot</span>
                <strong>{slot}</strong>
              </article>
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}
