import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import { projects, workshopQueue } from "@/content/portfolio";

export default function ProjectsPage() {
  return (
    <div className="cosmic-subpage subpage-projects subpage-topic topic-page">
      <SiteNav active="projects" />

      <main className="subpage-main topic-main projects-main">
        <header className="subpage-hero topic-hero projects-hero">
          <h1>Projects</h1>
          <p>
            Small tools and city experiments, kept close enough to keep changing.
          </p>
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
                      sizes="(max-width: 760px) 100vw, (max-width: 1200px) 31vw, 360px"
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

            <section className="workshop-queue" aria-label="On the bench">
              <div className="project-section-heading">
                <h2>On the bench</h2>
                <p>Loose threads I am watching, testing, or waiting for a real reason to build.</p>
              </div>

              <div className="workshop-ledger">
                {workshopQueue.map((item) => (
                  <article className="workshop-line" key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </section>
      </main>
    </div>
  );
}
