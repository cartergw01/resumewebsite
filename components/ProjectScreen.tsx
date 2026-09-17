"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { arriveAtWorkshop } from "@/lib/workshop-entry";
import styles from "./ProjectsWorld.module.css";

export default function ProjectScreen({ src, title }: { src: string; title: string }) {
  const screen = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (screen.current) arriveAtWorkshop(screen.current);
  }, []);

  return <span className={styles.screenFrame}>
    <span className={styles.projectScreen} ref={screen} data-project-screen tabIndex={-1}>
      <Image src={src} alt={`${title} website screenshot`} fill priority unoptimized sizes="(max-width: 760px) 100vw, 65vw" />
    </span>
    <span className={styles.screenBase} aria-hidden="true" />
  </span>;
}
