"use client";

import { useEffect, useRef } from "react";

type Star = {
  angle: number;
  radius: number;
  depth: number;
  size: number;
  hue: number;
  alpha: number;
  drift: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function makeStar(): Star {
  return {
    angle: Math.random() * Math.PI * 2,
    radius: Math.pow(Math.random(), 0.7),
    depth: 0.24 + Math.random() * 0.86,
    size: 0.35 + Math.random() * 0.85,
    hue: 210 + Math.random() * 28,
    alpha: 0.12 + Math.random() * 0.24,
    drift: 0.72 + Math.random() * 0.76,
  };
}

function project(star: Star, width: number, height: number) {
  const focal = Math.max(width, height) * 0.58;
  const maxRadius = Math.max(width, height) * 0.72;
  const centerX = width * 0.5;
  const centerY = height * 0.49;
  const distance = (star.radius * maxRadius) / Math.max(star.depth, 0.16);

  return {
    x: centerX + Math.cos(star.angle) * distance,
    y: centerY + Math.sin(star.angle) * distance,
    scale: clamp(focal / (star.depth * focal), 0.6, 4.8),
  };
}

export default function SpaceDrift() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastScrollY = window.scrollY;
    let targetSpeed = 0;
    let speed = 0.12;
    let journeyHue = 222;
    let targetHue = 222;
    let journeyDepth = 0.4;
    let phase = 0;
    let stars: Star[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = clamp(Math.floor((width * height) / 9800), 70, 180);
      stars = Array.from({ length: count }, makeStar);
    };

    const resetStar = (star: Star) => {
      const next = makeStar();
      star.angle = next.angle;
      star.radius = next.radius;
      star.depth = 1.08;
      star.size = next.size;
      star.hue = next.hue;
      star.alpha = next.alpha;
      star.drift = next.drift;
    };

    const onScroll = () => {
      const nextScrollY = window.scrollY;
      const delta = Math.abs(nextScrollY - lastScrollY);
      lastScrollY = nextScrollY;
      targetSpeed = Math.max(targetSpeed, clamp(delta * 0.014, 0, 1.1));
    };

    const onJourney = (event: Event) => {
      const detail = (event as CustomEvent<{ world?: string; velocity?: number; presence?: number }>).detail;
      const worldHue: Record<string, number> = {
        home: 222,
        work: 214,
        writing: 262,
        projects: 184,
        life: 34,
      };

      targetHue = worldHue[detail.world || "home"] ?? 222;
      journeyDepth = clamp(detail.presence ?? journeyDepth, 0, 1);
      targetSpeed = Math.max(targetSpeed, clamp((detail.velocity ?? 0) * 0.72, 0, 0.95));
    };

    const drawJourneyCurrents = (glow: number) => {
      const intensity = clamp(journeyDepth * 0.035 + glow * 0.035, 0, 0.055);
      if (intensity <= 0.03) return;

      context.save();
      context.globalAlpha = intensity;
      context.lineCap = "round";

      for (let index = 0; index < 2; index += 1) {
        const y = height * (0.26 + index * 0.15) + Math.sin(phase * 0.9 + index) * 18;
        const startX = width * (0.08 + index * 0.035);
        const endX = width * (0.92 - index * 0.025);
        const controlA = width * (0.26 + Math.sin(phase * 0.45 + index) * 0.05);
        const controlB = width * (0.72 + Math.cos(phase * 0.38 + index) * 0.05);
        const controlY = y + Math.sin(phase * 0.7 + index * 1.7) * height * 0.11;

        context.beginPath();
        context.moveTo(startX, y);
        context.bezierCurveTo(controlA, controlY, controlB, y - controlY * 0.08, endX, y + Math.cos(phase + index) * 12);
        context.setLineDash([1.5, 18 + index * 5]);
        context.lineDashOffset = -(phase * 18 + index * 36);
        context.strokeStyle = `hsla(${journeyHue}, 42%, ${72 - index * 4}%, ${0.22 - index * 0.04})`;
        context.lineWidth = 0.35 + index * 0.08;
        context.stroke();
      }

      context.restore();
      context.setLineDash([]);
    };

    const draw = () => {
      if (motionQuery.matches) {
        context.clearRect(0, 0, width, height);
        frame = window.requestAnimationFrame(draw);
        return;
      }

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "screen";

      speed += (0.08 + targetSpeed - speed) * 0.06;
      targetSpeed *= 0.86;
      journeyHue += (targetHue - journeyHue) * 0.035;
      phase += 0.004 + speed * 0.0025;

      const travel = 0.00065 + speed * 0.0018 + journeyDepth * 0.00028;
      const glow = Math.min(speed / 4.4, 0.42);

      drawJourneyCurrents(glow);

      stars.forEach((star) => {
        const previous = project(star, width, height);
        star.depth -= travel * star.drift;
        if (star.depth < 0.16) resetStar(star);
        const current = project(star, width, height);

        if (
          current.x < -80 ||
          current.x > width + 80 ||
          current.y < -80 ||
          current.y > height + 80
        ) {
          resetStar(star);
          return;
        }

        const alpha = star.alpha * (0.18 + glow * 0.2);
        const radius = star.size * current.scale * (0.26 + glow * 0.06);
        const trailStrength = clamp((speed - 0.72) / 2.6, 0, 0.18);

        if (trailStrength > 0.04) {
          const tailX = current.x + (previous.x - current.x) * 0.38;
          const tailY = current.y + (previous.y - current.y) * 0.38;
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(current.x, current.y);
          context.strokeStyle = `hsla(${(star.hue + journeyHue) / 2}, 48%, 80%, ${alpha * trailStrength * 0.22})`;
          context.lineWidth = clamp(radius * 0.22, 0.2, 0.55);
          context.stroke();
        }

        context.beginPath();
        context.arc(current.x, current.y, clamp(radius, 0.35, 2.4), 0, Math.PI * 2);
        context.fillStyle = `hsla(${(star.hue * 2 + journeyHue) / 3}, 46%, 86%, ${alpha})`;
        context.fill();
      });

      context.globalCompositeOperation = "source-over";
      frame = window.requestAnimationFrame(draw);
    };

    resize();
    onScroll();
    draw();

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("cosmic-journey", onJourney);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("cosmic-journey", onJourney);
    };
  }, []);

  return <canvas ref={canvasRef} className="space-drift-canvas" aria-hidden="true" />;
}
