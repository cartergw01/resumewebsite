// Render an eight-second transparent cinemagraph from the original island.
// Usage: node scripts/render-writing-loop.mjs /tmp/writing-loop-frames
// Encode the frames with VP9 alpha for Chromium/Firefox and HEVC alpha for Safari.
// ffmpeg -framerate 24 -i /tmp/writing-loop-frames/%04d.png -c:v libvpx-vp9
//   -pix_fmt yuva420p -b:v 0 -crf 28 -row-mt 1 -threads 2 -auto-alt-ref 0
//   -an -metadata:s:v:0 alpha_mode=1 public/writing-island-loop-v1.webm
// On macOS, encode the second source with VideoToolbox:
// ffmpeg -framerate 24 -i /tmp/writing-loop-frames/%04d.png -c:v hevc_videotoolbox
//   -allow_sw 1 -alpha_quality 0.85 -pix_fmt bgra -b:v 1500k -tag:v hvc1
//   -an -movflags +faststart public/writing-island-loop-v1.mov
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const output = process.argv[2];
if (!output) throw new Error("Provide a temporary frame-output directory.");
await mkdir(output, { recursive: true });
const source = await readFile(new URL("../public/world-writing-cutout-v1.webp", import.meta.url));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 530 } });
  await page.setContent('<canvas id="frame" width="960" height="530"></canvas>');
  await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/webp;base64,${base64}`;
    await image.decode();
    const layer = document.createElement("canvas");
    layer.width = 960;
    layer.height = 530;
    const gl = layer.getContext("webgl", { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL is required for the video compositor.");
    const shader = (type, source) => {
      const result = gl.createShader(type);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
      return result;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec2 point;
      void main() { gl_Position = vec4(point, 0.0, 1.0); }
    `));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision highp float;
      uniform sampler2D artwork;
      uniform float phase;
      float edge(vec2 p, vec2 a, vec2 b) {
        vec2 d = b - a;
        return (d.x * (p.y - a.y) - d.y * (p.x - a.x)) / length(d);
      }
      void main() {
        vec2 p = vec2(gl_FragCoord.x, 530.0 - gl_FragCoord.y - 0.5);
        // The outer edge of the right-hand page lifts a few pixels; the spine
        // stays anchored. A feathered mask avoids seams in the source texture.
        float paper = min(min(edge(p, vec2(455,196), vec2(558,184)),
                              edge(p, vec2(558,184), vec2(640,249))),
                          min(edge(p, vec2(640,249), vec2(522,263)),
                              edge(p, vec2(522,263), vec2(455,196))));
        float freeEdge = clamp((p.x - 455.0 - (p.y - 196.0)) / 115.0, 0.0, 1.0);
        float ripple = sin(phase + freeEdge * 2.1) * 2.4;
        vec2 displaced = p + vec2(0.3, ripple) * smoothstep(-2.0, 5.0, paper) * freeEdge;
        vec4 color = texture2D(artwork, displaced / vec2(960.0, 529.0));
        if (p.y < 0.0 || p.y > 529.0) color = vec4(0.0);
        // Slow, periodic changes in the lamp's pool of light, without moving
        // the camera or making the entire island pulse.
        float breathe = 0.5 + 0.35 * sin(phase) + 0.15 * sin(phase * 3.0 + 0.8);
        float pool = exp(-dot((p - vec2(355,223)) / vec2(115,57), (p - vec2(355,223)) / vec2(115,57)));
        float bulb = exp(-dot((p - vec2(310,115)) / vec2(27,12), (p - vec2(310,115)) / vec2(27,12)));
        color.rgb += vec3(0.10,0.060,0.018) * pool * breathe;
        color.rgb += vec3(0.08,0.058,0.022) * bulb * breathe;
        gl_FragColor = color;
      }
    `));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const point = gl.getAttribLocation(program, "point");
    gl.enableVertexAttribArray(point);
    gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const time = gl.getUniformLocation(program, "phase");
    const canvas = document.getElementById("frame");
    const ctx = canvas.getContext("2d");
    const seed = (n) => (Math.sin(n * 137.43 + 12.7) * 43758.5453) % 1;
    window.renderFrame = (fraction) => {
      gl.uniform1f(time, fraction * Math.PI * 2);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      ctx.clearRect(0, 0, 960, 530);
      ctx.drawImage(layer, 0, 0);
      const glow = ctx.createRadialGradient(308, 119, 2, 308, 119, 45);
      const strength = 0.065 + Math.sin(fraction * Math.PI * 2) * 0.025;
      glow.addColorStop(0, `rgba(255,204,118,${strength})`);
      glow.addColorStop(1, "rgba(255,204,118,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(262, 73, 92, 92);
      for (let i = 0; i < 18; i++) {
        const random = Math.abs(seed(i + 1));
        const life = (fraction + random) % 1;
        const x = 285 + random * 119 + Math.sin(life * Math.PI * 2 + i) * 13;
        const y = 232 - life * (84 + Math.abs(seed(i + 22)) * 41);
        const alpha = Math.sin(life * Math.PI) ** 2 * (0.18 + random * 0.3);
        const radius = 0.55 + Math.abs(seed(i + 43)) * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,224,169,${alpha})`;
        ctx.fill();
      }
      return canvas.toDataURL("image/png").split(",")[1];
    };
  }, source.toString("base64"));
  for (let frame = 0; frame < 192; frame++) {
    const png = await page.evaluate((index) => window.renderFrame(index / 192), frame);
    await writeFile(path.join(output, `${String(frame).padStart(4, "0")}.png`), Buffer.from(png, "base64"));
    if (frame % 48 === 0) console.log(`Rendered ${frame}/192 frames`);
  }
  console.log(`Rendered 192 frames to ${output}`);
} finally {
  await browser.close();
}
