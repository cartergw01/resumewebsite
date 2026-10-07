import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer } from "three";
import type { ScreenMatrix, WindowFlight } from "./island-orbit-bridge";
import { workApproach, workAlignment, workLens, WORK_LENS_WIDEN } from "./work-entry-motion";

const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

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

type LitWindow = ReturnType<typeof makeLitWindow>;

export function flyThroughWindow(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, window: LitWindow, host: HTMLElement, matrix: ScreenMatrix, onRelease: () => void): WindowFlight {
  const canvas = renderer.domElement;
  const parent = canvas.parentElement!;
  const oldStyle = canvas.style.cssText;
  const alreadyLive = canvas.dataset.orbitLive === "true";
  const visibility = parent.style.visibility;
  const filter = getComputedStyle(canvas).filter;
  const original = camera.clone();
  const W = innerWidth, H = innerHeight;
  // Embed the existing 3:2 artwork projection into the viewport exactly,
  // including its CSS bank, hover scale and the current orbit angle.
  const placement = new Matrix4().set(
    matrix.a * 1200 / W, -matrix.c * 800 / W, 0, (matrix.e + matrix.a * 600 + matrix.c * 400) * 2 / W - 1,
    -matrix.b * 1200 / H, matrix.d * 800 / H, 0, 1 - (matrix.f + matrix.b * 600 + matrix.d * 400) * 2 / H,
    0, 0, 1, 0,
    0, 0, 0, 1,
  );
  const startProjection = placement.multiply(original.projectionMatrix);
  const lens = new PerspectiveCamera(camera.fov, W / H, .0005, 150);
  const offset = original.position.clone().sub(window.center);
  const startDistance = offset.length();
  const direction = offset.normalize();
  const normal = window.normal.clone();
  if (normal.dot(direction) < 0) normal.negate();
  const heading = new Vector3();
  const tangent = Math.tan(Math.min(150, camera.fov * WORK_LENS_WIDEN) * Math.PI / 360);
  // Finish beyond the frame's visible edges, so the content has already
  // filled the viewport before Next mounts the destination.
  const finishDistance = Math.min(window.height / (2 * tangent), window.width / (2 * tangent * W / H)) * .88;
  const look = new Matrix4(), orientation = new Quaternion();
  let disposed = false;
  host.prepend(canvas);
  canvas.style.cssText = `position:absolute;z-index:0;inset:0;left:0;top:0;width:${W}px;height:${H}px;transform:none;opacity:0;pointer-events:none;filter:${filter};`;
  canvas.dataset.windowCamera = "true";
  renderer.setSize(W, H, false);
  return {
    sample(progress) {
      const travel = workApproach(progress);
      const alignment = workAlignment(progress);
      const distance = startDistance * Math.pow(finishDistance / startDistance, travel);
      // Resolve the island's viewing angle at a distance, then travel directly
      // toward the pane with a level camera and no sideways bank.
      heading.copy(direction).lerp(normal, alignment).normalize();
      camera.position.copy(window.center).addScaledVector(heading, distance);
      look.lookAt(camera.position, window.center, window.up);
      orientation.setFromRotationMatrix(look);
      camera.quaternion.copy(original.quaternion).slerp(orientation, alignment);
      lens.near = Math.max(.0005, distance * .001);
      lens.fov = Math.min(150, camera.fov * workLens(progress));
      lens.updateProjectionMatrix();
      const framing = alignment;
      camera.projectionMatrix.fromArray(startProjection.elements.map((value, i) => value + (lens.projectionMatrix.elements[i] - value) * framing));
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      camera.updateMatrixWorld(true);
      canvas.style.opacity = String(alreadyLive ? 1 : smooth(progress / .055));
      if (progress >= .055) parent.style.visibility = "hidden";
      renderer.render(scene, camera);
      return window.corners.map(point => {
        const projected = point.clone().project(camera);
        return [(projected.x + 1) * W / 2, (1 - projected.y) * H / 2];
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      camera.copy(original);
      parent.style.visibility = visibility;
      delete canvas.dataset.windowCamera;
      canvas.style.cssText = oldStyle;
      if (parent.isConnected) parent.append(canvas);
      onRelease();
    },
  };
}
