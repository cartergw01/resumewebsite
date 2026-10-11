import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";

// Taipei's traffic in the 3D island views (the rotatable model and the camera
// flights). Each lane is a straight run of road in Three coordinates, written
// by scripts/blender/export_life_anchors.py. Cars are two instanced meshes,
// one draw each: bodies by day, head and tail lights by night. They drive at
// the same pace as the 2D traffic on the still (components/IslandLife.tsx),
// and real depth testing hides them behind buildings.
export type Traffic = { lanes: number[][][] };

const random = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };
const TINTS = [0xecece6, 0xd6dade, 0xeec440, 0xb4bac2];
const CARS_PER_LANE = 6;

export function createTraffic(traffic: Traffic, lit: boolean) {
  const cars = traffic.lanes.flatMap(([a, b], index) => Array.from({ length: CARS_PER_LANE }, (_, k) => ({
    from: new Vector3().fromArray(a), to: new Vector3().fromArray(b),
    // Alternate lanes run the other way, as in the 2D traffic.
    forward: index % 2 === 0,
    start: random(index * 7 + k), speed: .028 + random(index * 3 + k * 11) * .03,
    tint: TINTS[Math.floor(random(index + k * 5) * 4)],
  })));
  // A car is 4.5m long at the scene's 100m-per-unit scale; its lights are a
  // short bright streak at bumper height.
  const bodyGeometry = new BoxGeometry(.045, .017, .018);
  const lightGeometry = new BoxGeometry(.03, .005, .008);
  const bodyMaterial = lit ? new MeshStandardMaterial({ roughness: .5, metalness: .3 }) : new MeshBasicMaterial();
  const lightMaterial = new MeshBasicMaterial({ toneMapped: false });
  const bodies = new InstancedMesh(bodyGeometry, bodyMaterial, cars.length);
  const lights = new InstancedMesh(lightGeometry, lightMaterial, cars.length);
  const color = new Color();
  cars.forEach((car, i) => {
    bodies.setColorAt(i, color.setHex(car.tint));
    lights.setColorAt(i, color.setHex(car.forward ? 0xfff0d6 : 0xff4634).multiplyScalar(2));
  });
  for (const mesh of [bodies, lights]) { mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = lit && mesh === bodies; }
  const group = new Group();
  group.add(bodies, lights);

  const position = new Vector3(), along = new Vector3(), scale = new Vector3(1, 1, 1);
  const turn = new Quaternion(), up = new Vector3(0, 1, 0), matrix = new Matrix4();
  return {
    group,
    // seconds: a running clock; daylight: 0 for night, 1 for day.
    update(seconds: number, daylight: number) {
      const day = daylight >= .5;
      bodies.visible = day;
      lights.visible = !day;
      const shown = day ? bodies : lights;
      cars.forEach((car, i) => {
        const run = (car.start + car.speed * seconds / 2.2) % 1;
        const t = car.forward ? run : 1 - run;
        position.lerpVectors(car.from, car.to, t);
        along.subVectors(car.to, car.from);
        if (!car.forward) along.negate();
        turn.setFromAxisAngle(up, Math.atan2(-along.z, along.x));
        position.y += day ? .0085 : .012;
        shown.setMatrixAt(i, matrix.compose(position, turn, scale));
      });
      shown.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      bodyGeometry.dispose(); lightGeometry.dispose();
      bodyMaterial.dispose(); lightMaterial.dispose();
      bodies.dispose(); lights.dispose();
    },
  };
}
