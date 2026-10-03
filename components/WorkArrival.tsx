"use client";

import { useEffect, useRef } from "react";
import { arriveAtWork } from "@/lib/work-entry";
import TaipeiMark from "./TaipeiMark";
import styles from "./WorkEntry.module.css";

export default function WorkArrival() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const content = ref.current?.closest<HTMLElement>("[data-work-arrival]");
    const light = ref.current?.querySelector<SVGCircleElement>("[data-work-spark-target]");
    if (content && light) arriveAtWork(light, content);
  }, []);
  return <span ref={ref} className={styles.placeHost}><TaipeiMark /></span>;
}
