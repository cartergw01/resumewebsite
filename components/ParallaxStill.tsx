"use client";

import { useEffect, useRef } from "react";
import { CITY_TIME_DURATION, CITY_TIME_EVENT, currentCityTime } from "@/lib/city-time";
import { lightsOn, ROOM_LIGHTS_EVENT, ROOM_LIGHTS_INTENT, type RoomWorld } from "@/lib/room-lights";
import { flipDuration, flipState, timing } from "@/lib/light-switch";
import type { ParallaxState } from "./IslandLife";
import { hardwareWebGL } from "@/lib/hardware-webgl";

// Depth parallax for an island's Cycles still. Blender renders a camera-depth
// map with every island (scripts/blender/render_depth.py); this redraws the
// still shifted by that depth as the pointer moves, so near rock and far
// buildings slide against each other like a real camera. The landmark's depth
// is the zero plane, so the annotation and entry surfaces stay put.
// It draws only while the view is moving, and only for fine pointers, with
// motion allowed, on the active, settled island; otherwise the still remains.
//
// The same canvas plays a room's light switch (lib/light-switch.ts): each
// pixel eases between the lit and dark stills at the pace of the light
// sources lighting it, from Blender's per-source light masks. On touch
// screens, which have no parallax, it starts only for that, once someone
// settles on the room or reaches for its switch.
const VERTEX = `#version 300 es
in vec2 corner; out vec2 uv;
void main() { uv = vec2(corner.x * .5 + .5, .5 - corner.y * .5); gl_Position = vec4(corner, 0, 1); }`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv; out vec4 color;
uniform sampler2D night, day, depth, mask0, mask1, mask2;
uniform float daylight, focus;
uniform vec2 shift;
uniform vec4 fit;
// A staged light switch: ms since the flip, its direction (1 on, 0 off), and
// for each source its starting level, timing and extent across the still.
uniform bool staged;
uniform int sources;
uniform float elapsed, lit;
uniform float origin[9], delay[9], duration[9], sweep[9];
uniform vec2 extent[9];
float share(int i, vec2 q) {
  vec4 m = i < 3 ? texture(mask0, q) : i < 6 ? texture(mask1, q) : texture(mask2, q);
  int c = i - i / 3 * 3;
  return c == 0 ? m.r : c == 1 ? m.g : m.b;
}
// Depth from a blurred mip, un-premultiplied: smooth, and it reaches just
// past the silhouette, so edges shift cleanly instead of tearing or haloing.
float depthAt(vec2 p) { vec4 s = textureLod(depth, p, 2.5); return s.a > .004 ? s.r / s.a : 0.; }
void main() {
  vec2 p = (uv - fit.zw) / fit.xy;
  // Outside the still is cleared at the end, not by returning early: an early
  // return left the texture lookups along its edge without derivatives, so
  // they sampled the smallest mip and drew a line of the still's average
  // colour across the canvas above and below the island.
  bool inside = p.x >= 0. && p.y >= 0. && p.x <= 1. && p.y <= 1.;
  vec2 q = p + shift * (depthAt(p) - focus);
  q = p + shift * (depthAt(q) - focus);
  float dark = daylight;
  if (staged) {
    // Each source's level here, weighted by its share of this pixel's light;
    // light no source claims follows the sources' average.
    float sum = 0., total = 0., plain = 0.;
    for (int i = 0; i < 9; i++) {
      if (i >= sources) break;
      float along = clamp((q.x - extent[i].x) / max(.001, extent[i].y - extent[i].x), 0., 1.);
      if (lit < .5) along = 1. - along;
      float t = clamp((elapsed - delay[i] - along * sweep[i]) / duration[i], 0., 1.);
      float level = origin[i] + (lit - origin[i]) * t * t * (3. - 2. * t);
      float s = share(i, q);
      sum += s * level; total += s; plain += level;
    }
    dark = 1. - (sum + (1. - min(total, 1.)) * plain / float(sources));
  }
  color = mix(texture(night, q), texture(day, q), dark) * float(inside);
}`;

export type LightMasks = { sources: string[]; src: string[]; extents: number[][] };

// The still's twin (Taipei by day, or a room with its lights off) is blended
// in by the same shader; `room` says which switch drives it, and `masks`
// stage that room's switch fixture by fixture.
export default function ParallaxStill({ depthSrc, focus, room, masks, className }: { depthSrc: string; focus: number[]; room?: RoomWorld; masks?: LightMasks; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const visual = canvas?.closest<HTMLElement>("[data-island-visual]") as (HTMLElement & { parallax?: ParallaxState }) | null;
    const scene = canvas?.closest<HTMLElement>("[data-island-scene]");
    const stage = canvas?.closest<HTMLElement>("[data-island-stage]");
    if (!canvas || !visual || !scene || !stage) return;
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    // Without a fine pointer there is no parallax: the canvas is only for a
    // room's staged switch, and starts when someone reaches for it.
    const parallax = fine.matches;
    const staged = !!(room && masks?.src.length);
    if (!parallax && !staged) return;
    let gl: WebGL2RenderingContext | null = null;
    let disposed = false, frame = 0, last = 0, ready = false;
    // 0 shows the still, 1 its twin.
    const twinWanted = () => room ? !lightsOn(room) : currentCityTime() === "day";
    const twinSelector = room ? `img[data-lights-off="${room}"]` : 'img[data-city-time="day"]';
    let daylight = twinWanted() ? 1 : 0, dayTarget = daylight, twinLoaded = false, twinLoading = false, masksLoaded = false;
    const current = [0, 0], target = [0, 0];
    let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null;
    const textures: WebGLTexture[] = [];
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    const uniform = (name: string) => {
      if (!uniforms.has(name)) uniforms.set(name, gl!.getUniformLocation(program!, name));
      return uniforms.get(name)!;
    };
    // While the switch's canvas loads, the switch waits for it (room-lights).
    if (staged) visual.dataset.lightsGl = "loading";

    const upload = (unit: number, image: TexImageSource, name: string, data = false) => {
      if (!gl) return;
      const texture = gl.createTexture()!;
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Bitmaps arrive premultiplied (createImageBitmap); images need it here.
      // Masks are data: neither premultiplied nor colour managed.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !data && !(typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap));
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, data ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(uniform(name), unit);
    };
    // Decode to bitmaps off the main thread: uploading an <img> made WebGL
    // decode it again synchronously, ~20ms per island in the first flight.
    const bitmap = (image: HTMLImageElement, data = false) => typeof createImageBitmap === "function"
      ? createImageBitmap(image, data ? { premultiplyAlpha: "none", colorSpaceConversion: "none" } : { premultiplyAlpha: "premultiply" }).catch(() => image)
      : Promise.resolve(image);

    const resize = () => {
      if (!gl) return;
      // Full screen density: this canvas replaces the still, so anything less
      // than the device's pixels shows as a soft island on Retina and phones.
      // It only redraws while the pointer or a switch moves it, so the cost
      // is small on a GPU; software WebGL keeps the lighter 1.5x.
      const ratio = Math.min(devicePixelRatio, hardwareWebGL() ? 3 : 1.5);
      const width = canvas.clientWidth, height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
      // The still is a 3:2 render drawn with object-fit: contain.
      const scale = Math.min(width / 1200, height / 800);
      const fx = 1200 * scale / width, fy = 800 * scale / height;
      gl.uniform4f(uniform("fit"), fx, fy, (1 - fx) / 2, (1 - fy) / 2);
      draw();
    };
    // The flip being played, if any: it has to match the switch's state, and
    // ends once its slowest source has settled.
    const playing = () => {
      if (!room || !masksLoaded || !twinLoaded) return undefined;
      const flip = flipState(room);
      if (!flip || flip.on !== lightsOn(room)) return undefined;
      return performance.now() - flip.at < flipDuration(masks!.sources, flip.on) + 32 ? flip : undefined;
    };
    let drawnFlip: ReturnType<typeof flipState>;
    const draw = () => {
      if (!ready || disposed || !gl) return;
      gl.uniform2f(uniform("shift"), current[0], current[1]);
      // Shared with the live details so they move with the surfaces they sit on.
      if (visual.parallax) { visual.parallax.x = current[0]; visual.parallax.y = current[1]; }
      gl.uniform1f(uniform("daylight"), daylight);
      const flip = playing();
      gl.uniform1i(uniform("staged"), flip ? 1 : 0);
      if (flip) {
        if (flip !== drawnFlip) {
          // A new flip: where each source starts, and its timing this way.
          const phases = masks!.sources.map(source => timing(source)[flip.on ? "on" : "off"]);
          gl.uniform1f(uniform("lit"), flip.on ? 1 : 0);
          gl.uniform1fv(uniform("origin"), masks!.sources.map(source => flip.from[source] ?? (flip.on ? 0 : 1)));
          gl.uniform1fv(uniform("delay"), phases.map(phase => phase.delay));
          gl.uniform1fv(uniform("duration"), phases.map(phase => phase.duration));
          gl.uniform1fv(uniform("sweep"), phases.map(phase => phase.sweep ?? 0));
        }
        gl.uniform1f(uniform("elapsed"), performance.now() - flip.at);
      }
      drawnFlip = flip;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const settled = () => scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering && !document.hidden;
    const tick = (now: number) => {
      const dt = Math.min(50, last ? now - last : 16); last = now;
      const k = 1 - Math.exp(-dt / 140);
      current[0] += (target[0] - current[0]) * k; current[1] += (target[1] - current[1]) * k;
      if (daylight !== dayTarget) {
        // A staged switch plays itself out; the plain blend steps over the
        // same time as Taipei's day and night.
        const step = staged && masksLoaded ? 1 : dt / CITY_TIME_DURATION;
        daylight = dayTarget > daylight ? Math.min(dayTarget, daylight + step) : Math.max(dayTarget, daylight - step);
      }
      const flip = playing();
      draw();
      const moving = Math.abs(target[0] - current[0]) > 1e-5 || Math.abs(target[1] - current[1]) > 1e-5 || daylight !== dayTarget || !!flip;
      frame = moving ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };
    const wake = () => { if (!frame && ready) frame = requestAnimationFrame(tick); };
    const pointer = (event: PointerEvent) => {
      if (!parallax || event.pointerType !== "mouse" || !settled()) return;
      // Up to ~1.4% of the image's width at the nearest and farthest depths.
      target[0] = -((event.clientX / innerWidth) - .5) * .024;
      target[1] = -((event.clientY / innerHeight) - .5) * .016;
      wake();
    };
    // The twin's image is often mounted only when it's first wanted, after
    // the canvas started: upload it then, before blending toward it.
    const loadTwin = async () => {
      if (twinLoaded || twinLoading || !ready) return;
      let image = visual.querySelector<HTMLImageElement>(twinSelector);
      // On intent the image mounts a moment later.
      for (let i = 0; !image && i < 30 && !disposed; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        image = visual.querySelector<HTMLImageElement>(twinSelector);
      }
      if (!image || disposed) return;
      twinLoading = true;
      try {
        await image.decode();
        const pixels = await bitmap(image);
        if (disposed) return;
        upload(1, pixels, "day");
        twinLoaded = true;
      } catch {
        // Keep blending toward the still itself; the switch crossfades.
        if (staged) delete visual.dataset.lightsGl;
      } finally { twinLoading = false; }
      lightsReady();
      wake();
    };
    // The switch may flip once the canvas can play it.
    const lightsReady = () => {
      if (staged && twinLoaded && masksLoaded && ready) {
        visual.dataset.lightsGl = "ready";
        if (!parallax) visual.dataset.parallax = "on";
      }
    };
    const sync = () => {
      if (!settled()) { target[0] = target[1] = 0; }
      dayTarget = twinWanted() ? 1 : 0;
      if ((dayTarget || staged) && !twinLoaded) {
        // Hold the still until its twin is on the GPU; then fade.
        void loadTwin();
        if (!twinLoaded) return;
      }
      wake();
    };
    const lose = (event: Event) => {
      event.preventDefault();
      delete visual.dataset.parallax;
      if (staged) delete visual.dataset.lightsGl;
      ready = false;
    };

    const start = async () => {
      gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!gl) { delete visual.dataset.lightsGl; return; }
      const compile = (type: number, source: string) => {
        const shader = gl!.createShader(type)!;
        gl!.shaderSource(shader, source); gl!.compileShader(shader);
        return shader;
      };
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { delete visual.dataset.lightsGl; return; }
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const corner = gl.getAttribLocation(program, "corner");
      gl.enableVertexAttribArray(corner);
      gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

      const night = visual.querySelector<HTMLImageElement>("img:not([data-city-time]):not([data-lights-off]):not([data-book-lifted])");
      if (!night) return;
      const day = visual.querySelector<HTMLImageElement>(twinSelector) ?? night;
      const depth = new Image(); depth.src = depthSrc;
      const maskImages = staged ? masks!.src.map(src => { const image = new Image(); image.src = src; return image; }) : [];
      try { await Promise.all([night.decode(), day.decode(), depth.decode()]); } catch { return; }
      if (disposed) return;
      const [nightPixels, dayPixels] = await Promise.all([bitmap(night), day === night ? null : bitmap(day)]);
      if (disposed) return;
      upload(0, nightPixels, "night"); upload(1, dayPixels ?? nightPixels, "day"); upload(2, depth, "depth");
      twinLoaded = day !== night;
      if (!twinLoaded) daylight = 0;
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
      sync();
      // The canvas now shows the still (and its day twin); the images stay as
      // the source and fallback for transitions. A switch-only canvas takes
      // over once it can play the switch.
      if (parallax) visual.dataset.parallax = "on";
      if (staged) {
        try {
          await Promise.all(maskImages.map(image => image.decode()));
          const pixels = await Promise.all(maskImages.map(image => bitmap(image, true)));
          if (disposed) return;
          pixels.forEach((image, index) => upload(3 + index, image, `mask${index}`, true));
          gl.uniform1i(uniform("sources"), masks!.sources.length);
          gl.uniform2fv(uniform("extent"), masks!.extents.flat());
          masksLoaded = true;
        } catch { /* Without its masks the room crossfades as one. */ delete visual.dataset.lightsGl; }
        lightsReady();
      }
    };

    // A touch screen's switch canvas starts when someone reaches for it.
    let started = false;
    const begin = () => { if (!started && !disposed) { started = true; void start(); } };
    // Reaching for the switch also mounts the lights-off still: upload it.
    const intent = (event: Event) => { if ((event as CustomEvent).detail === room) { begin(); void loadTwin(); } };
    if (parallax) begin();
    if (room) window.addEventListener(ROOM_LIGHTS_INTENT, intent);

    const sizes = new ResizeObserver(resize); sizes.observe(canvas);
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    window.addEventListener("pointermove", pointer, { passive: true });
    const twinEvent = room ? ROOM_LIGHTS_EVENT : CITY_TIME_EVENT;
    window.addEventListener(twinEvent, sync);
    canvas.addEventListener("webglcontextlost", lose);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      sizes.disconnect(); observer.disconnect();
      window.removeEventListener(ROOM_LIGHTS_INTENT, intent);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener(twinEvent, sync);
      canvas.removeEventListener("webglcontextlost", lose);
      delete visual.dataset.parallax;
      delete visual.dataset.lightsGl;
      delete visual.parallax;
      if (gl) {
        textures.forEach(texture => gl!.deleteTexture(texture));
        gl.deleteBuffer(buffer); gl.deleteProgram(program);
      }
    };
  }, [depthSrc, focus, room, masks]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-parallax-still />;
}
