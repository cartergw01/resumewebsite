import Image from "next/image";
import type { ReactNode } from "react";
import CountUp from "@/components/CountUp";
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

const contributions: { headline: ReactNode; detail: string }[] = [
  {
    headline: <><em><CountUp to={250} suffix="+" /></em> startups screened, <em><CountUp to={100} suffix="+" /></em> taken through diligence</>,
    detail: current.details[0],
  },
  {
    headline: <><em><CountUp to={15} suffix="+" /></em> batch teams supported at ikigai Launchpad</>,
    detail: current.details[1],
  },
  {
    headline: <><em>Launch Station</em>, a community program for founders</>,
    detail: current.details[2],
  },
];

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
                  <div><dt>Associate</dt><dd>{current.dates}</dd></div>
                  <div><dt>Venture Fellow</dt><dd>June 2024 - September 2024</dd></div>
                </dl>
              </header>
              <ul className={styles.contributions}>
                {contributions.map((item) => (
                  <li key={item.detail}>
                    <h2>{item.headline}</h2>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
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
