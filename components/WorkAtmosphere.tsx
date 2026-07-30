"use client";

import { useEffect, useRef } from "react";

const STAR_FRAME_INTERVAL = 1000 / 30;
const SIXTY_FPS_INTERVAL = 1000 / 60;
const MOUSE_GLOW_RADIUS = 650;
const MOUSE_GLOW_DIAMETER = MOUSE_GLOW_RADIUS * 2;

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let resizeFrame = 0;
    let W = 0;
    let H = 0;
    let canvasPixelWidth = 0;
    let canvasPixelHeight = 0;
    let renderDpr = 1;
    const finePointerQuery = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const shouldAnimate = (
      finePointerQuery.matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    let redrawStaticFrame = () => {};

    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width || document.documentElement.clientWidth;
      H = rect.height || document.documentElement.clientHeight;
      renderDpr = Math.min(window.devicePixelRatio || 1, finePointerQuery.matches ? 2 : 1.5);
      const nextWidth = Math.round(W * renderDpr);
      const nextHeight = Math.round(H * renderDpr);
      if (canvasPixelWidth === nextWidth && canvasPixelHeight === nextHeight) return;

      canvasPixelWidth = nextWidth;
      canvasPixelHeight = nextHeight;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      ctx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
    };

    sizeCanvas();
    const scheduleCanvasResize = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        sizeCanvas();
        updateScrollRange();
        if (!shouldAnimate) redrawStaticFrame();
      });
    };
    const canvasResizeObserver = new ResizeObserver(scheduleCanvasResize);
    canvasResizeObserver.observe(canvas);
    window.addEventListener("resize", scheduleCanvasResize, { passive: true });

    let smoothWarp = 0;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    let maxScroll = Math.max(1, document.documentElement.scrollHeight - H);
    const updateScrollRange = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - H);
    };
    const getScrollDepth = () => clamp(window.scrollY / maxScroll, 0, 1);
    requestAnimationFrame(updateScrollRange);

    const palette: [number, number, number][] = [
      [155, 176, 255],
      [170, 191, 255],
      [202, 215, 255],
      [248, 247, 255],
      [255, 244, 234],
      [255, 222, 180],
      [255, 190, 130],
      [255, 160, 100],
    ];

    const glowSprites = new Map<string, HTMLCanvasElement>();
    const createStarGlow = (radius: number, r: number, g: number, b: number) => {
      const snappedRadius = Math.max(1, Math.round(radius * 2) / 2);
      const key = `${snappedRadius}:${r}:${g}:${b}:${renderDpr}`;
      const cached = glowSprites.get(key);
      if (cached) return { canvas: cached, radius: snappedRadius };

      const sprite = document.createElement("canvas");
      const diameter = snappedRadius * 2;
      sprite.width = Math.max(1, Math.ceil(diameter * renderDpr));
      sprite.height = Math.max(1, Math.ceil(diameter * renderDpr));
      const spriteCtx = sprite.getContext("2d");
      if (!spriteCtx) return { canvas: null, radius: snappedRadius };

      spriteCtx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
      const glow = spriteCtx.createRadialGradient(
        snappedRadius,
        snappedRadius,
        0,
        snappedRadius,
        snappedRadius,
        snappedRadius,
      );
      glow.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      spriteCtx.fillStyle = glow;
      spriteCtx.fillRect(0, 0, diameter, diameter);
      glowSprites.set(key, sprite);
      return { canvas: sprite, radius: snappedRadius };
    };

    interface Star {
      x: number;
      y: number;
      size: number;
      driftSpeed: number;
      baseOpacity: number;
      phase: number;
      twinkleSpeed: number;
      cr: number;
      cg: number;
      cb: number;
      color: string;
      prominent: boolean;
      alpha: number;
      glow: HTMLCanvasElement | null;
      glowRadius: number;
    }

    // Star counts trimmed from [380,160,65,14] (619 total) — that many stars,
    // most needing their own gradient fill every frame, made this canvas's
    // first paint a multi-hundred-ms main-thread hitch right as the rocket's
    // arrival burst was trying to render on the same frame after route entry.
    const layers: [number, number, number, number, number, number, number][] = [
      [220, 0.15, 0.5, 0.02, 0.055, 0.35, 0.7],
      [100, 0.4, 1.1, 0.065, 0.18, 0.6, 0.9],
      [45, 0.9, 2.2, 0.18, 0.43, 0.8, 1.0],
      [10, 2.0, 3.8, 0.08, 0.2, 0.95, 1.0],
    ];

    const stars: Star[] = [];
    for (const [count, minSz, maxSz, minSpd, maxSpd, minOp, maxOp] of layers) {
      const isProminent = minSz >= 2.0;
      for (let i = 0; i < count; i++) {
        const [cr, cg, cb] = palette[Math.floor(Math.random() * palette.length)];
        const size = minSz + Math.random() * (maxSz - minSz);
        const glow = size > 0.8
          ? createStarGlow(size * (isProminent ? 6 : 4), cr, cg, cb)
          : { canvas: null, radius: 0 };
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size,
          driftSpeed: minSpd + Math.random() * (maxSpd - minSpd),
          baseOpacity: minOp + Math.random() * (maxOp - minOp),
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.0003 + Math.random() * 0.0015,
          cr,
          cg,
          cb,
          color: `rgb(${cr} ${cg} ${cb})`,
          prominent: isProminent,
          alpha: 1,
          glow: glow.canvas,
          glowRadius: glow.radius,
        });
      }
    }

    const resetStar = (star: Star, fromCenter = false) => {
      if (fromCenter) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * Math.min(W, H) * 0.08;
        star.x = W / 2 + Math.cos(angle) * radius;
        star.y = H / 2 + Math.sin(angle) * radius;
        star.alpha = 0;
      } else {
        star.x = W + star.size + Math.random() * W * 0.12;
        star.y = Math.random() * H;
        star.alpha = 1;
      }
      star.phase = Math.random() * Math.PI * 2;
    };

    const nebulae = [
      { x: W * 0.15, y: H * 0.3, r: 340, cr: 90, cg: 20, cb: 200, a: 0.22, vx: 0.035, vy: 0.018 },
      { x: W * 0.75, y: H * 0.65, r: 380, cr: 15, cg: 60, cb: 220, a: 0.24, vx: -0.028, vy: 0.025 },
      { x: W * 0.5, y: H * 0.08, r: 300, cr: 210, cg: 25, cb: 100, a: 0.18, vx: 0.02, vy: -0.014 },
      { x: W * 0.88, y: H * 0.38, r: 320, cr: 25, cg: 110, cb: 230, a: 0.2, vx: -0.038, vy: 0.018 },
      { x: W * 0.38, y: H * 0.82, r: 280, cr: 140, cg: 10, cb: 210, a: 0.16, vx: 0.022, vy: -0.012 },
      { x: W * 0.62, y: H * 0.45, r: 260, cr: 220, cg: 90, cb: 20, a: 0.12, vx: -0.018, vy: 0.03 },
    ];

    let lastDrawAt = 0;

    const draw = (t: number) => {
      if (shouldAnimate) animId = requestAnimationFrame(draw);

      const elapsed = lastDrawAt === 0 ? STAR_FRAME_INTERVAL : t - lastDrawAt;
      if (shouldAnimate && elapsed < STAR_FRAME_INTERVAL) return;

      const frameStep = shouldAnimate ? Math.min(elapsed / SIXTY_FPS_INTERVAL, 3) : 0;
      lastDrawAt = t - (elapsed % STAR_FRAME_INTERVAL);
      const targetWarp = shouldAnimate ? getScrollDepth() : 0;
      smoothWarp = shouldAnimate
        ? smoothWarp + (targetWarp - smoothWarp) * (1 - Math.pow(1 - 0.032, frameStep))
        : 0;
      const warp = smoothWarp;
      const cx = W / 2;
      const cy = H / 2;

      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      for (const n of nebulae) {
        n.x += n.vx * frameStep;
        n.y += n.vy * frameStep;
        if (n.x < -n.r) n.x = W + n.r;
        if (n.x > W + n.r) n.x = -n.r;
        if (n.y < -n.r) n.y = H + n.r;
        if (n.y > H + n.r) n.y = -n.r;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `rgba(${n.cr},${n.cg},${n.cb},${n.a})`);
        g.addColorStop(0.5, `rgba(${n.cr},${n.cg},${n.cb},${n.a * 0.4})`);
        g.addColorStop(1, `rgba(${n.cr},${n.cg},${n.cb},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      for (const s of stars) {
        s.alpha = Math.min(1, s.alpha + 0.018 * frameStep);

        const dx = s.x - cx;
        const dy = s.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        const lateralDrift = s.driftSpeed * (1 - warp * 0.92);
        const radialPush = warp * warp * (0.5 + warp * 1.0) * s.driftSpeed * 7;

        s.x -= lateralDrift * frameStep;
        s.x += nx * radialPush * frameStep;
        s.y += ny * radialPush * 0.72 * frameStep;

        const margin = 24;
        if (s.x < -margin || s.x > W + margin || s.y < -margin || s.y > H + margin) {
          resetStar(s, warp > 0.15);
        }

        const twinkleMix = Math.max(0, 1 - warp * 1.4);
        const twinkle = twinkleMix > 0
          ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.phase)) * twinkleMix + (1 - twinkleMix) * 0.55
          : 0.85;
        const op = s.baseOpacity * twinkle * s.alpha;

        if (s.glow) {
          ctx.globalAlpha = op;
          ctx.drawImage(
            s.glow,
            s.x - s.glowRadius,
            s.y - s.glowRadius,
            s.glowRadius * 2,
            s.glowRadius * 2,
          );
        }

        if (warp > 0.05) {
          if (dist < 8) {
            ctx.globalAlpha = 1;
            continue;
          }
          ctx.globalAlpha = 1;
          const nearFade = Math.min(dist / 32, 1);
          const distFactor = Math.min(dist / 180, 1) * nearFade;
          const streakLen = warp * warp * 80 * (s.size + 0.5) * distFactor;
          const sg = ctx.createLinearGradient(s.x - nx * streakLen, s.y - ny * streakLen, s.x, s.y);
          sg.addColorStop(0, `rgba(${s.cr},${s.cg},${s.cb},0)`);
          sg.addColorStop(0.55, `rgba(${s.cr},${s.cg},${s.cb},${op * 0.3})`);
          sg.addColorStop(1, `rgba(${s.cr},${s.cg},${s.cb},${op})`);
          ctx.beginPath();
          ctx.moveTo(s.x - nx * streakLen, s.y - ny * streakLen);
          ctx.lineTo(s.x, s.y);
          ctx.strokeStyle = sg;
          ctx.lineWidth = s.size * (0.6 + warp * 0.8);
          ctx.stroke();
        }

        const dotR = s.size * Math.max(0, 1 - warp * 0.9);
        if (dotR > 0.05) {
          ctx.globalAlpha = op;
          ctx.beginPath();
          ctx.arc(s.x, s.y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

    };

    redrawStaticFrame = () => draw(0);

    if (shouldAnimate) {
      animId = requestAnimationFrame(draw);
    } else {
      redrawStaticFrame();
    }

    const onVisibility = () => {
      if (!shouldAnimate) return;

      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        lastDrawAt = 0;
        animId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(animId);
      cancelAnimationFrame(resizeFrame);
      canvasResizeObserver.disconnect();
      window.removeEventListener("resize", scheduleCanvasResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="work-starfield"
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100lvh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

function MouseGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
    ) return;

    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;

    const paint = () => {
      frame = 0;
      el.style.transform = `translate3d(${pointerX - MOUSE_GLOW_RADIUS}px, ${pointerY - MOUSE_GLOW_RADIUS}px, 0)`;
    };

    paint();
    el.style.opacity = "1";

    const move = (e: MouseEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => {
      window.removeEventListener("mousemove", move);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        ref={ref}
        className="absolute left-0 top-0"
        style={{
          width: MOUSE_GLOW_DIAMETER,
          height: MOUSE_GLOW_DIAMETER,
          background: `radial-gradient(${MOUSE_GLOW_RADIUS}px circle at center, rgba(88, 130, 255, 0.06), transparent 65%)`,
          contain: "strict",
          opacity: 0,
          transform: `translate3d(calc(50vw - ${MOUSE_GLOW_RADIUS}px), calc(50vh - ${MOUSE_GLOW_RADIUS}px), 0)`,
          willChange: "transform",
        }}
      />
    </div>
  );
}

export default function WorkAtmosphere() {
  return (
    <>
      <StarField />
      <MouseGlow />
    </>
  );
}
