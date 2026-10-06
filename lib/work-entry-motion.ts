// The camera responds at once and keeps moving: a cubic ease-in-out that
// leaves the start sooner than a quintic, still with zero velocity at both
// ends so the hand-off doesn't jolt.
export function workApproach(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// The lens widens as the camera rushes the last stretch to the window, a
// dolly-zoom that sells the speed; the fly-through solves its final distance
// for this wider lens, so the window still fills the view on arrival.
export const WORK_LENS_WIDEN = 1.3;
export function workLens(progress: number) {
  const t = Math.max(0, Math.min(1, (progress - .3) / .7));
  return 1 + (WORK_LENS_WIDEN - 1) * t * t * (3 - 2 * t);
}

// Square up while the window is still small, before the page becomes readable.
// Both camera paths start on the island's exact view and finish head-on.
export function workAlignment(progress: number) {
  const t = Math.max(0, Math.min(1, progress / .45));
  return t * t * (3 - 2 * t);
}
