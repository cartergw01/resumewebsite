// All three worlds share one pace, from the first approach to the final reveal.
// Keep the lift inside the approach and the card stagger inside the arrival,
// so neither adds time to its world's journey. Each entry is a small
// journey in four beats (answer, approach, threshold, arrival; see
// lib/entry-light.ts). Brisk: every beat still plays, but the whole journey
// is under two seconds, so entering feels snappy every time, not only the
// first. A second tap plays the rest at 4x.
export const ISLAND_ENTRY_DURATION = 1900;
export const ENTRY_ARRIVAL_DURATION = 550;
export const ENTRY_APPROACH_DURATION = ISLAND_ENTRY_DURATION - ENTRY_ARRIVAL_DURATION;
export const ENTRY_LIFT_DELAY = ENTRY_APPROACH_DURATION * .1;
export const ENTRY_LIFT_DURATION = ENTRY_APPROACH_DURATION - ENTRY_LIFT_DELAY;
export const ENTRY_HANDOFF_DURATION = ENTRY_ARRIVAL_DURATION * .2;
export const ENTRY_STAGGER_DURATION = ENTRY_ARRIVAL_DURATION * .2;
// Phones play the whole journey a little faster still (about 1.4s, Writing's
// notebook included): a phone is held for quick looks. Every animation the
// entry runs, including the ones it starts later, plays at this rate
// (components/IslandLink.tsx).
export const PHONE_ENTRY_PACE = 1.4;
export const entryPace = () => matchMedia("(max-width: 760px)").matches ? PHONE_ENTRY_PACE : 1;
