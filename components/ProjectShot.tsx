"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { arriveAtWorkshop } from "@/lib/workshop-entry";

// A project row's screenshot. Travelling in from /2.0, every project card from
// the workshop's fan lands on its own row's shot; the first row starts that
// arrival and uses the same unoptimized image the laptop screen carries.
export default function ProjectShot({ src, title, dock = false }: { src: string; title: string; dock?: boolean }) {
  const shot = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (dock && shot.current) arriveAtWorkshop(shot.current);
  }, [dock]);

  return (
    <span className="project-shot" ref={shot} data-project-shot data-project-screen={dock ? "" : undefined}>
      <Image
        src={src}
        alt={`${title} website screenshot`}
        fill
        quality={86}
        priority={dock}
        unoptimized={dock}
        sizes="(max-width: 760px) calc(100vw - 1.5rem), (max-width: 1200px) 31vw, 360px"
      />
    </span>
  );
}
