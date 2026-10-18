// One flip of a room's switch, played out fixture by fixture: each light
// source comes on (or goes off) in its own way, as real ones do. The Arundel
// lamp's bulb warms up, the sconce's LEDs snap, the shelf strips run along
// their length, the lava lamp glows in last. Off is near-instant, as real
// lights are, and then the spotlight finds the room's subject.
//
// Blender renders each source's share of the light at every pixel
// (build_islands.py light_masks); ParallaxStill eases each pixel between the
// lights-on and lights-off stills at the pace of the sources lighting it, and
// the live details (IslandLife) follow the same levels.
import type { RoomWorld } from "./room-lights";

// delay and duration in ms; sweep is how long the light takes to run across
// the source's extent (strips and festoons), left to right coming on.
export type Phase = { delay: number; duration: number; sweep?: number };
type Timing = { on: Phase; off: Phase };

// Levels are 1 when the source looks as in the lights-on still. The spot is
// the lights-off spotlight, so its level falls as it comes up.
const LAMP: Timing = { on: { delay: 60, duration: 380 }, off: { delay: 0, duration: 120 } };
const SNAP: Timing = { on: { delay: 30, duration: 70 }, off: { delay: 0, duration: 60 } };
const STRIP: Timing = { on: { delay: 120, duration: 120, sweep: 160 }, off: { delay: 0, duration: 70, sweep: 60 } };
const GLOW: Timing = { on: { delay: 160, duration: 360 }, off: { delay: 0, duration: 150 } };
// The lava lamp glows in last, but quickly enough to read as part of the flip.
const LAVA: Timing = { on: { delay: 180, duration: 340 }, off: { delay: 0, duration: 140 } };
export const TIMINGS: Record<string, Timing> = {
  lamp: LAMP,
  sconce: SNAP, luca: SNAP, task: SNAP,
  shelves: STRIP, purple: STRIP, gold: { on: { ...STRIP.on, delay: 160 }, off: STRIP.off },
  festoon: { on: { delay: 80, duration: 80, sweep: 260 }, off: { delay: 0, duration: 70, sweep: 60 } },
  lava: LAVA, ball: GLOW,
  devices: { on: { delay: 0, duration: 200 }, off: { delay: 0, duration: 120 } },
  spot: { on: { delay: 0, duration: 160 }, off: { delay: 160, duration: 360 } },
};

export const timing = (source: string) => TIMINGS[source] ?? LAMP;

const flips: Partial<Record<RoomWorld, { on: boolean; at: number; from: Record<string, number> }>> = {};

const ease = (t: number) => t * t * (3 - 2 * t);

// How far along its phase a source is at `now`, at `position` (0-1) along its
// extent, coming on left to right and going off right to left.
export function progress(phase: Phase, on: boolean, elapsed: number, position = .5) {
  const along = on ? position : 1 - position;
  const t = (elapsed - phase.delay - along * (phase.sweep ?? 0)) / phase.duration;
  return ease(Math.max(0, Math.min(1, t)));
}

// A source's level (1 lit as in the lights-on still, 0 as in the dark one).
export function level(world: RoomWorld, source: string, on: boolean, now = performance.now(), position = .5) {
  const flip = flips[world];
  if (!flip || flip.on !== on) return on ? 1 : 0;
  const from = flip.from[source] ?? (on ? 0 : 1);
  return from + ((on ? 1 : 0) - from) * progress(timing(source)[on ? "on" : "off"], on, now - flip.at, position);
}

// The switch was flipped: each source starts from wherever it is now, so a
// flip mid-way turns back smoothly.
export function recordFlip(world: RoomWorld, on: boolean, sources: string[] = Object.keys(TIMINGS)) {
  const now = performance.now();
  const from: Record<string, number> = {};
  for (const source of sources) from[source] = level(world, source, !on, now);
  flips[world] = { on, at: now, from };
}

// The flip as the shader needs it: when it happened, and where each source
// started from.
export function flipState(world: RoomWorld) {
  return flips[world];
}

// How long a flip lasts, until its slowest source settles.
export function flipDuration(sources: string[], on: boolean) {
  return Math.max(0, ...sources.map(source => {
    const phase = timing(source)[on ? "on" : "off"];
    return phase.delay + (phase.sweep ?? 0) + phase.duration;
  }));
}
