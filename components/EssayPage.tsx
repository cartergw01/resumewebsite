"use client";

import { useLayoutEffect, useRef } from "react";
import { arriveAtBook } from "@/lib/workshop-entry";
import EssayLeaf, { type EssayPreview } from "./EssayLeaf";
import styles from "./WritingWorld.module.css";

export default function EssayPage({ essay }: { essay: EssayPreview }) {
  const paper = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (paper.current) arriveAtBook(paper.current);
  }, []);

  return <a className={styles.essayLink} href={essay.href} target="_blank" rel="noopener noreferrer" aria-label={`Read ${essay.title} on Substack`}>
    <span ref={paper} className={styles.paper} data-essay-page>
      <svg viewBox="0 0 320 400" aria-hidden="true"><EssayLeaf essay={essay} /></svg>
    </span>
    <span className={styles.read} data-book-reveal>Read on Substack <span aria-hidden="true">↗</span></span>
  </a>;
}
