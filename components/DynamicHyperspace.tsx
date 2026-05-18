"use client";

import { useEffect, useRef } from "react";

type Streak = {
  angle: number;
  radius: number;
  speed: number;
  length: number;
  width: number;
  alpha: number;
  color: string;
};

const palette = [
  "116, 169, 255",
  "174, 135, 255",
  "255, 177, 214",
  "255, 211, 156",
  "226, 241, 255",
];

export default function DynamicHyperspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationId = 0;
    let lastScrollY = window.scrollY;
    let targetWarp = 0;
    let smoothWarp = 0;
    let direction = 1;

    const randomStreak = (): Streak => ({
      angle: Math.random() * Math.PI * 2,
      radius: 20 + Math.random() * Math.max(width, height) * 0.72,
      speed: 1.4 + Math.random() * 4.2,
      length: 140 + Math.random() * 320,
      width: 0.8 + Math.random() * 1.9,
      alpha: 0.55 + Math.random() * 0.8,
      color: palette[Math.floor(Math.random() * palette.length)],
    });

    let streaks: Streak[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      streaks = Array.from({ length: Math.round(Math.min(280, Math.max(150, width / 5))) }, randomStreak);
    };

    const impulse = (delta: number) => {
      if (Math.abs(delta) < 1) return;
      direction = delta >= 0 ? 1 : -1;
      targetWarp = Math.min(1, targetWarp + Math.min(Math.abs(delta) / 130, 1));
    };

    const onScroll = () => {
      const nextY = window.scrollY;
      impulse(nextY - lastScrollY);
      lastScrollY = nextY;
    };

    const onWheel = (event: WheelEvent) => {
      impulse(event.deltaY);
    };

    const draw = () => {
      smoothWarp += (targetWarp - smoothWarp) * 0.22;
      targetWarp *= 0.965;

      ctx.clearRect(0, 0, width, height);

      if (smoothWarp > 0.015) {
        const centerX = width * 0.5;
        const centerY = height * 0.63;
        const maxRadius = Math.hypot(width, height);

        ctx.save();
        ctx.globalCompositeOperation = "screen";

        for (const streak of streaks) {
          streak.radius += direction * streak.speed * (1.4 + smoothWarp * 14);

          if (streak.radius > maxRadius || streak.radius < 12) {
            streak.angle = Math.random() * Math.PI * 2;
            streak.radius = direction > 0 ? 12 + Math.random() * 70 : maxRadius * (0.78 + Math.random() * 0.2);
            streak.speed = 1.4 + Math.random() * 4.2;
            streak.length = 140 + Math.random() * 320;
            streak.width = 0.8 + Math.random() * 1.9;
            streak.alpha = 0.55 + Math.random() * 0.8;
            streak.color = palette[Math.floor(Math.random() * palette.length)];
          }

          const cos = Math.cos(streak.angle);
          const sin = Math.sin(streak.angle);
          const headX = centerX + cos * streak.radius;
          const headY = centerY + sin * streak.radius * 0.72;
          const tailDistance = streak.length * (0.55 + smoothWarp * 2.65);
          const tailX = headX - cos * tailDistance * direction;
          const tailY = headY - sin * tailDistance * 0.72 * direction;
          const opacity = Math.min(1, streak.alpha * Math.min(1, smoothWarp * 3.5));

          const gradient = ctx.createLinearGradient(tailX, tailY, headX, headY);
          gradient.addColorStop(0, `rgba(${streak.color}, 0)`);
          gradient.addColorStop(0.58, `rgba(${streak.color}, ${opacity * 0.34})`);
          gradient.addColorStop(1, `rgba(${streak.color}, ${opacity})`);

          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(headX, headY);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = streak.width * (1 + smoothWarp * 2.2);
          ctx.stroke();
        }

        const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.min(width, height) * 0.42);
        glow.addColorStop(0, `rgba(150, 185, 255, ${smoothWarp * 0.2})`);
        glow.addColorStop(0.34, `rgba(118, 97, 255, ${smoothWarp * 0.08})`);
        glow.addColorStop(1, "rgba(118, 97, 255, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        ctx.restore();
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  return <canvas className="dynamic-hyperspace" ref={canvasRef} aria-hidden="true" />;
}
