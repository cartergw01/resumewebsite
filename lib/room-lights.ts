// The study (Writing) and the workshop (Projects) each have a light switch:
// their lamps, bulbs and festoons on (the default) or off, leaving the room
// moonlit. Like Taipei's time of day (lib/city-time.ts) it's a per-visitor
// convenience: on the root element for styling, in localStorage between visits.
// A flip plays out fixture by fixture (lib/light-switch.ts).
import { recordFlip } from "./light-switch";

export type RoomWorld = "writing" | "projects";
export const ROOM_LIGHTS_EVENT = "roomlightschange";
// Someone is reaching for a switch: time to fetch that room's lights-off still.
export const ROOM_LIGHTS_INTENT = "roomlightsintent";

const key = (world: RoomWorld) => `carter-lights-${world}`;
const attribute = (world: RoomWorld) => world === "writing" ? "writingLights" : "projectsLights";

export function lightsOn(world: RoomWorld) {
  return typeof document === "undefined" || document.documentElement.dataset[attribute(world)] !== "off";
}

export function storedLightsOn(world: RoomWorld) {
  try { return localStorage.getItem(key(world)) !== "off"; } catch { return true; }
}

// remember is false when restoring the last visit's choice, which is instant.
export function setLights(world: RoomWorld, on: boolean, remember = true) {
  if (remember && on !== lightsOn(world)) recordFlip(world, on);
  if (on) delete document.documentElement.dataset[attribute(world)];
  else document.documentElement.dataset[attribute(world)] = "off";
  if (remember) { try { localStorage.setItem(key(world), on ? "on" : "off"); } catch { /* Private mode keeps the session choice only. */ } }
  window.dispatchEvent(new CustomEvent<{ world: RoomWorld; on: boolean }>(ROOM_LIGHTS_EVENT, { detail: { world, on } }));
}

// The lights-off still is only mounted on intent, so switching waits (briefly)
// for it to decode, and for the canvas that stages the switch to have it; the
// switch then never shows an empty island or skips its first fixtures.
export async function darkStillReady(world: RoomWorld, timeout = 2500) {
  const started = performance.now();
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  while (performance.now() - started < timeout) {
    const image = document.querySelector<HTMLImageElement>(`img[data-lights-off="${world}"]`);
    if (image) {
      try { await Promise.race([image.decode(), new Promise(resolve => setTimeout(resolve, timeout))]); } catch { /* Fall through to the switch. */ }
      while (image.closest<HTMLElement>("[data-island-visual]")?.dataset.lightsGl === "loading" && performance.now() - started < timeout) await frame();
      return;
    }
    await frame();
  }
}
