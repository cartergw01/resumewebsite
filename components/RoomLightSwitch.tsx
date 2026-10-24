"use client";

import { useEffect, useRef, useState } from "react";
import { darkStillReady, lightsOn, ROOM_LIGHTS_EVENT, ROOM_LIGHTS_INTENT, setLights, storedLightsOn, type RoomWorld } from "@/lib/room-lights";
import { PullChain, useChainSway, usePullChain } from "./PullChain";
import styles from "./IslandHome.module.css";

// A pull chain hanging from each room's island. Its bead glows with the
// room's remembered lights, which change fixture by fixture
// (lib/light-switch.ts).
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
    if (pending) return;
    if (!on) { setLights(world, true); return; }
    intent();
    setPending(true);
    await darkStillReady(world);
    setPending(false);
    setLights(world, false);
  };
  const pull = usePullChain(() => void toggle());
  useChainSway(buttonRef);
  const room = world === "writing" ? "study" : "workshop";
  return (
    <button
      ref={buttonRef}
      type="button"
      role="switch"
      className={styles.islandToggle}
      data-room-lights-switch={world}
      data-lights={on ? "on" : "off"}
      aria-checked={on}
      aria-label={`${room} lights`}
      title={`Turn the ${room} lights ${on ? "off" : "on"}`}
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
      <PullChain action={on ? "lights off" : "lights on"} />
    </button>
  );
}
