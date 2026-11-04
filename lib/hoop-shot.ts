import data from "./hoop-shot.json";
import cameras from "./island-cameras.json";

// The workshop basketball's shot, in the Blender scene's own coordinates (Z up,
// about a metre to the unit), so perspective and timing come from the real
// distances: a high arc through the rim, the net catching it, a few bounces,
// and a roll back to the exact spot and pose the still shows it in.
const { world } = data;
const GRAVITY = 10.5;
const WINDUP = .09;
const APEX_ABOVE_RIM = 1.3;
const NET_DRAG = 7;
const BOUNCE = .66;
const LAST_BOUNCE_SPEED = .85;
const ROLL = 1.05;
const FLIGHT_SPIN = 11;
export const NET_SETTLE = 1.05;

type Vec3 = number[];
const [restX, restY, restZ] = world.ball;
const [rimX, rimY, rimZ] = world.rim;
const R = world.ballRadius;
const FLOOR_Z = world.floor + R;
const NET_BOTTOM = rimZ - world.netDepth;
const CLEAR_OF_NET = NET_BOTTOM - R * .45;

const apex = rimZ + APEX_ABOVE_RIM;
const launch = Math.sqrt(2 * GRAVITY * (apex - restZ));
const entry = Math.sqrt(2 * GRAVITY * (apex - rimZ));
const FLIGHT = launch / GRAVITY + entry / GRAVITY;

// Through the net, the cords slow the ball: v' = g - k v.
const terminal = GRAVITY / NET_DRAG;
const netFall = (t: number) => terminal * t + (entry - terminal) / NET_DRAG * (1 - Math.exp(-NET_DRAG * t));
const netSpeed = (t: number) => terminal + (entry - terminal) * Math.exp(-NET_DRAG * t);
const NET_TIME = (() => {
  let low = 0, high = 2;
  for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (netFall(mid) < rimZ - CLEAR_OF_NET) low = mid; else high = mid; }
  return high;
})();
const exitSpeed = netSpeed(NET_TIME);

// Times of each floor contact after leaving the net, and the rebound speeds.
const firstDrop = (-exitSpeed + Math.sqrt(exitSpeed ** 2 + 2 * GRAVITY * (CLEAR_OF_NET - FLOOR_Z))) / GRAVITY;
const bounces: { at: number; speed: number }[] = [];
let bouncing = firstDrop;
for (let speed = (exitSpeed + GRAVITY * firstDrop) * BOUNCE; speed > LAST_BOUNCE_SPEED; speed *= BOUNCE) {
  bounces.push({ at: bouncing, speed });
  bouncing += 2 * speed / GRAVITY;
}
const BOUNCING = bouncing;

const towardHome = Math.hypot(restX - rimX, restY - rimY);
const rollSpeed = towardHome / (BOUNCING + ROLL / 2);

export const ENTERS_RIM = WINDUP + FLIGHT - R / entry;
export const THROUGH_RIM = WINDUP + FLIGHT;
export const LEAVES_NET = THROUGH_RIM + NET_TIME;
export const SHOT_DURATION = LEAVES_NET + BOUNCING + ROLL;

// Distance still to roll home, t seconds after leaving the net.
const remaining = (t: number) => {
  if (t <= 0) return towardHome;
  if (t < BOUNCING) return towardHome - rollSpeed * t;
  const left = Math.max(0, BOUNCING + ROLL - t);
  return rollSpeed / (2 * ROLL) * left * left;
};
// One steady backspin in the air, turning the same way it will roll home, and
// timed so rolling home lands exactly on the still's own pose.
const spinAtExit = -towardHome / R;
const spinning = LEAVES_NET - WINDUP;
const flightTurns = Math.round((FLIGHT_SPIN * spinning - spinAtExit) / (Math.PI * 2));
const flightSpin = (spinAtExit + flightTurns * Math.PI * 2) / spinning;

export type BallPose = { x: number; y: number; z: number; spin: number; squash: number };

export function shotAt(time: number): BallPose {
  if (time <= WINDUP) {
    const press = Math.sin(Math.PI * Math.max(0, time) / WINDUP);
    return { x: restX, y: restY, z: restZ, spin: 0, squash: press * .055 };
  }
  if (time < LEAVES_NET) {
    const spin = (time - WINDUP) * flightSpin;
    if (time < THROUGH_RIM) {
      const t = time - WINDUP, along = t / FLIGHT;
      return { x: restX + (rimX - restX) * along, y: restY + (rimY - restY) * along, z: restZ + launch * t - GRAVITY * t * t / 2, spin, squash: 0 };
    }
    return { x: rimX, y: rimY, z: rimZ - netFall(time - THROUGH_RIM), spin, squash: 0 };
  }
  const t = time - LEAVES_NET;
  const left = remaining(t);
  const home = 1 - left / towardHome;
  const spin = -left / R;
  const x = rimX + (restX - rimX) * home, y = rimY + (restY - rimY) * home;
  if (t < firstDrop) return { x, y, z: CLEAR_OF_NET - exitSpeed * t - GRAVITY * t * t / 2, spin, squash: 0 };
  let z = FLOOR_Z, squash = 0;
  for (const bounce of bounces) {
    const since = t - bounce.at;
    if (since < 0 || since > 2 * bounce.speed / GRAVITY) continue;
    z = FLOOR_Z + bounce.speed * since - GRAVITY * since * since / 2;
    // A beat of give against the floor, in proportion to how hard it landed.
    squash = since < .05 ? Math.min(.05, bounce.speed * .012) * (1 - since / .05) : 0;
    break;
  }
  return { x, y, z, spin, squash };
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
export function project(point: Vec3) {
  const v = [point[0] - camera.position[0], point[2] - camera.position[1], -point[1] - camera.position[2]];
  const dot = (a: number[]) => v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
  const depth = dot(camera.direction);
  const px = (dot(right) / (depth * tangent * 1.5) + 1) / 2 * 1200;
  const py = (1 - dot(camera.up) / (depth * tangent)) / 2 * 800;
  return { x: (px - crop[0]) / crop[2] * 1200, y: (py - crop[1]) / crop[3] * 800, depth };
}

// Where the floodlight throws the ball's shadow on the court, and how strong.
const LIGHT = [rimX, rimY + .04, rimZ + .93];
export function shadowOf(pose: BallPose) {
  const height = pose.z - FLOOR_Z;
  const reach = (LIGHT[2] - world.floor) / Math.max(.4, LIGHT[2] - pose.z);
  const fade = Math.max(0, 1 - height / 1.7);
  return {
    x: LIGHT[0] + (pose.x - LIGHT[0]) * reach, y: LIGHT[1] + (pose.y - LIGHT[1]) * reach, z: world.floor,
    strength: fade * fade, spread: 1 + height * .55,
  };
}

// How far the ball is from its resting place, in the scene's units.
export const fromRest = (pose: BallPose) => Math.hypot(pose.x - restX, pose.y - restY, pose.z - restZ);

const NET_ROWS = [[0, .273], [.075, .265], [.18, .225], [.29, .18], [.416, .175]];
const netRadius = (below: number) => {
  for (let i = 1; i < NET_ROWS.length; i++) if (below <= NET_ROWS[i][0]) {
    const [a, ra] = NET_ROWS[i - 1], [b, rb] = NET_ROWS[i];
    return ra + (rb - ra) * Math.max(0, below - a) / (b - a);
  }
  return NET_ROWS[NET_ROWS.length - 1][1];
};

// The net at a time, and at a fraction `u` of the way down it: how much wider
// than rest (the ball pushing out through it, then the cords ringing), how far
// it hangs (pulled down with the ball, then snapping back up), and how far the
// tail whips sideways.
export function netAt(time: number, u: number, ballZ: number) {
  const since = time - LEAVES_NET;
  const inNet = Math.max(0, Math.min(1, (time - ENTERS_RIM) / (LEAVES_NET - ENTERS_RIM)));
  let widen = 1, hang = 1 + .13 * inNet * inNet * (3 - 2 * inNet), whip = 0;
  if (time < LEAVES_NET + .05) {
    const below = u * world.netDepth;
    const across = Math.sqrt(Math.max(0, R * R - (rimZ - below - ballZ) ** 2)) + .006;
    widen = Math.max(1, across / netRadius(below));
  }
  if (since > 0) {
    const ring = Math.exp(-since / .24);
    widen += .15 * u * Math.exp(-since / .16) * Math.cos(since * 21);
    hang = 1 + .16 * ring * Math.cos(since * 15.5);
    whip = u * u * 3.2 * Math.exp(-since / .3) * Math.sin(since * 14);
  }
  return { widen, hang, whip };
}

export const hoopShot = data;
