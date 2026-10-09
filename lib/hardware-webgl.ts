// Optional 3D (island flights and orbits) needs a real GPU. Software WebGL —
// what Chrome falls back to on a blocklisted GPU, in VMs and remote desktops —
// builds these scenes in seconds on the main thread, freezing the page; the
// stills and 2D crossings are the better experience there.
let cached: boolean | undefined;
export function hardwareWebGL() {
  if (cached !== undefined) return cached;
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return (cached = false);
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return (cached = !/swiftshader|llvmpipe|software|basic render/i.test(renderer));
}
