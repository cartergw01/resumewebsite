"use client";

import { useEffect, useState } from "react";
import { darkStillReady, lightsOn, ROOM_LIGHTS_EVENT, ROOM_LIGHTS_INTENT, setLights, storedLightsOn, type RoomWorld } from "@/lib/room-lights";
import styles from "./IslandHome.module.css";

// A light switch beside the study or the workshop, in the same spot and style
// as Taipei's sun and moon: its rocker is up while the lights are on. The room
// crossfades to moonlight and back, and each room remembers its own switch.
export default function RoomLightSwitch({ world }: { world: RoomWorld }) {
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
