export const WORK_ENTRY_DURATION = 1100;

// A little time for the window to respond, then one continuous approach.
// Zero velocity and acceleration at both ends keep the handoff from jolting.
export function workApproach(progress: number) {
  const t = Math.max(0, Math.min(1, (progress - .025) / .975));
  return t * t * t * (10 + t * (-15 + 6 * t));
}

// The approach bends while the tower is still in view, then straightens before
// we reach the glass. Both ends are at rest, including after an interrupted orbit.
export function workApproachArc(progress: number) {
  return Math.sin(Math.PI * workApproach(Math.min(1, progress / .82))) ** 2;
}
