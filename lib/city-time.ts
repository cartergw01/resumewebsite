// The Work island's Taipei can be seen by night (the site's default) or on a
// clear afternoon. The choice is a per-visitor convenience: it lives on the
// root element for styling and in localStorage between visits.
export type CityTime = "night" | "day";
const KEY = "carter-city-time";
export const CITY_TIME_EVENT = "citytimechange";
// Someone is reaching for the day/night switch: time to fetch the day still.
export const CITY_DAY_INTENT = "citydayintent";
// A quick, direct crossfade between the two renders; no sunrise or sunset.
// LivingIsland.module.css matches it for the stills.
export const CITY_TIME_DURATION = 600;

export function currentCityTime(): CityTime {
  return typeof document !== "undefined" && document.documentElement.dataset.cityTime === "day" ? "day" : "night";
}

export function storedCityTime(): CityTime {
  try { return localStorage.getItem(KEY) === "day" ? "day" : "night"; } catch { return "night"; }
}

export function setCityTime(time: CityTime, remember = true) {
  if (time === "day") document.documentElement.dataset.cityTime = "day";
  else delete document.documentElement.dataset.cityTime;
  if (remember) { try { localStorage.setItem(KEY, time); } catch { /* Private mode keeps the session choice only. */ } }
  window.dispatchEvent(new CustomEvent<CityTime>(CITY_TIME_EVENT, { detail: time }));
}

// The daytime still is only mounted on intent, so switching waits (briefly)
// for it to decode; the crossfade then never shows an empty island.
export async function dayStillReady(timeout = 2500) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const image = document.querySelector<HTMLImageElement>('img[data-city-time="day"]');
    if (image) {
      try { await Promise.race([image.decode(), new Promise(resolve => setTimeout(resolve, timeout))]); } catch { /* Fall through to the switch. */ }
      return;
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}
