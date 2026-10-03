// A light registry lets page transitions borrow a ready renderer without
// importing Three.js into the homepage's initial bundle.
export type ScreenMatrix = { a: number; b: number; c: number; d: number; e: number; f: number };
export type WindowFlight = { sample: (progress: number) => number[][]; dispose: () => void };
export type WindowCamera = (host: HTMLElement, matrix: ScreenMatrix) => WindowFlight;
const cameras = new WeakMap<Element, WindowCamera>();
export function registerWindowCamera(visual: Element, camera: WindowCamera) {
  cameras.set(visual, camera);
  return () => cameras.delete(visual);
}
export function windowCameraFor(visual: Element) { return cameras.get(visual); }
