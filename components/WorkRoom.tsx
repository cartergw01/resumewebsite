import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import GalaxyBackground from "@/components/GalaxyBackground";
import { workPageExperience } from "@/content/portfolio";
import { getWorkCopy, type WorkEntry } from "@/lib/work-copy";
import batchPhoto from "@/public/ikigai-batch.jpg";
import IslandLine from "./IslandLine";
import WorkArrival from "./WorkArrival";
import entry from "./WorkEntry.module.css";
import heading from "./PageHeading.module.css";
import styles from "./WorkRoom.module.css";

const [current] = workPageExperience;

// Company marks, shown beside each name. They're decorative (the name is right
// there), and CSS tints them all the same cream so they read as one family.
const logos: Record<string, string> = {
  "886 Studios": "/logos/886-studios.png",
  "Contrary Research": "/logos/contrary.svg",
  "Slug Fund Investment Group": "/logos/slug-fund.svg",
  "Korobra Capital": "/logos/korobra-capital.png",
};

function Logo({ company, size }: { company: string; size: number }) {
  const src = logos[company];
  if (!src) return null;
  return <Image className={styles.logo} src={src} alt="" aria-hidden="true" width={size} height={size} unoptimized />;
}

function Out({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

// Inline markdown from content/work.md: [links](url), *italics*, and **bold**.
// Links to this site stay in the tab; the rest open in a new one.
function Md({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = match.index;
    if (match[1] !== undefined) parts.push(<strong key={key}><Md text={match[1]} /></strong>);
    else if (match[2] !== undefined) parts.push(<em key={key}><Md text={match[2]} /></em>);
    else if (match[4].startsWith("/")) parts.push(<Link key={key} href={match[4]}>{match[3]}</Link>);
    else parts.push(<Out key={key} href={match[4]}>{match[3]}</Out>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// Shorter titles where the story already tells the progression.
const shortTitles: Record<string, string> = {
  "Slug Fund Investment Group": "Vice President",
};

// A job (role and dates from content/portfolio.ts) or a side project.
function Entry({ entry }: { entry: WorkEntry }) {
  const job = workPageExperience.find((item) => item.company === entry.title);
  return (
    <li className={styles.experience}>
      <header className={styles.experienceHeading}>
        <h3><Logo company={entry.title} size={26} />{entry.title}</h3>
        {job && <div className={styles.tenure}>
          <p className={styles.role}>{shortTitles[job.company] ?? job.role}</p>
          <p className={styles.date}>{job.dates}</p>
        </div>}
      </header>
      <div className={styles.story}>
        {entry.paragraphs.map((paragraph, index) => <p key={index}><Md text={paragraph} /></p>)}
      </div>
      {entry.more && <p className={styles.more}><Link href={entry.more.href}>{entry.more.label}</Link></p>}
    </li>
  );
}

function WorkHeader({ preview = false }: { preview?: boolean }) {
  return (
    <header className={heading.header}>
      <div className={styles.title}>
        <h1 tabIndex={-1}>Work</h1>
        {!preview && <WorkArrival />}
      </div>
      <p><IslandLine id="work" /></p>
    </header>
  );
}

function CurrentWork({ preview = false }: { preview?: boolean }) {
  const { now } = getWorkCopy();
  return (
    <section className={styles.section} aria-labelledby={preview ? undefined : "now-title"}>
      <h2 id={preview ? undefined : "now-title"} className={styles.label}>Now</h2>
      <div className={styles.body}>
        <header className={styles.experienceHeading}>
          <h3 className={styles.current}>
            <Logo company={current.company} size={36} />
            <a href="https://886studios.com/" target="_blank" rel="noopener noreferrer">{current.company}</a>
          </h3>
          <div className={styles.tenure}>
            <p className={styles.role}>{current.role}</p>
            <p className={styles.date}>{current.dates}</p>
          </div>
          <div className={styles.tenure}>
            <p className={styles.role}>Venture Fellow</p>
            <p className={styles.date}>June 2024 - September 2024</p>
          </div>
        </header>
        {now.intro.map((paragraph, index) => <p key={index} className={styles.mission}><Md text={paragraph} /></p>)}
        <div className={styles.contributions}>
          {now.highlights.map((item) => (
            <div key={item.title}>
              <h4>{item.title}</h4>
              {item.paragraphs.map((line, index) => (
                <p key={index}><Md text={line} /></p>
              ))}
            </div>
          ))}
        </div>
        {!preview && <figure className={styles.photo}>
          <Image src={batchPhoto} alt="The ikigai Launchpad Spring '25 batch gathered on the floor, smiling at the camera" sizes="(min-width: 720px) 640px, calc(100vw - 40px)" quality={90} placeholder="blur" />
          <figcaption>ikigai Launchpad Spring &apos;25 batch</figcaption>
        </figure>}
      </div>
    </section>
  );
}

// Inert source for the carried window. The opening is rendered from the same
// components as /work, so the view through the glass matches its destination.
export function WorkWindowPreview() {
  return <div data-work-window-content hidden inert aria-hidden="true">
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.desk}>
          <WorkHeader preview />
          <div className={styles.workHistory}><CurrentWork preview /></div>
        </div>
      </div>
    </div>
  </div>;
}

export default function WorkRoom() {
  const copy = getWorkCopy();
  return (
    <>
      <GalaxyBackground page playbackRate={0.55} />
      <main className={styles.main} data-work-desk>
        <div className={`${styles.desk} ${entry.arrival}`} data-work-arrival>
          <WorkHeader />

          {/* A centered reading column; section labels sit in the desktop margin. */}
          <div className={styles.workHistory}>
            <CurrentWork />

            <section className={styles.section} aria-labelledby="earlier-work-title">
              <h2 id="earlier-work-title" className={styles.label}>Previously</h2>
              <ol className={`${styles.body} ${styles.experiences}`}>
                {copy.previously.map((entry) => <Entry key={entry.title} entry={entry} />)}
              </ol>
            </section>

            <section className={styles.section} aria-labelledby="side-work-title">
              <h2 id="side-work-title" className={styles.label}>On the side</h2>
              <ul className={`${styles.body} ${styles.experiences}`}>
                {copy.onTheSide.map((entry) => <Entry key={entry.title} entry={entry} />)}
              </ul>
            </section>

            <section className={styles.section} aria-labelledby="about-title">
              <h2 id="about-title" className={styles.label}>About me</h2>
              <div className={`${styles.body} ${styles.about}`}>
                <dl className={styles.facts}>
                  {copy.about.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                </dl>
                {copy.about.paragraphs.map((paragraph, index) => <p key={index}><Md text={paragraph} /></p>)}
              </div>
            </section>

            <div className={styles.section}>
              {copy.closing.map((paragraph, index) => (
                <p key={index} className={`${styles.body} ${styles.closing}`}><Md text={paragraph} /></p>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
