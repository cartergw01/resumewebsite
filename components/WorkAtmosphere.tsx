"use client";

import { useEffect, useRef } from "react";

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let W = window.innerWidth;
    let H = window.innerHeight;

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);

    let smoothWarp = 0;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const getScrollDepth = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp(window.scrollY / maxScroll, 0, 1);
    };

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
      prominent: boolean;
      alpha: number;
    }

    const layers: [number, number, number, number, number, number, number][] = [
      [380, 0.15, 0.5, 0.02, 0.055, 0.35, 0.7],
      [160, 0.4, 1.1, 0.065, 0.18, 0.6, 0.9],
      [65, 0.9, 2.2, 0.18, 0.43, 0.8, 1.0],
      [14, 2.0, 3.8, 0.08, 0.2, 0.95, 1.0],
    ];

    const stars: Star[] = [];
    for (const [count, minSz, maxSz, minSpd, maxSpd, minOp, maxOp] of layers) {
      const isProminent = minSz >= 2.0;
      for (let i = 0; i < count; i++) {
        const [cr, cg, cb] = palette[Math.floor(Math.random() * palette.length)];
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: minSz + Math.random() * (maxSz - minSz),
          driftSpeed: minSpd + Math.random() * (maxSpd - minSpd),
          baseOpacity: minOp + Math.random() * (maxOp - minOp),
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.0003 + Math.random() * 0.0015,
          cr,
          cg,
          cb,
          prominent: isProminent,
          alpha: 1,
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

    const draw = (t: number) => {
      const targetWarp = getScrollDepth();
      smoothWarp += (targetWarp - smoothWarp) * 0.032;
      const warp = smoothWarp;
      const cx = W / 2;
      const cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      for (const n of nebulae) {
        n.x += n.vx;
        n.y += n.vy;
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
        s.alpha = Math.min(1, s.alpha + 0.018);

        const dx = s.x - cx;
        const dy = s.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        const lateralDrift = s.driftSpeed * (1 - warp * 0.92);
        const radialPush = warp * warp * (0.5 + warp * 1.0) * s.driftSpeed * 7;

        s.x -= lateralDrift;
        s.x += nx * radialPush;
        s.y += ny * radialPush * 0.72;

        const margin = 24;
        if (s.x < -margin || s.x > W + margin || s.y < -margin || s.y > H + margin) {
          resetStar(s, warp > 0.15);
        }

        const twinkleMix = Math.max(0, 1 - warp * 1.4);
        const twinkle = twinkleMix > 0
          ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.phase)) * twinkleMix + (1 - twinkleMix) * 0.55
          : 0.85;
        const op = s.baseOpacity * twinkle * s.alpha;

        if (s.size > 0.8) {
          const glowR = s.size * (s.prominent ? 6 : 4);
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
          g.addColorStop(0, `rgba(${s.cr},${s.cg},${s.cb},${op * 0.4})`);
          g.addColorStop(1, `rgba(${s.cr},${s.cg},${s.cb},0)`);
          ctx.beginPath();
          ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }

        if (warp > 0.05) {
          if (dist < 8) continue;
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
          ctx.beginPath();
          ctx.arc(s.x, s.y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${op})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        animId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", sizeCanvas);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
    />
  );
}

function MouseGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      el.style.background = `radial-gradient(650px circle at ${e.clientX}px ${e.clientY}px, rgba(88, 130, 255, 0.06), transparent 65%)`;
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return <div ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }} />;
}

export default function WorkAtmosphere() {
  return (
    <>
      <StarField />
      <MouseGlow />
    </>
  );
}
