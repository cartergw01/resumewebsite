"use client";

type Point = { x: number; y: number };

// The perched wing, in the bird's 78x68 art units, written absolutely so a
// flapping wing with the same commands can blend into it on takeoff and landing.
export const FOLDED_WING: readonly number[] = [39, 25, 48, 24, 56, 29, 59, 35, 51, 42, 40, 41, 35, 32];
const FLAPS_PER_SECOND = 5;
const SHOULDER = { x: 42, y: 27 };
const ARM = 12;
const HAND = 15;

const TAU = Math.PI * 2;
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

// One wing at a point in its stroke. The arm follows a sine and the hand follows
// the same sine a little later, so the wingtip trails the arm through each
// reversal, which is what stops the wing reading as a hinged paddle. Width in
// [0, 1] narrows the far wing.
export function wingPose(phase: number, width = 1): number[] {
  const arm = -.3 + .95 * Math.sin(phase);
  const hand = -.2 + 1.05 * Math.sin(phase - .7);
  const wrist = { x: SHOULDER.x + Math.cos(arm) * ARM, y: SHOULDER.y + Math.sin(arm) * ARM };
  const tip = { x: wrist.x + Math.cos(hand) * HAND, y: wrist.y + Math.sin(hand) * HAND };
  // Width is measured across the wing's own axis, so it keeps its shape at
  // every angle instead of collapsing to a sliver as it sweeps past level.
  const length = Math.hypot(tip.x - SHOULDER.x, tip.y - SHOULDER.y) || 1;
  const along = { x: (tip.x - SHOULDER.x) / length, y: (tip.y - SHOULDER.y) / length };
  const across = { x: -along.y, y: along.x };
  const chord = 10 * width;
  // The root pivots with the wing, so its edges never cross on the downstroke.
  const front = { x: SHOULDER.x - across.x * 6, y: SHOULDER.y - across.y * 6 };
  const rear = { x: SHOULDER.x + across.x * 6 * width, y: SHOULDER.y + across.y * 6 * width };
  return [
    front.x, front.y,
    front.x + (wrist.x - front.x) * .75, front.y + (wrist.y - front.y) * .75,
    wrist.x + (tip.x - wrist.x) * .45, wrist.y + (tip.y - wrist.y) * .45,
    tip.x, tip.y,
    tip.x - along.x * length * .2 + across.x * chord * .9, tip.y - along.y * length * .2 + across.y * chord * .9,
    rear.x + (wrist.x - rear.x) * .55 + across.x * chord * .55, rear.y + (wrist.y - rear.y) * .55 + across.y * chord * .55,
    rear.x, rear.y,
  ];
}

export const wingPath = (p: readonly number[]) =>
  `M${p[0]} ${p[1]}C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}C${p[8]} ${p[9]} ${p[10]} ${p[11]} ${p[12]} ${p[13]}Z`;
const blend = (from: readonly number[], to: readonly number[], amount: number) => from.map((value, i) => value + (to[i] - value) * amount);

export type BirdParts = {
  flyer: SVGSVGElement;
  nearWing: SVGPathElement;
  farWing: SVGPathElement;
  legs: SVGPathElement;
};

// Drives one bird between its perch and wherever it is sent. The bird is its own
// small SVG moved by a composited transform, so a frame only redraws the wings.
// The flap phase is integrated rather than derived from time, so changing speed
// never makes the wing jump between frames.
export function createBirdFlight(parts: BirdParts) {
  let at: Point = { x: 0, y: 0 };
  let facing = 1;
  let frame = 0;
  let fallback = 0;
  let finish: (() => void) | null = null;

  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(fallback);
    frame = 0;
    finish = null;
  };
  const wings = (fold: number, phase: number) => {
    parts.nearWing.setAttribute("d", wingPath(blend(wingPose(phase), FOLDED_WING, fold)));
    parts.farWing.setAttribute("d", wingPath(blend(wingPose(phase + .12, .8), FOLDED_WING, fold)));
  };
  const place = (position: Point, heading: number, tilt: number) => {
    const width = Math.abs(heading) < .08 ? (heading < 0 ? -.08 : .08) : heading;
    parts.flyer.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) rotate(${tilt}deg) scaleX(${width})`;
  };

  // `to` is in pixels from the perch. Landing back on the perch restores the art
  // exactly, so nothing the flight wrote is left behind on the resting bird.
  const fly = (to: Point, onArrive?: () => void) => {
    stop();
    const from = at;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const duration = clamp(640 + distance * 1.1, 1000, 1250);
    const arc = Math.min(distance * .2, 90);
    const bob = parts.flyer.clientWidth / 78 * 1.3;
    const startFacing = facing;
    const travel = dx < 0 ? 1 : -1;
    const home = to.x === 0 && to.y === 0;
    const start = performance.now();
    let last = start;
    let phase = 0;
    parts.flyer.style.willChange = "transform";

    const settle = () => {
      stop();
      at = to;
      facing = home ? 1 : travel;
      wings(1, 0);
      parts.flyer.style.willChange = "";
      if (home) {
        parts.flyer.style.transform = "";
        parts.legs.removeAttribute("transform");
      } else {
        place(to, facing, 0);
        parts.legs.removeAttribute("transform");
      }
      onArrive?.();
    };
    finish = settle;

    const step = (now: number) => {
      const elapsed = now - start;
      const t = clamp(elapsed / duration);
      // Faster strokes while climbing out, easing off on the way in.
      phase += TAU * (FLAPS_PER_SECOND + 1.5 * (1 - t)) * Math.max(0, now - last) / 1000;
      last = now;
      const s = easeInOut(t);
      const beat = Math.min(smooth(elapsed / 110), smooth((duration - elapsed) / 130));
      const position = {
        x: from.x + dx * s,
        // The body rises against each downstroke, a touch behind the wing.
        y: from.y + dy * s - arc * (1 - (2 * s - 1) ** 2) - beat * bob * Math.cos(phase - .5),
      };
      // Nose up while climbing, down on the approach, levelling off to land.
      const slope = (dy + 4 * arc * (2 * s - 1)) / Math.max(Math.abs(dx), 1);
      const tilt = clamp(Math.atan(slope) * 180 / Math.PI * .4, -16, 16) * -travel * beat;
      // A home landing turns back to the perched heading just before touching down.
      const heading = t < .22
        ? startFacing + (travel - startFacing) * smooth(t / .22)
        : home && t > .8 ? travel + (1 - travel) * smooth((t - .8) / .2) : travel;
      place(position, heading, tilt);
      wings(1 - beat, phase);
      parts.legs.setAttribute("transform", `translate(0 47) scale(1 ${1 - beat * .7}) translate(0 -47)`);
      at = position;
      if (t >= 1) { settle(); return; }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Reading must never wait on a throttled animation frame.
    fallback = window.setTimeout(() => finish?.(), duration + 250);
  };

  return { fly, dispose: stop };
}
