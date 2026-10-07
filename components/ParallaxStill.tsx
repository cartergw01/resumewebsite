"use client";

import { useEffect, useRef } from "react";
import { CITY_TIME_EVENT, currentCityTime } from "@/lib/city-time";
import type { ParallaxState } from "./IslandLife";

// Depth parallax for an island's Cycles still. Blender renders a camera-depth
// map with every island (scripts/blender/render_depth.py); this redraws the
// still shifted by that depth as the pointer moves, so near rock and far
// buildings slide against each other like a real camera. The landmark's depth
// is the zero plane, so the annotation and entry surfaces stay put.
// It draws only while the view is moving, and only for fine pointers, with
// motion allowed, on the active, settled island; otherwise the still remains.
const VERTEX = `#version 300 es
in vec2 corner; out vec2 uv;
void main() { uv = vec2(corner.x * .5 + .5, .5 - corner.y * .5); gl_Position = vec4(corner, 0, 1); }`;
const FRAGMENT = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 color;
uniform sampler2D night, day, depth;
uniform float daylight, focus;
uniform vec2 shift;
uniform vec4 fit;
// Depth from a blurred mip, un-premultiplied: smooth, and it reaches just
// past the silhouette, so edges shift cleanly instead of tearing or haloing.
float depthAt(vec2 p) { vec4 s = textureLod(depth, p, 2.5); return s.a > .004 ? s.r / s.a : 0.; }
void main() {
  vec2 p = (uv - fit.zw) / fit.xy;
  if (p.x < 0. || p.y < 0. || p.x > 1. || p.y > 1.) { color = vec4(0); return; }
  vec2 q = p + shift * (depthAt(p) - focus);
  q = p + shift * (depthAt(q) - focus);
  color = mix(texture(night, q), texture(day, q), daylight);
}`;

export default function ParallaxStill({ depthSrc, focus, className }: { depthSrc: string; focus: number[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const visual = canvas?.closest<HTMLElement>("[data-island-visual]") as (HTMLElement & { parallax?: ParallaxState }) | null;
    const scene = canvas?.closest<HTMLElement>("[data-island-scene]");
    const stage = canvas?.closest<HTMLElement>("[data-island-stage]");
    if (!canvas || !visual || !scene || !stage) return;
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || motion.matches) return;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    let disposed = false, frame = 0, last = 0, ready = false;
    let daylight = currentCityTime() === "day" ? 1 : 0, dayTarget = daylight;
    const current = [0, 0], target = [0, 0];

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, "corner");
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const textures: WebGLTexture[] = [];
    const upload = (unit: number, image: TexImageSource, name: string) => {
      const texture = gl.createTexture()!;
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(uniform(name), unit);
    };

    const resize = () => {
      const ratio = Math.min(devicePixelRatio, 1.5);
      const width = canvas.clientWidth, height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
      // The still is a 3:2 render drawn with object-fit: contain.
      const scale = Math.min(width / 1200, height / 800);
      const fx = 1200 * scale / width, fy = 800 * scale / height;
      gl.uniform4f(uniform("fit"), fx, fy, (1 - fx) / 2, (1 - fy) / 2);
      draw();
    };
    const draw = () => {
      if (!ready || disposed) return;
      gl.uniform2f(uniform("shift"), current[0], current[1]);
      // Shared with the live details so they move with the surfaces they sit on.
      if (visual.parallax) { visual.parallax.x = current[0]; visual.parallax.y = current[1]; }
      gl.uniform1f(uniform("daylight"), daylight);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const settled = () => scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering && !visual.dataset.orbitLive && !document.hidden;
    const tick = (now: number) => {
      const dt = Math.min(50, last ? now - last : 16); last = now;
      const k = 1 - Math.exp(-dt / 140);
      current[0] += (target[0] - current[0]) * k; current[1] += (target[1] - current[1]) * k;
      if (daylight !== dayTarget) {
        const step = dt / 1400;
        daylight = dayTarget > daylight ? Math.min(dayTarget, daylight + step) : Math.max(dayTarget, daylight - step);
      }
      draw();
      const moving = Math.abs(target[0] - current[0]) > 1e-5 || Math.abs(target[1] - current[1]) > 1e-5 || daylight !== dayTarget;
      frame = moving ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };
    const wake = () => { if (!frame && ready) frame = requestAnimationFrame(tick); };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !settled()) return;
      // Up to ~1.4% of the image's width at the nearest and farthest depths.
      target[0] = -((event.clientX / innerWidth) - .5) * .024;
      target[1] = -((event.clientY / innerHeight) - .5) * .016;
      wake();
    };
    const sync = () => {
      if (!settled()) { target[0] = target[1] = 0; }
      dayTarget = currentCityTime() === "day" ? 1 : 0;
      wake();
    };
    const lose = (event: Event) => { event.preventDefault(); delete visual.dataset.parallax; ready = false; };

    void (async () => {
      const night = visual.querySelector<HTMLImageElement>("img:not([data-city-time])");
      if (!night) return;
      const day = visual.querySelector<HTMLImageElement>('img[data-city-time="day"]') ?? night;
      const depth = new Image(); depth.src = depthSrc;
      try { await Promise.all([night.decode(), day.decode(), depth.decode()]); } catch { return; }
      if (disposed) return;
      upload(0, night, "night"); upload(1, day, "day"); upload(2, depth, "depth");
      // Sample the landmark's depth so it becomes the still point.
      const probe = document.createElement("canvas"); probe.width = 900; probe.height = 600;
      const context = probe.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(depth, 0, 0, 900, 600);
      const pixel = context.getImageData(Math.round(focus[0] / 1200 * 899), Math.round(focus[1] / 800 * 599), 1, 1).data;
      const focusDepth = pixel[3] ? pixel[0] / 255 : .5;
      gl.uniform1f(uniform("focus"), focusDepth);
      const map = context.getImageData(0, 0, 900, 600).data;
      visual.parallax = { x: 0, y: 0, focus: focusDepth, depth: (x, y) => {
        const i = (Math.max(0, Math.min(599, Math.round(y / 800 * 599))) * 900 + Math.max(0, Math.min(899, Math.round(x / 1200 * 899)))) * 4;
        return map[i + 3] ? map[i] / 255 : focusDepth;
      } };
      ready = true;
      resize();
      // The canvas now shows the still (and its day twin); the images stay as
      // the source and fallback for transitions and the 3D view.
      visual.dataset.parallax = "on";
    })();

    const sizes = new ResizeObserver(resize); sizes.observe(canvas);
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    observer.observe(visual, { attributes: true, attributeFilter: ["data-orbit-live"] });
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener(CITY_TIME_EVENT, sync);
    canvas.addEventListener("webglcontextlost", lose);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      sizes.disconnect(); observer.disconnect();
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener(CITY_TIME_EVENT, sync);
      canvas.removeEventListener("webglcontextlost", lose);
      delete visual.dataset.parallax;
      delete visual.parallax;
      textures.forEach(texture => gl.deleteTexture(texture));
      gl.deleteBuffer(buffer); gl.deleteProgram(program);
    };
  }, [depthSrc, focus]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-parallax-still />;
}
