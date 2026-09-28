import Image from "next/image";
import {
  workPageBio,
  workPageExperience,
  workPageInterests,
  workPageProfileFacts,
  workPageSkills,
} from "@/content/portfolio";
import IslandReturnLink from "@/components/IslandReturnLink";
import styles from "./WorkProfile.module.css";

const currentDetailHeadings = [
  "Sourcing & diligence",
  "Accelerator programs",
  "Founder community",
];

export default function PortfolioHome() {
  const [current, ...earlier] = workPageExperience;

  return (
    <main className={styles.main}>
      <IslandReturnLink island="work" />
      <header className={styles.intro}>
        <div className={styles.bio}>
          <h1>Carter Wang</h1>
          {workPageBio.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className={styles.portrait}>
          <Image
            alt="Carter Wang headshot"
            src="/headshot.jpg"
            fill
            priority
            sizes="(min-width: 1200px) 440px, (min-width: 761px) 42vw, 100vw"
          />
        </div>
      </header>

      <dl className={styles.facts} aria-label="About Carter">
        {workPageProfileFacts.map((fact) => (
          <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
        ))}
      </dl>

      <section className={styles.current} aria-labelledby="current-work">
        <header className={styles.currentHeader}>
          <h2 id="current-work">
            <a className={styles.companyLink} href="https://886studios.com/" target="_blank" rel="noopener noreferrer">
              {current.company}
            </a>
          </h2>
          <div className={styles.roles}>
            <div className={styles.role}>
              <strong>Associate</strong><span>{current.dates}</span>
            </div>
            <div className={styles.role}>
              <span>Venture Fellow</span><span>June 2024 - September 2024</span>
            </div>
          </div>
        </header>
        <ul className={styles.focusList} role="list">
          {current.details.map((detail, index) => (
            <li key={detail}>
              <h3 className={styles.focusHeading}>{currentDetailHeadings[index]}</h3>
              <p className={styles.focusCopy}>
                {detail.split(/(\d+\+ (?:early-stage startups|startups|batch teams))/g).map((part, partIndex) => (
                  partIndex % 2 === 1 ? <strong key={partIndex}>{part}</strong> : part
                ))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.earlier} aria-labelledby="earlier-work">
        <h2 id="earlier-work">Earlier Experience</h2>
        {earlier.map((item) => (
          <details key={item.company} className={styles.experience} open={item.company === "Contrary Research"}>
            <summary>
              <span className={styles.experienceHeading}>
                <strong>{item.company}</strong>
                <span>{item.role}</span>
                <span className={styles.date}>{item.dates}</span>
              </span>
              <span className={styles.indicator} aria-hidden="true">+</span>
            </summary>
            <div className={styles.experienceBody}>
              <ul className={styles.details}>
                {item.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
              {"links" in item && item.links ? (
                <div className={styles.researchLinks}>
                  {item.links.map((article) => (
                    <a key={article.href} href={article.href} target="_blank" rel="noopener noreferrer">{article.label}</a>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </section>

      <aside className={styles.profile} aria-label="Profile details">
        <dl className={styles.interests}>
          <div><dt>Skills</dt><dd>{workPageSkills}</dd></div>
          <div><dt>Interests</dt><dd>{workPageInterests}</dd></div>
        </dl>
      </aside>
    </main>
  );
}
