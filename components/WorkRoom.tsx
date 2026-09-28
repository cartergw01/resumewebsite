import Image from "next/image";
import GalaxyBackground from "@/components/GalaxyBackground";
import IslandReturnLink from "@/components/IslandReturnLink";
import {
  workPageBio,
  workPageExperience,
  workPageInterests,
  workPageProfileFacts,
  workPageSkills,
} from "@/content/portfolio";
import roomImage from "@/public/workroom-v1.png";
import styles from "./WorkRoom.module.css";

const contributionHeadings = ["Sourcing & diligence", "Accelerator programs", "Founder community"];

export default function WorkRoom() {
  const [current, ...earlier] = workPageExperience;

  return (
    <>
      <div className={styles.atmosphere} aria-hidden="true">
        <Image src={roomImage} alt="" fill priority sizes="100vw" />
      </div>
      <GalaxyBackground page />
      <main className={styles.main} data-work-desk>
        <div className={styles.returnLink}><IslandReturnLink island="work" /></div>
        <div className={styles.desk}>
          <div className={styles.workHistory}>
            <section className={styles.current} aria-labelledby="current-work-title">
              <header>
                <p className={styles.eyebrow}>Current work · Taipei</p>
                <h1 id="current-work-title"><a href="https://886studios.com/" target="_blank" rel="noopener noreferrer">{current.company}</a></h1>
                <dl className={styles.roles} aria-label="Roles at 886 Studios">
                  <div><dt>Associate</dt><dd>{current.dates}</dd></div>
                  <div className={styles.previousRole}><dt>Venture Fellow</dt><dd>June 2024 - September 2024</dd></div>
                </dl>
              </header>
              <ul className={styles.contributions}>
                {current.details.map((detail, index) => (
                  <li key={detail}>
                    <h2>{contributionHeadings[index]}</h2>
                    <p>{detail.split(/(\d+\+ (?:early-stage startups|startups|batch teams))/g).map((part, partIndex) => (
                      partIndex % 2 === 1 ? <strong key={partIndex}>{part}</strong> : part
                    ))}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.earlier} aria-labelledby="earlier-work-title">
              <h2 id="earlier-work-title">Research &amp; investing</h2>
              <div className={styles.experiences}>
                {earlier.map((item) => (
                  <article key={item.company} className={styles.experience}>
                    <header className={styles.experienceHeading}>
                      <h3>{item.company}</h3>
                      <p>{item.role}</p>
                      <p className={styles.date}>{item.dates}</p>
                    </header>
                    {"links" in item && item.links ? (
                      <div className={styles.research}>
                        <p>Published research</p>
                        <div>{item.links.map((article) => <a key={article.href} href={article.href} target="_blank" rel="noopener noreferrer">{article.label}</a>)}</div>
                      </div>
                    ) : null}
                    <details className={styles.roleDetails} open={item.company === "Contrary Research"}>
                      <summary aria-label={`Contributions at ${item.company}`}>
                        Contributions<span className={styles.indicator} aria-hidden="true">+</span>
                      </summary>
                      <ul className={styles.details}>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                    </details>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className={styles.profile} aria-labelledby="work-profile-title">
            <div className={styles.bioAndPhoto}>
              <div className={styles.portrait}>
                <Image src="/headshot.jpg" alt="Carter Wang" fill sizes="(min-width: 761px) 220px, (min-width: 400px) 130px, 32vw" />
              </div>
              <div className={styles.bio}>
                <h2 id="work-profile-title">Carter Wang</h2>
                <p>{workPageBio[0]}</p>
              </div>
            </div>
            <details className={styles.moreAbout}>
              <summary>More about me<span className={styles.indicator} aria-hidden="true">+</span></summary>
              {workPageBio.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <dl className={styles.facts}>
                <div><dt>Interests</dt><dd>{`${workPageInterests}.`}</dd></div>
              </dl>
            </details>
            <details className={styles.moreAbout}>
              <summary>Background &amp; skills<span className={styles.indicator} aria-hidden="true">+</span></summary>
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
