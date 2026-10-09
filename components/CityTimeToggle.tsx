"use client";

import { useEffect, useState } from "react";
import { CITY_DAY_INTENT, CITY_TIME_EVENT, currentCityTime, dayStillReady, setCityTime, storedCityTime, type CityTime } from "@/lib/city-time";
import styles from "./IslandHome.module.css";

// One small button beside Taipei that offers the other time of day: a sun
// at night, a moon by day. The city crossfades and the choice is remembered.
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
  const [pending, setPending] = useState(false);
  const intent = () => window.dispatchEvent(new Event(CITY_DAY_INTENT));
  const toggle = async () => {
    if (day) { setCityTime("night"); return; }
    intent();
    setPending(true);
    await dayStillReady();
    setPending(false);
    setCityTime("day");
  };
  return (
    <button
      type="button"
      className={styles.cityTime}
      data-reads="cue-opacity:opacity"
      data-city-time-toggle
      data-time={time}
      aria-label={day ? "Show Taipei at night" : "Show Taipei in the day"}
      title={day ? "Night" : "Day"}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      onPointerEnter={intent}
      onPointerDown={intent}
      onFocus={intent}
      onClick={() => void toggle()}
    >
      <svg className={styles.cityTimeSun} viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="3.6" />
        <path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2M4.2 4.2l1.6 1.6M14.2 14.2l1.6 1.6M4.2 15.8l1.6-1.6M14.2 5.8l1.6-1.6" />
      </svg>
      <svg className={styles.cityTimeMoon} viewBox="0 0 20 20" aria-hidden="true">
        <path d="M13.4 2.6a7.4 7.4 0 1 0 4.1 12.2A8 8 0 0 1 13.4 2.6Z" />
      </svg>
    </button>
  );
}
