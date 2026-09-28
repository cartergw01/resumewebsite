import Image from "next/image";
import GalaxyBackground from "@/components/GalaxyBackground";
import WorkScene, { type WorkAct } from "@/components/WorkScene";
import {
  workPageBio,
  workPageExperience,
  workPageInterests,
  workPageProfileFacts,
  workPageSkills,
} from "@/content/portfolio";
import styles from "./WorkRoom.module.css";

const [current, ...earlier] = workPageExperience;

const acts: WorkAct[] = [
  {
    title: "Sourcing & diligence",
    headline: <><em>250+</em> startups screened, <em>100+</em> taken through diligence</>,
    detail: current.details[0],
  },
  {
    title: "Accelerator programs",
    headline: <><em>15+</em> batch teams supported at ikigai Launchpad</>,
    detail: current.details[1],
  },
  {
    title: "Founder community",
    headline: <><em>Launch Station</em>, a community program for founders</>,
    detail: current.details[2],
  },
];

export default function WorkRoom() {
  return (
    <>
      <GalaxyBackground page />
      <main className={styles.main} data-work-desk>
        <WorkScene
          company={current.company}
          href="https://886studios.com/"
          roles={[
            { title: "Associate", dates: current.dates },
            { title: "Venture Fellow", dates: "June 2024 - September 2024" },
          ]}
          acts={acts}
        />

        <div className={styles.after}>
          <section className={styles.earlier} aria-labelledby="earlier-work-title">
            <h2 id="earlier-work-title">Research &amp; investing</h2>
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
                  <details className={styles.disclosure} open={item.company === "Contrary Research"}>
                    <summary aria-label={`Contributions at ${item.company}`}>
                      Contributions<span className={styles.indicator} aria-hidden="true" />
                    </summary>
                    <ul className={styles.details}>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                  </details>
                </li>
              ))}
            </ol>
          </section>

          <aside className={styles.profile} aria-labelledby="work-profile-title">
            <div className={styles.portrait}>
              <Image src="/headshot.jpg" alt="Carter Wang" fill sizes="(min-width: 761px) 240px, 38vw" />
            </div>
            <div className={styles.bio}>
              <h2 id="work-profile-title">Carter Wang</h2>
              <p>{workPageBio[0]}</p>
            </div>
            <details className={styles.disclosure}>
              <summary>More about me<span className={styles.indicator} aria-hidden="true" /></summary>
              {workPageBio.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
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
