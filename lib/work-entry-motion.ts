// A little time for the window to respond, then one continuous approach.
// Zero velocity and acceleration at both ends keep the handoff from jolting.
export function workApproach(progress: number) {
  const t = Math.max(0, Math.min(1, (progress - .025) / .975));
  return t * t * t * (10 + t * (-15 + 6 * t));
}

// Square up while the window is still small, before the page becomes readable.
// Both camera paths start on the island's exact view and finish head-on.
export function workAlignment(progress: number) {
  const t = Math.max(0, Math.min(1, (progress - .025) / .455));
  return t * t * (3 - 2 * t);
}
