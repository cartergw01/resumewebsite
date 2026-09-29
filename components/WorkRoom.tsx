import Image from "next/image";
import type { ReactNode } from "react";
import GalaxyBackground from "@/components/GalaxyBackground";
import IslandReturnLink from "@/components/IslandReturnLink";
import {
  workPageBio,
  workPageExperience,
  workPageInterests,
  workPageProfileFacts,
  workPageSkills,
} from "@/content/portfolio";
import styles from "./WorkRoom.module.css";

const [current, ...earlier] = workPageExperience;

function Out({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const highlights: { heading: ReactNode; points: ReactNode[] }[] = [
  {
    heading: <>Lead deal sourcing for a new <Out href="https://withikigai.com">accelerator</Out></>,
    points: [
      "Screen and interview 250+ early-stage startups",
      "Run diligence on 100+ startups",
      "Own the full application pipeline, from inbound through review",
      "Design and manage the admissions process and contribute to final selection decisions",
    ],
  },
  {
    heading: "Served on the core team that created ikigai Launchpad in Taiwan",
    points: [
      "Supported 15+ batch teams through workshops, office hours, investor matching, partnerships, and corporate perks",
      "Helped shape the selection rubric",
    ],
  },
  {
    heading: "Founder community & content",
    points: [
      "Built Launch Station, a residency program, with over 20 founders",
      "Orchestrate founder and community events: hackathons, pitch nights, co-founder matching, and more",
      <>
        Lead content: <Out href="https://886studios.substack.com/">newsletters</Out>, socials
        (<Out href="https://x.com/886Studios">X</Out>, <Out href="https://www.linkedin.com/company/886studios/">LinkedIn</Out>, <Out href="https://www.instagram.com/ikigai_launchpad/">Instagram</Out>),
        and rebuilt our <Out href="https://www.886studios.com/">website</Out>
      </>,
    ],
  },
];

// The first bio paragraph repeats the 886 header, so the profile skips it.
const [, bioLead, ...bioRest] = workPageBio;

export default function WorkRoom() {
  return (
    <>
      <GalaxyBackground page />
      <main className={styles.main} data-work-desk>
        <div className={styles.returnLink}><IslandReturnLink island="work" /></div>
        <div className={styles.desk}>
          <div className={styles.workHistory}>
            <section aria-labelledby="current-work-title">
              <header className={styles.intro}>
                <h1 id="current-work-title">
                  <a href="https://886studios.com/" target="_blank" rel="noopener noreferrer">{current.company}</a>
                </h1>
                <dl className={styles.roles} aria-label={`Roles at ${current.company}`}>
                  <div><dt>{current.role}</dt><dd>{current.dates}</dd></div>
                  <div><dt>Venture Fellow</dt><dd>June 2024 - September 2024</dd></div>
                </dl>
              </header>
              <div className={styles.contributions}>
                {highlights.map((item, index) => (
                  <div key={index}>
                    <h2>{item.heading}</h2>
                    <ul>{item.points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}</ul>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.earlier} aria-labelledby="earlier-work-title">
              <h2 id="earlier-work-title">Previously</h2>
              <ol className={styles.experiences}>
                {earlier.map((item) => (
                  <li key={item.company} className={styles.experience}>
                    <header className={styles.experienceHeading}>
                      <h3>{item.company}</h3>
                      <p className={styles.date}>{item.dates}</p>
                      <p className={styles.role}>{item.role}</p>
                    </header>
                    {"links" in item && item.links ? (
                      <div className={styles.research}>
                        <p>Published research</p>
                        <ul>
                          {item.links.map((article) => (
                            <li key={article.href}>
                              <a href={article.href} target="_blank" rel="noopener noreferrer">{article.label}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <details className={styles.disclosure}>
                      <summary aria-label={`What I did at ${item.company}`}>
                        What I did<span className={styles.indicator} aria-hidden="true" />
                      </summary>
                      <ul className={styles.details}>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                    </details>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className={styles.profile} aria-labelledby="work-profile-title">
            <div className={styles.portrait}>
              <Image src="/headshot.jpg" alt="Carter Wang" fill sizes="(min-width: 761px) 240px, 38vw" />
            </div>
            <div className={styles.bio}>
              <h2 id="work-profile-title">Carter Wang</h2>
              <p>{bioLead}</p>
            </div>
            <details className={styles.disclosure}>
              <summary>More about me<span className={styles.indicator} aria-hidden="true" /></summary>
              {bioRest.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <dl className={styles.facts}>
                <div><dt>Interests</dt><dd>{`${workPageInterests}.`}</dd></div>
              </dl>
            </details>
            <details className={styles.disclosure}>
              <summary>Background &amp; skills<span className={styles.indicator} aria-hidden="true" /></summary>
              <dl className={styles.facts}>
                {workPageProfileFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                <div><dt>Skills</dt><dd>{workPageSkills}</dd></div>
              </dl>
            </details>
          </aside>
        </div>
      </main>
    </>
  );
}
