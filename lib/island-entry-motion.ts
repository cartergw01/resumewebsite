// All three worlds share one pace, from the first approach to the final reveal.
// Keep the lift inside the approach and the card stagger inside the arrival,
// so neither adds time to its world's journey. Two and a half seconds lets
// each world's entry read as a deliberate move (a ~1s version felt rushed),
// while staying a little brisker than the original 2.8s.
export const ISLAND_ENTRY_DURATION = 2500;
export const ENTRY_ARRIVAL_DURATION = 700;
export const ENTRY_APPROACH_DURATION = ISLAND_ENTRY_DURATION - ENTRY_ARRIVAL_DURATION;
export const ENTRY_LIFT_DELAY = ENTRY_APPROACH_DURATION * .1;
export const ENTRY_LIFT_DURATION = ENTRY_APPROACH_DURATION - ENTRY_LIFT_DELAY;
export const ENTRY_HANDOFF_DURATION = ENTRY_ARRIVAL_DURATION * .2;
export const ENTRY_STAGGER_DURATION = ENTRY_ARRIVAL_DURATION * .2;
