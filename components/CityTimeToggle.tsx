"use client";

import { useEffect, useRef, useState } from "react";
import { CITY_DAY_INTENT, CITY_TIME_EVENT, currentCityTime, dayStillReady, setCityTime, storedCityTime, type CityTime } from "@/lib/city-time";
import { PullChain, useChainSway, usePullChain } from "./PullChain";
import styles from "./IslandHome.module.css";

// The same pull chain as the rooms, controlling Taipei's daylight.
// The city crossfades and the choice is remembered.
export default function CityTimeToggle() {
  const buttonRef = useRef<HTMLButtonElement>(null);
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
    if (pending) return;
    if (day) { setCityTime("night"); return; }
    intent();
    setPending(true);
    await dayStillReady();
    setPending(false);
    setCityTime("day");
  };
  const pull = usePullChain(() => void toggle());
  useChainSway(buttonRef);
  return (
    <button
      ref={buttonRef}
      type="button"
      role="switch"
      className={styles.islandToggle}
      data-city-time-toggle
      data-time={time}
      data-lights={day ? "on" : "off"}
      aria-checked={day}
      aria-label="Taipei daylight"
      title={day ? "Show Taipei at night" : "Show Taipei in the day"}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      data-pending={pending || undefined}
      onPointerEnter={intent}
      onPointerDown={(event) => { intent(); pull.onPointerDown(event); }}
      onPointerMove={pull.onPointerMove}
      onPointerUp={pull.onPointerUp}
      onPointerCancel={pull.onPointerCancel}
      onFocus={intent}
      onClick={pull.onClick}
    >
      <PullChain action={day ? "night" : "day"} />
    </button>
  );
}
