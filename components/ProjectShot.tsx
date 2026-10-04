"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { arriveAtWorkshop } from "@/lib/workshop-entry";
import styles from "./ProjectShot.module.css";

// A project row's screenshot. Travelling in from /2.0, every project card from
// the workshop's fan lands on its own row's shot; the first row starts that
// arrival and uses the same unoptimized image the laptop screen carries.
export default function ProjectShot({ src, title, dock = false, mobilePreview }: { src: string; title: string; dock?: boolean; mobilePreview: { scale: number; position: string } }) {
  const shot = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (dock && shot.current) arriveAtWorkshop(shot.current);
  }, [dock]);

  return (
    <span className={`project-shot ${styles.shot}`} ref={shot} data-project-shot data-project-screen={dock ? "" : undefined}
      style={{ "--preview-scale": mobilePreview.scale, "--preview-position": mobilePreview.position } as CSSProperties}>
      <Image
        src={src}
        alt={`${title} website screenshot`}
        fill
        quality={86}
        priority={dock}
        unoptimized={dock}
        sizes="(max-width: 760px) 140vw, (max-width: 1200px) 31vw, 360px"
      />
    </span>
  );
}
