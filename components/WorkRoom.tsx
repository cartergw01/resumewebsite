"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
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

type Place = "desk" | "shelf" | "chair";

const places: { id: Place; title: string; description: string; location: string }[] = [
  { id: "desk", title: "886 Studios", description: "What I'm working on", location: "At the desk" },
  { id: "shelf", title: "Along the way", description: "Research & investing", location: "From the shelf" },
  { id: "chair", title: "About me", description: "Bio & interests", location: "Pull up a chair" },
];
const contributionHeadings = ["Sourcing & diligence", "Accelerator programs", "Founder community"];

export default function WorkRoom() {
  const [place, setPlace] = useState<Place | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const headingRefs = useRef<Partial<Record<Place, HTMLHeadingElement | null>>>({});
  const [current, ...earlier] = workPageExperience;

  useEffect(() => {
    if (!place) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    headingRefs.current[place]?.focus({ preventScroll: true });

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
    };
  }, [place]);

  const enter = (next: Place, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setPlace(next);
  };
  const close = () => dialogRef.current?.close();
  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  };

  return (
    <main className={styles.main} data-work-room>
      <div className={styles.returnLink}><IslandReturnLink island="work" /></div>
      <section className={styles.room} aria-label="Carter's workroom" data-place={place ?? undefined}>
        <div className={styles.roomArtwork}>
          <Image src={roomImage} alt="A warmly lit workroom overlooking Taipei, with a desk, a shelf of books, and a chair beside a basketball." fill priority sizes="(min-width: 1480px) 1480px, 100vw" />
          <GalaxyBackground page />
        </div>
        <header className={styles.roomHeading}>
          <p className={styles.location}>Work · Taipei</p>
          <h1>Carter Wang</h1>
          <p className={styles.introduction}>Associate at 886 Studios</p>
        </header>
        <nav className={styles.places} aria-label="Explore the workroom">
          {places.map((spot) => (
            <button
              key={spot.id}
              type="button"
              className={`${styles.place} ${styles[spot.id]}`}
              aria-haspopup="dialog"
              aria-controls="work-room-notes"
              aria-label={`Explore ${spot.title}: ${spot.description}`}
              onClick={(event) => enter(spot.id, event.currentTarget)}
            >
              <span className={styles.point} aria-hidden="true" />
              <strong>{spot.title}</strong>
              <span className={styles.placeDescription}>{spot.description}</span>
            </button>
          ))}
        </nav>
      </section>
      <p className={styles.roomHint}>Choose a place to look around.</p>

      <dialog
        ref={dialogRef}
        id="work-room-notes"
        className={styles.notes}
        aria-labelledby={`room-title-${place ?? "desk"}`}
        onClose={() => setPlace(null)}
        onClick={closeOnBackdrop}
      >
        <div className={styles.notesBar}>
          <span>{places.find((spot) => spot.id === place)?.location}</span>
          <button type="button" onClick={close}>Back to room</button>
        </div>
        <div className={styles.notesContent}>
          <section className={styles.panel} hidden={place !== "desk"}>
            <h2 id="room-title-desk" tabIndex={-1} ref={(node) => { headingRefs.current.desk = node; }}>
              <a href="https://886studios.com/" target="_blank" rel="noopener noreferrer">{current.company}</a>
            </h2>
            <div className={styles.roles}>
              <p><strong>Associate</strong><span>{current.dates}</span></p>
              <p><span>Venture Fellow</span><span>June 2024 - September 2024</span></p>
            </div>
            <ul className={styles.contributions}>
              {current.details.map((detail, index) => (
                <li key={detail}>
                  <h3>{contributionHeadings[index]}</h3>
                  <p>{detail.split(/(\d+\+ (?:early-stage startups|startups|batch teams))/g).map((part, partIndex) => (
                    partIndex % 2 === 1 ? <strong key={partIndex}>{part}</strong> : part
                  ))}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel} hidden={place !== "shelf"}>
            <h2 id="room-title-shelf" tabIndex={-1} ref={(node) => { headingRefs.current.shelf = node; }}>Along the way</h2>
            <div className={styles.experiences}>
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
                  <ul className={styles.details}>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                  {"links" in item && item.links ? (
                    <div className={styles.research}>
                      <p>Published research</p>
                      <div>{item.links.map((article) => <a key={article.href} href={article.href} target="_blank" rel="noopener noreferrer">{article.label}</a>)}</div>
                    </div>
                  ) : null}
                </details>
              ))}
            </div>
          </section>

          <section className={styles.panel} hidden={place !== "chair"}>
            <div className={styles.about}>
              <div className={styles.bio}>
                <h2 id="room-title-chair" tabIndex={-1} ref={(node) => { headingRefs.current.chair = node; }}>Carter Wang</h2>
                {workPageBio.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <div className={styles.portrait}>
                <Image src="/headshot.jpg" alt="Carter Wang" fill sizes="(min-width: 1000px) 380px, (min-width: 821px) 36vw, 100vw" />
              </div>
            </div>
            <div className={styles.personal}>
              <h3>Outside of work</h3>
              <p>{workPageInterests.trim().replace(/\.$/, "")}.</p>
              <details className={styles.backgroundDetails}>
                <summary>Background &amp; skills<span className={styles.indicator} aria-hidden="true">+</span></summary>
                <dl className={styles.facts}>
                  {workPageProfileFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                  <div className={styles.skills}><dt>Skills</dt><dd>{workPageSkills}</dd></div>
                </dl>
              </details>
            </div>
          </section>
        </div>
      </dialog>
    </main>
  );
}
