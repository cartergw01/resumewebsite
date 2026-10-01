"use client";

import { useLayoutEffect, useRef } from "react";
import { arriveAtBook } from "@/lib/workshop-entry";

export default function WritingHeading({ className }: { className?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (heading.current) arriveAtBook(heading.current);
  }, []);

  return <h1 ref={heading} tabIndex={-1} className={className}>Writing</h1>;
}
