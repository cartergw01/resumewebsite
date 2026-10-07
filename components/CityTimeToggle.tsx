"use client";

import { useEffect, useState } from "react";
import { CITY_TIME_EVENT, currentCityTime, setCityTime, storedCityTime, type CityTime } from "@/lib/city-time";
import styles from "./IslandHome.module.css";

// A small sun/moon switch beside Taipei: crossfades the city between night
// and a clear afternoon, and remembers the choice.
export default function CityTimeToggle() {
  const [time, setTime] = useState<CityTime>("night");
  useEffect(() => {
    const stored = storedCityTime();
    if (stored !== currentCityTime()) setCityTime(stored, false);
    setTime(currentCityTime());
    const sync = () => setTime(currentCityTime());
    window.addEventListener(CITY_TIME_EVENT, sync);
    return () => window.removeEventListener(CITY_TIME_EVENT, sync);
  }, []);
  const day = time === "day";
  return (
    <button
      type="button"
      className={styles.cityTime}
      data-city-time-toggle
      data-time={time}
      aria-pressed={day}
      aria-label={day ? "Show Taipei at night" : "Show Taipei in the day"}
      onClick={() => setCityTime(day ? "night" : "day")}
    >
      <span className={styles.cityTimeKnob} aria-hidden="true" />
      <svg className={styles.cityTimeMoon} viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 2.2a5.8 5.8 0 1 0 3.2 9.6A6.4 6.4 0 0 1 10.6 2.2Z" /></svg>
      <svg className={styles.cityTimeSun} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1" />
      </svg>
    </button>
  );
}
