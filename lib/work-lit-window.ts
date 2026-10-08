import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";

// The lit office window on Taipei 101 in the rotatable model, at the exact
// corners projected from the Blender scene.
export function makeLitWindow(corners: Vector3[]) {
  const right = corners[1].clone().sub(corners[0]);
  const up = corners[0].clone().sub(corners[2]);
  const width = right.length(), height = up.length();
  right.normalize(); up.addScaledVector(right, -up.dot(right)).normalize();
  const normal = right.clone().cross(up).normalize();
  const center = corners.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(.25);
  const group = new Group();
  // The facade tapers, so the opening is a trapezoid rather than a flat
  // rectangular decal. Use the exact same corners as the content aperture.
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(corners.flatMap(point => point.toArray()), 3));
  geometry.setIndex([0, 2, 1, 2, 3, 1]);
  // A lamplit pane at night, daylight glass by day (island-orbit blends it):
  // tone mapped like the rest of the city, never a flat unlit flash.
  const glass = new Mesh(geometry, new MeshBasicMaterial({ color: 0xd9a868, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
  group.add(glass);
  const frame = new MeshStandardMaterial({ color: 0x61656a, metalness: .5, roughness: .5 });
  for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) {
    const along = corners[b].clone().sub(corners[a]);
    const bar = new Mesh(new BoxGeometry(along.length() + .0007, .0007, .0014), frame);
    along.normalize();
    bar.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(along, normal.clone().cross(along).normalize(), normal));
    bar.position.copy(corners[a]).add(corners[b]).multiplyScalar(.5);
    group.add(bar);
  }
  return { group, center, normal, up, width, height, corners };
}
