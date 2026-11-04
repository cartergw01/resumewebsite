import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import OfficeExplorer from "./OfficeExplorer";
import type { OfficeStopId } from "@/lib/office-plan";
import { workPageExperience } from "@/content/portfolio";
import { getWorkCopy, type WorkEntry } from "@/lib/work-copy";
import batchPhoto from "@/public/ikigai-batch.jpg";
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

// Inline markdown from content/work.md: [links](url) and *italics*. Links to
// this site stay in the tab; the rest open in a new one.
function Md({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = match.index;
    if (match[1] !== undefined) parts.push(<em key={key}><Md text={match[1]} /></em>);
    else if (match[3].startsWith("/")) parts.push(<Link key={key} href={match[3]}>{match[2]}</Link>);
    else parts.push(<Out key={key} href={match[3]}>{match[2]}</Out>);
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
  const { now } = getWorkCopy();
  return (
    <header className={`${heading.header} ${styles.pageHeader}`}>
      <div className={styles.title}>
        <h1 tabIndex={-1}>Work</h1>
        {!preview && <WorkArrival />}
      </div>
      {now.intro.map((paragraph, index) => <p key={index}><Md text={paragraph} /></p>)}
    </header>
  );
}

function CurrentRole() {
  return (
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
  );
}

function CurrentWork({ preview = false }: { preview?: boolean }) {
  const { now } = getWorkCopy();
  return (
    <section className={styles.section} aria-labelledby={preview ? undefined : "now-title"}>
      <h2 id={preview ? undefined : "now-title"} className={styles.label}>Now</h2>
      <div className={styles.body}>
        <CurrentRole />
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
        <figure className={styles.photo}>
          <Image src={batchPhoto} alt="The ikigai Launchpad Spring '25 batch gathered on the floor, smiling at the camera" sizes="(min-width: 720px) 640px, calc(100vw - 40px)" quality={86} placeholder="blur" />
          <figcaption>ikigai Launchpad Spring &apos;25 batch</figcaption>
        </figure>
      </div>
    </section>
  );
}

function About() {
  const { about } = getWorkCopy();
  return <div className={styles.about}>
    <dl className={styles.facts}>
      {about.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
    </dl>
    {about.paragraphs.map((paragraph, index) => <p key={index}><Md text={paragraph} /></p>)}
  </div>;
}

function WorkHistory() {
  const copy = getWorkCopy();
  return <div className={styles.workHistory}>
    <CurrentWork />
    <section className={styles.section} aria-labelledby="earlier-work-title">
      <h2 id="earlier-work-title" className={styles.label}>Previously</h2>
      <ol className={`${styles.body} ${styles.experiences}`}>
        {copy.previously.map(entry => <Entry key={entry.title} entry={entry} />)}
      </ol>
    </section>
    <section className={styles.section} aria-labelledby="side-work-title">
      <h2 id="side-work-title" className={styles.label}>On the side</h2>
      <ul className={`${styles.body} ${styles.experiences}`}>
        {copy.onTheSide.map(entry => <Entry key={entry.title} entry={entry} />)}
      </ul>
    </section>
    <section className={styles.section} aria-labelledby="about-title">
      <h2 id="about-title" className={styles.label}>About me</h2>
      <div className={styles.body}><About /></div>
    </section>
  </div>;
}

function OfficeContent({ preview = false }: { preview?: boolean }) {
  const copy = getWorkCopy();
  const contribution = (index: number) => {
    const item = copy.now.highlights[index];
    return <article>
      <header className={styles.experienceHeading}>
        <h3><Logo company={current.company} size={26} />{item.title}</h3>
        <p className={styles.date}>{current.company} · {current.dates}</p>
      </header>
      <div className={`${styles.story} ${styles.panelStory}`}>
        {item.paragraphs.map((paragraph, i) => <p key={i}><Md text={paragraph} /></p>)}
      </div>
      {index === 0 && <figure className={styles.photo}>
        <Image src={batchPhoto} alt="The ikigai Launchpad Spring '25 batch gathered on the floor, smiling at the camera" sizes="(min-width: 900px) 420px, calc(100vw - 40px)" quality={86} />
        <figcaption>ikigai Launchpad Spring &apos;25 batch</figcaption>
      </figure>}
    </article>;
  };
  const panels: Record<OfficeStopId, ReactNode> = {
    now: <CurrentRole />,
    accelerator: preview ? null : contribution(0),
    founders: preview ? null : contribution(1),
    community: preview ? null : contribution(2),
    research: preview ? null : <ul className={styles.experiences}><Entry entry={copy.previously[0]} /></ul>,
    slug: preview ? null : <ul className={styles.experiences}><Entry entry={copy.previously[1]} /></ul>,
    side: preview ? null : <><p className={styles.label}>On the side</p><ul className={styles.experiences}>{copy.onTheSide.map(entry => <Entry key={entry.title} entry={entry} />)}</ul></>,
    about: preview ? null : <><p className={styles.label}>About me</p><About /></>,
  };
  return <OfficeExplorer header={<WorkHeader preview={preview} />} panels={panels} list={preview ? null : <WorkHistory />} preview={preview} />;
}

// Same opening composition for the island transition and its destination.
export function WorkWindowPreview() {
  return <div data-work-window-content hidden inert aria-hidden="true">
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.desk}>
          <OfficeContent preview />
        </div>
      </div>
    </div>
  </div>;
}

export default function WorkRoom() {
  const copy = getWorkCopy();
  return <main className={styles.main} data-work-desk id="main-content" tabIndex={-1}>
    <div className={`${styles.desk} ${entry.arrival}`} data-work-arrival>
      <OfficeContent />
      <footer className={styles.contact}>
        {copy.closing.map((paragraph, index) => <p key={index} className={styles.closing}><Md text={paragraph} /></p>)}
      </footer>
    </div>
  </main>;
}
