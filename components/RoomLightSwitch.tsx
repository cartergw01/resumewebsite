"use client";

import { useEffect, useRef, useState } from "react";
import { darkStillReady, lightsOn, ROOM_LIGHTS_EVENT, ROOM_LIGHTS_INTENT, setLights, storedLightsOn, type RoomWorld } from "@/lib/room-lights";
import styles from "./IslandHome.module.css";

// A light switch beside the study or the workshop, styled like Taipei's sun
// and moon: its rocker is up while the lights are on. The room
// goes dark fixture by fixture and back (lib/light-switch.ts), and each room
// remembers its own switch.
export default function RoomLightSwitch({ world }: { world: RoomWorld }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const stored = storedLightsOn(world);
    if (stored !== lightsOn(world)) setLights(world, stored, false);
    setOn(lightsOn(world));
    const sync = () => setOn(lightsOn(world));
    window.addEventListener(ROOM_LIGHTS_EVENT, sync);
    return () => window.removeEventListener(ROOM_LIGHTS_EVENT, sync);
  }, [world]);
  const [pending, setPending] = useState(false);
  const intent = () => window.dispatchEvent(new CustomEvent(ROOM_LIGHTS_INTENT, { detail: world }));
  // Someone who settles on the room may well reach for its switch: fetch
  // what the switch needs then, so the first tap on a phone plays at once.
  useEffect(() => {
    const scene = buttonRef.current?.closest<HTMLElement>("[data-island-scene]");
    const stage = buttonRef.current?.closest<HTMLElement>("[data-island-stage]");
    if (!scene || !stage) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = () => scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering && !document.hidden;
    const sync = () => {
      clearTimeout(timer);
      if (connection?.saveData || !settled()) return;
      timer = setTimeout(() => {
        if (!settled()) return;
        window.dispatchEvent(new CustomEvent(ROOM_LIGHTS_INTENT, { detail: world }));
        observer.disconnect();
      }, 1200);
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    sync();
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [world]);
  const toggle = async () => {
    if (!on) { setLights(world, true); return; }
    intent();
    setPending(true);
    await darkStillReady(world);
    setPending(false);
    setLights(world, false);
  };
  const room = world === "writing" ? "study" : "workshop";
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`${styles.cityTime} ${styles.lightSwitch}`}
      data-reads="cue-opacity:opacity"
      data-room-lights-switch={world}
      data-lights={on ? "on" : "off"}
      aria-pressed={on}
      aria-label={on ? `Turn the ${room} lights off` : `Turn the ${room} lights on`}
      title={on ? "Lights off" : "Lights on"}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      onPointerEnter={intent}
      onPointerDown={intent}
      onFocus={intent}
      onClick={() => void toggle()}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect className={styles.lightSwitchPlate} x="5" y="2.5" width="10" height="15" rx="2.2" />
        <rect className={styles.lightSwitchRocker} x="8" y="5.5" width="4" height="9" rx="1.3" />
        <rect className={styles.lightSwitchTab} x="8" y="5.5" width="4" height="4.5" rx="1.3" />
      </svg>
    </button>
  );
}
