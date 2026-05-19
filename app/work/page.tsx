import SiteNav from "@/components/SiteNav";
import { workFocus, workRoles } from "@/content/portfolio";

export default function WorkPage() {
  const researchLinks = workRoles.flatMap((role) => role.links ?? []);

  return (
    <div className="cosmic-subpage subpage-work subpage-topic topic-page">
      <SiteNav active="work" />

      <main className="subpage-main topic-main">
        <header className="subpage-hero topic-hero">
          <span>Work</span>
          <h1>Venture work in Taipei.</h1>
          <p>
            I work on founder programs, startup research, and early-stage company support at 886
            Studios, alongside the founders of Twitch and Guitar Hero.
          </p>
          <div className="topic-meta-strip" aria-label="Work focus">
            <span>Venture</span>
            <span>Research</span>
            <span>Founder programs</span>
          </div>
        </header>

        <section className="topic-layout work-layout" aria-label="Work world">
          <div className="topic-content">
            <section className="work-focus-grid" aria-label="What I do">
              {workFocus.map(([title, copy], index) => (
                <article
                  className="subpage-panel work-focus-card"
                  key={title}
                  style={{ animationDelay: `${0.08 + index * 0.045}s` }}
                >
                  <span>{title}</span>
                  <p>{copy}</p>
                </article>
              ))}
            </section>

            <section className="subpage-panel-list work-history" aria-label="Work history">
              {workRoles.map((role, index) => (
                <article
                  className="subpage-panel work-role"
                  key={role.company}
                  style={{ animationDelay: `${0.16 + index * 0.045}s` }}
                >
                  <div className="panel-kicker">
                    <span>{role.period}</span>
                    <span>{role.location}</span>
                  </div>
                  <h2>{role.company}</h2>
                  <h3>{role.role}</h3>
                  <p>{role.blurb}</p>
                  {role.bullets && (
                    <ul>
                      {role.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </section>

            {researchLinks.length > 0 && (
              <section className="research-panel" aria-label="Contrary research links">
                <div>
                  <span>Research archive</span>
                  <p>Selected company deep dives from Contrary Research.</p>
                </div>
                <div className="research-link-grid">
                  {researchLinks.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
