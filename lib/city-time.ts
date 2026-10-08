// The Work island's Taipei can be seen by night (the site's default) or on a
// clear afternoon. The choice is a per-visitor convenience: it lives on the
// root element for styling and in localStorage between visits.
export type CityTime = "night" | "day";
const KEY = "carter-city-time";
export const CITY_TIME_EVENT = "citytimechange";
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
