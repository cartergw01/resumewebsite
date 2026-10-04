"use client";

import { useEffect, useRef } from "react";
import { arriveAtWork } from "@/lib/work-entry";

export default function WorkArrival() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const content = ref.current?.closest<HTMLElement>("[data-work-arrival]");
    if (content) arriveAtWork(content);
  }, []);
  return <span ref={ref} hidden />;
}
