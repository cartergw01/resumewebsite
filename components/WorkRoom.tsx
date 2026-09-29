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

// Written in Carter's first-person voice; every fact matches content/portfolio.ts.
const highlights: { heading: string; story: ReactNode }[] = [
  {
    heading: "Building ikigai Launchpad",
    story: "I was on the core team that created ikigai Launchpad in Taiwan. I helped shape how we pick teams, then worked with 15+ of them through workshops, office hours, investor intros, and partnerships.",
  },
  {
    heading: "Finding founders",
    story: <>I run deal sourcing for our <Out href="https://withikigai.com">accelerator</Out>. I&apos;ve screened and interviewed 250+ early-stage startups, gone deep on diligence with 100+ of them, and built the admissions process that decides who gets in.</>,
  },
  {
    heading: "Community & content",
    story: (
      <>
        I built Launch Station, a residency program with 20+ founders, and host events for the wider community: hackathons, pitch nights, co-founder matching.
        I also write our <Out href="https://886studios.substack.com/">newsletter</Out>, run our socials (<Out href="https://x.com/886Studios">X</Out>, <Out href="https://www.linkedin.com/company/886studios/">LinkedIn</Out>, <Out href="https://www.instagram.com/ikigai_launchpad/">Instagram</Out>), and rebuilt our <Out href="https://www.886studios.com/">website</Out>.
      </>
    ),
  },
];

type Earlier = (typeof earlier)[number];

// One-line stories for earlier roles; the full bullet details live on /resume.
function earlierStory(item: Earlier): ReactNode {
  switch (item.company) {
    case "Contrary Research": {
      const links = "links" in item && item.links ? item.links : [];
      return (
        <>
          I spent a year profiling and writing about startups like{" "}
          {links.map((article, index) => (
            <span key={article.href}>
              {index > 0 ? (index === links.length - 1 ? ", and " : ", ") : null}
              <Out href={article.href}>{article.label}</Out>
            </span>
          ))}
          .
        </>
      );
    }
    case "Slug Fund Investment Group":
      return "UC Santa Cruz's student investment club. When leadership graduated during COVID and left a vacuum, I stepped up, revived the club, and revamped the whole thing. Along the way I went from equity analyst pitching stocks to VP, and started a venture analyst team that wrote 15+ memos for a fantasy VC portfolio.";
    case "Korobra Capital":
      return "A fund I started in 2020 for family and friends. It's now $180K+, invested long term in AI, fintech, crypto, robotics, and more.";
    default:
      return null;
  }
}

// The first two bio paragraphs repeat the 886 section, so the profile keeps
// the personal one.
const bioLead = workPageBio[2];

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
              <p className={styles.mission}>We&apos;re building an accelerator that backs early-stage startups, bringing a slice of Silicon Valley to Asia.</p>
              <div className={styles.contributions}>
                {highlights.map((item) => (
                  <div key={item.heading}>
                    <h2>{item.heading}</h2>
                    <p>{item.story}</p>
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
                    <p className={styles.story}>{earlierStory(item)}</p>
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
