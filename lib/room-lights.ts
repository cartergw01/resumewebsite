// The study (Writing) and the workshop (Projects) each have a light switch:
// their lamps, bulbs and festoons on (the default) or off, leaving the room
// moonlit. Like Taipei's time of day (lib/city-time.ts) it's a per-visitor
// convenience: on the root element for styling, in localStorage between visits.
export type RoomWorld = "writing" | "projects";
export const ROOM_LIGHTS_EVENT = "roomlightschange";
// Someone is reaching for a switch: time to fetch that room's lights-off still.
export const ROOM_LIGHTS_INTENT = "roomlightsintent";
// The same quick crossfade as Taipei's day and night.
export const ROOM_LIGHTS_DURATION = 600;

const key = (world: RoomWorld) => `carter-lights-${world}`;
const attribute = (world: RoomWorld) => world === "writing" ? "writingLights" : "projectsLights";

export function lightsOn(world: RoomWorld) {
  return typeof document === "undefined" || document.documentElement.dataset[attribute(world)] !== "off";
}

export function storedLightsOn(world: RoomWorld) {
  try { return localStorage.getItem(key(world)) !== "off"; } catch { return true; }
}

export function setLights(world: RoomWorld, on: boolean, remember = true) {
  if (on) delete document.documentElement.dataset[attribute(world)];
  else document.documentElement.dataset[attribute(world)] = "off";
  if (remember) { try { localStorage.setItem(key(world), on ? "on" : "off"); } catch { /* Private mode keeps the session choice only. */ } }
  window.dispatchEvent(new CustomEvent<{ world: RoomWorld; on: boolean }>(ROOM_LIGHTS_EVENT, { detail: { world, on } }));
}

// The lights-off still is only mounted on intent, so switching waits (briefly)
// for it to decode; the crossfade then never shows an empty island.
export async function darkStillReady(world: RoomWorld, timeout = 2500) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const image = document.querySelector<HTMLImageElement>(`img[data-lights-off="${world}"]`);
    if (image) {
      try { await Promise.race([image.decode(), new Promise(resolve => setTimeout(resolve, timeout))]); } catch { /* Fall through to the switch. */ }
      return;
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}
