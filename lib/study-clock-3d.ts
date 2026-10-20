import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry } from "three";
import { CLOCK_HANDS, clockHandPoints, studyTime, type ClockHand } from "./study-clock";

export type StudyClockPosition = { center: number[]; radius: number };

// The hands are separate from the baked island, so a flight never reveals a
// second, fixed set of hands. Basic materials retain their lume in darkness.
export function createStudyClock(position: StudyClockPosition) {
  const group = new Group();
  group.position.fromArray(position.center);
  group.scale.setScalar(position.radius);
  const material = new MeshBasicMaterial({ color: "#d8ffe5", toneMapped: false, side: DoubleSide });
  const hands = (Object.keys(CLOCK_HANDS) as ClockHand[]).map((name, index) => {
    const shape = new Shape(), points = clockHandPoints(name, 0);
    shape.moveTo(...points[0]);
    for (const point of points.slice(1)) shape.lineTo(...point);
    shape.closePath();
    const hand = new Mesh(new ShapeGeometry(shape), material);
    hand.name = `Study clock · ${name} hand`;
    hand.position.z = index * .004;
    group.add(hand);
    return { name, hand };
  });
  const pivot = new Mesh(new CircleGeometry(.038, 24), material);
  pivot.position.z = .016; group.add(pivot);
  let lastSecond = -1;
  const update = (now = Date.now()) => {
    const second = Math.floor(now / 1000);
    if (second === lastSecond) return;
    lastSecond = second;
    const angles = studyTime(new Date(now));
    for (const { name, hand } of hands) hand.rotation.z = -angles[name] * Math.PI / 180;
  };
  update();
  return { group, update };
}
