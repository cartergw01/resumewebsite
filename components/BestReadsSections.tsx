"use client";

import { Children, useState, type MouseEvent, type ReactNode } from "react";
import styles from "./BestReads.module.css";

// The newspaper's sections bar, and which section is showing. A long section
// opens on its first stories, with the rest a "Show all" away.
export default function BestReadsSections({ sections, children }: { sections: { topic: string; long: boolean }[]; children: ReactNode }) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<string[]>([]);
  const pages = Children.toArray(children);
  const pick = (index: number) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail) event.currentTarget.blur();
    setActive(index);
  };

  return <>
    <div className={styles.sections} role="group" aria-label="Sections">
      {sections.map(({ topic }, index) => (
        <button key={topic} type="button" aria-pressed={index === active} onClick={pick(index)}>{topic}</button>
      ))}
    </div>
    {pages.map((page, index) => {
      const { topic, long } = sections[index];
      const open = expanded.includes(topic);
      return (
        <div key={topic} className={styles.section} hidden={index !== active} data-expanded={open ? "" : undefined}>
          {page}
          {long && !open ? (
            <button type="button" className={styles.more} onClick={event => {
              const section = event.currentTarget.parentElement;
              setExpanded(list => [...list, topic]);
              // The button goes once it's used, so focus moves on to the first story it brought in.
              requestAnimationFrame(() => section?.querySelector<HTMLElement>("[data-more] a")?.focus({ preventScroll: true }));
            }}>Show all</button>
          ) : null}
        </div>
      );
    })}
  </>;
}
