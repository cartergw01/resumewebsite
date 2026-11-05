// The attributes let the tests load this file directly in Node.
import data from "./hoop-shot.json" with { type: "json" };
import cameras from "./island-cameras.json" with { type: "json" };

// The workshop basketball's shots, in the Blender scene's own coordinates (Z
// up, about a metre to the unit), so perspective comes from the real distances.
// From anywhere on the court it goes up in an arc that always drops through the
// rim, the net catches it, and it bounces out to rest on a new spot. Gravity is
// well over the real figure: at this scale, real time reads as slow motion.
const { world } = data;
const GRAVITY = 19;
const NET_DRAG = 7;
const BOUNCE = .58;
const LAST_BOUNCE_SPEED = 1.5;
const ROLL = .38;
const AIR_SPIN = 13;
export const NET_SETTLE = .75;

const [restX, restY, restZ] = world.ball;
const [rimX, rimY, rimZ] = world.rim;
const R = world.ballRadius;
const FLOOR_Z = world.floor + R;
const NET_BOTTOM = rimZ - world.netDepth;
const CLEAR_OF_NET = NET_BOTTOM - R * .45;
const TURN = Math.PI * 2;
const FRAME = TURN / data.frames;

// Where the ball may come to rest: on the boards, clear of the lines round the
// edge, and not so close under the hoop that it couldn't arc up into it.
const [courtLeft, courtRight, courtNear] = world.court;
const COURT = { left: courtLeft + .45, right: courtRight - .45, near: courtNear + .45, far: rimY - .79 };
const FROM_RIM = 1;
export const SHOOTS_FROM = .8;

export type Ball = { x: number; y: number; z: number; spin: number };
export type BallPose = Ball & { squash: number };
export const REST: Ball = { x: restX, y: restY, z: restZ, spin: 0 };

export const distanceFromRim = ({ x, y }: { x: number; y: number }) => Math.hypot(x - rimX, y - rimY);
// With its top still above the net's bottom edge, the ball is inside the net.
export const insideNet = (pose: Ball) => pose.z + R > NET_BOTTOM;

export function chooseLanding(from: { x: number; y: number }, random = Math.random) {
  let spot = { x: COURT.left, y: COURT.near };
  for (let tries = 0; tries < 24; tries++) {
    spot = { x: COURT.left + (COURT.right - COURT.left) * random(), y: COURT.near + (COURT.far - COURT.near) * random() };
    // A clear move each time: it shouldn't look as if it barely went anywhere.
    if (distanceFromRim(spot) >= FROM_RIM && Math.hypot(spot.x - from.x, spot.y - from.y) >= 1.1) break;
  }
  return spot;
}

export type Shot = ReturnType<typeof planShot>;

export function planShot(from: Ball, landing: { x: number; y: number }) {
  // Farther shots go higher, as a real shooter's do.
  const above = .75 + .18 * distanceFromRim(from);
  const launch = Math.sqrt(2 * GRAVITY * (rimZ + above - from.z));
  const entry = Math.sqrt(2 * GRAVITY * above);
  const flight = (launch + entry) / GRAVITY;

  // Through the net, the cords slow the ball: v' = g - k v.
  const terminal = GRAVITY / NET_DRAG;
  const netFall = (t: number) => terminal * t + (entry - terminal) / NET_DRAG * (1 - Math.exp(-NET_DRAG * t));
  let low = 0, high = 2;
  for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (netFall(mid) < rimZ - CLEAR_OF_NET) low = mid; else high = mid; }
  const inNet = high;
  const exitSpeed = terminal + (entry - terminal) * Math.exp(-NET_DRAG * inNet);
  const leaves = flight + inNet;

  // Each floor contact after leaving the net, and the rebound from it.
  const firstDrop = (-exitSpeed + Math.sqrt(exitSpeed ** 2 + 2 * GRAVITY * (CLEAR_OF_NET - FLOOR_Z))) / GRAVITY;
  const bounces: { at: number; speed: number }[] = [];
  let bouncing = firstDrop;
  for (let speed = (exitSpeed + GRAVITY * firstDrop) * BOUNCE; speed > LAST_BOUNCE_SPEED; speed *= BOUNCE) {
    bounces.push({ at: bouncing, speed });
    bouncing += 2 * speed / GRAVITY;
  }

  // A steady carry across the court through the bounces, then a short roll out.
  const out = Math.max(.001, distanceFromRim(landing));
  const carry = out / (bouncing + ROLL / 2);
  const left = (t: number) => {
    if (t <= 0) return out;
    if (t < bouncing) return out - carry * t;
    const rolling = Math.max(0, bouncing + ROLL - t);
    return carry / (2 * ROLL) * rolling * rolling;
  };
  // Backspin in the air; then it turns about as far as it travels, and stops
  // square on one of its rendered frames.
  const atExit = from.spin + AIR_SPIN * leaves;
  const way = (landing.x - rimX) * (restX - rimX) + (landing.y - rimY) * (restY - rimY) < 0 ? -1 : 1;
  // It settles with the Wilson logo in view (near the still's own frame, 0).
  const logoTurn = Math.round((atExit + way * out / R) / TURN) * TURN;
  const final = logoTurn + (Math.round(landing.x * 37 + landing.y * 53) % 5 - 2) * FRAME;

  const pose = (time: number): BallPose => {
    if (time <= 0) return { ...from, squash: 0 };
    if (time < flight) {
      const along = time / flight;
      return {
        x: from.x + (rimX - from.x) * along, y: from.y + (rimY - from.y) * along,
        z: from.z + launch * time - GRAVITY * time * time / 2, spin: from.spin + AIR_SPIN * time, squash: 0,
      };
    }
    if (time < leaves) return { x: rimX, y: rimY, z: rimZ - netFall(time - flight), spin: from.spin + AIR_SPIN * time, squash: 0 };
    const t = time - leaves;
    const rest = left(t) / out;
    const x = landing.x + (rimX - landing.x) * rest, y = landing.y + (rimY - landing.y) * rest;
    const spin = atExit + (final - atExit) * (1 - rest);
    if (t < firstDrop) return { x, y, z: CLEAR_OF_NET - exitSpeed * t - GRAVITY * t * t / 2, spin, squash: 0 };
    let z = FLOOR_Z, squash = 0;
    for (const bounce of bounces) {
      const since = t - bounce.at;
      if (since < 0 || since > 2 * bounce.speed / GRAVITY) continue;
      z = FLOOR_Z + bounce.speed * since - GRAVITY * since * since / 2;
      // A beat of give against the floor, in proportion to how hard it landed.
      squash = since < .035 ? Math.min(.05, bounce.speed * .012) * (1 - since / .035) : 0;
      break;
    }
    return { x, y, z, spin, squash };
  };
  return {
    pose, final: { x: landing.x, y: landing.y, z: FLOOR_Z, spin: final } as Ball,
    entersRim: flight - R / entry, throughRim: flight, leavesNet: leaves, duration: leaves + bouncing + ROLL,
  };
}

// Blender's Z-up scene to the still's 1200×800 coordinates (in the same way as
// scripts/blender/export_workshop_objects.py), with the distance from camera.
const { camera, crop } = cameras.projects;
const right = [
  camera.direction[1] * camera.up[2] - camera.direction[2] * camera.up[1],
  camera.direction[2] * camera.up[0] - camera.direction[0] * camera.up[2],
  camera.direction[0] * camera.up[1] - camera.direction[1] * camera.up[0],
];
const tangent = Math.tan(camera.fov * Math.PI / 360);
export function project(point: number[]) {
  const v = [point[0] - camera.position[0], point[2] - camera.position[1], -point[1] - camera.position[2]];
  const dot = (a: number[]) => v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
  const depth = dot(camera.direction);
  const px = (dot(right) / (depth * tangent * 1.5) + 1) / 2 * 1200;
  const py = (1 - dot(camera.up) / (depth * tangent)) / 2 * 800;
  return { x: (px - crop[0]) / crop[2] * 1200, y: (py - crop[1]) / crop[3] * 800, depth };
}

// The ball's shadow on the court: touching it on the floor, and thrown away from
// the floodlight, fainter and wider, as it rises.
const LIGHT = [rimX, rimY + .04, rimZ + .93];
export function shadowOf(pose: Ball) {
  const height = Math.max(0, pose.z - FLOOR_Z);
  const thrown = (z: number) => (LIGHT[2] - world.floor) / Math.max(.4, LIGHT[2] - z);
  const reach = thrown(pose.z) - thrown(FLOOR_Z);
  const fade = Math.max(0, 1 - height / 1.7);
  return {
    point: [pose.x + (pose.x - LIGHT[0]) * reach, pose.y + (pose.y - LIGHT[1]) * reach, world.floor],
    strength: fade * fade, spread: 1 + height * .55,
  };
}

const NET_ROWS = [[0, .273], [.075, .265], [.18, .225], [.29, .18], [.416, .175]];
const netRadius = (below: number) => {
  for (let i = 1; i < NET_ROWS.length; i++) if (below <= NET_ROWS[i][0]) {
    const [a, ra] = NET_ROWS[i - 1], [b, rb] = NET_ROWS[i];
    return ra + (rb - ra) * Math.max(0, below - a) / (b - a);
  }
  return NET_ROWS[NET_ROWS.length - 1][1];
};

// The net at a fraction `u` of the way down it: how much wider than rest (the
// ball pushing out through it, then the cords ringing), how far it hangs (pulled
// down with the ball, then snapping back up), and how far its tail whips aside.
// `through` runs 0 to 1 as the ball passes; `since` is the time since it left.
export function netAt(u: number, through: number, since: number, ballZ: number) {
  let widen = 1, hang = 1 + .13 * through * through * (3 - 2 * through), whip = 0;
  if (since < .03) {
    const below = u * world.netDepth;
    const across = Math.sqrt(Math.max(0, R * R - (rimZ - below - ballZ) ** 2)) + .006;
    widen = Math.max(1, across / netRadius(below));
  }
  if (since > 0) {
    const ring = Math.exp(-since / .17);
    widen += .15 * u * Math.exp(-since / .12) * Math.cos(since * 28);
    hang = 1 + .16 * ring * Math.cos(since * 21);
    whip = u * u * 3.2 * Math.exp(-since / .21) * Math.sin(since * 19);
  }
  return { widen, hang, whip };
}

export const hoopShot = data;
