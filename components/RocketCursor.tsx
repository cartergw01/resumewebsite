"use client";

import { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrailPoint { x: number; y: number; age: number }
interface Streak {
  x: number; y: number;
  dx: number; dy: number;   // unit vector, backward direction
  len: number;
  life: number; maxLife: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LERP_POS        = 0.16;  // cursor smoothing — feels responsive, not laggy
const LERP_ANGLE      = 0.10;  // tilt smoothing
const LERP_SCALE      = 0.11;  // hover scale smoothing
const MAX_TILT_DEG    = 28;    // max degrees the rocket tilts during fast movement
const TRAIL_MAX       = 28;    // max trail points stored
const TRAIL_MAX_AGE   = 30;    // frames until a trail point fully fades
const STREAK_SPEED    = 7;     // min smoothed px/frame to spawn streaks
const STREAK_EVERY    = 2;     // only spawn streaks every N frames (perf)

export function RocketCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ── Guard: touch devices get no custom cursor ─────────────────────────────
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = canvasRef.current;
    const rocket = rocketRef.current;
    if (!canvas || !rocket) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Hide system cursor ────────────────────────────────────────────────────
    document.body.classList.add("rocket-cursor-active");

    // ── Canvas sizing ─────────────────────────────────────────────────────────
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener("resize", onResize);

    // ── State ─────────────────────────────────────────────────────────────────
    let mouseX = -200, mouseY = -200;  // raw — off screen until first move
    let cursorX = -200, cursorY = -200;
    let prevX = -200, prevY = -200;
    let velX = 0, velY = 0;
    let speed = 0;
    let angle = 0;
    let targetAngle = 0;
    let isHovering = false;
    let hoverScale = 1;
    let hoverRingAlpha = 0;
    let animId: number;
    let frameCount = 0;

    const trail: TrailPoint[] = [];
    const streaks: Streak[] = [];

    // ── Mouse tracking ────────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Detect interactive element under cursor
      const el = document.elementFromPoint(mouseX, mouseY) as HTMLElement | null;
      if (el) {
        const style = window.getComputedStyle(el);
        isHovering =
          style.cursor === "pointer" ||
          !!el.closest("a, button, [role='button'], [data-cursor-hover]");
      } else {
        isHovering = false;
      }
    };

    const onMouseEnter = () => { rocket.style.opacity = "1"; };
    const onMouseLeave = () => { rocket.style.opacity = "0"; };

    document.addEventListener("mousemove",  onMouseMove);
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("mouseleave", onMouseLeave);

    // ── Animation loop ────────────────────────────────────────────────────────
    const draw = () => {
      frameCount++;

      // Smooth position
      prevX   = cursorX;
      prevY   = cursorY;
      cursorX += (mouseX - cursorX) * LERP_POS;
      cursorY += (mouseY - cursorY) * LERP_POS;

      velX  = cursorX - prevX;
      velY  = cursorY - prevY;
      speed = Math.sqrt(velX * velX + velY * velY);

      // Tilt: atan2(velX, -velY) gives 0° when moving up, +° when moving right
      if (speed > 0.25) {
        const raw = Math.atan2(velX, -velY) * (180 / Math.PI);
        const tiltBlend = Math.min(speed / 10, 1);
        targetAngle = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, raw)) * tiltBlend;
      } else {
        targetAngle *= 0.85; // drift back to vertical when still
      }
      angle += (targetAngle - angle) * LERP_ANGLE;

      // Hover scale + ring
      hoverScale    += ((isHovering ? 1.28 : 1) - hoverScale)    * LERP_SCALE;
      hoverRingAlpha += ((isHovering ? 1 : 0) - hoverRingAlpha) * 0.10;

      // ── Rocket element transform ─────────────────────────────────────────
      // SVG: 18×34 viewBox. Nose tip is at (9, 1).
      // translate so SVG point (9, 4) sits at cursor → nose ~3px above pointer.
      rocket.style.transform =
        `translate(${cursorX - 9}px, ${cursorY - 4}px) rotate(${angle}deg) scale(${hoverScale})`;
      rocket.style.filter = isHovering
        ? "drop-shadow(0 0 5px rgba(180,210,255,0.9)) drop-shadow(0 0 14px rgba(100,160,255,0.4))"
        : "drop-shadow(0 0 2.5px rgba(180,200,255,0.42))";

      // ── Canvas: trail + streaks ───────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      if (!prefersReduced) {
        // Engine exhaust origin — directly behind nose in movement direction
        // (accounts for rocket tilt so exhaust appears from engine bell)
        const rad = angle * (Math.PI / 180);
        const exhaustX = cursorX + Math.sin(rad) * 22;
        const exhaustY = cursorY + Math.cos(rad) * 22;

        // Add trail point when moving
        if (speed > 0.5) {
          trail.push({ x: exhaustX, y: exhaustY, age: 0 });
          if (trail.length > TRAIL_MAX) trail.shift();
        }

        // Age trail
        for (let i = trail.length - 1; i >= 0; i--) {
          trail[i].age++;
          if (trail[i].age > TRAIL_MAX_AGE) trail.splice(i, 1);
        }

        // Draw trail — thin tapering line, cold blue-white, fades with age + speed
        if (trail.length > 1) {
          const speedFade = Math.min(speed / 5, 1);
          for (let i = 1; i < trail.length; i++) {
            const p0 = trail[i - 1];
            const p1 = trail[i];
            const t0 = 1 - p0.age / TRAIL_MAX_AGE;
            const t1 = 1 - p1.age / TRAIL_MAX_AGE;
            const avg = (t0 + t1) / 2;
            if (avg < 0.02) continue;

            const op = avg * avg * 0.38 * speedFade;
            const lw = Math.max(0.3, avg * 1.5 * speedFade);

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.strokeStyle = `rgba(190, 215, 255, ${op})`;
            ctx.lineWidth = lw;
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }

        // Spawn warp streaks above speed threshold
        if (speed > STREAK_SPEED && frameCount % STREAK_EVERY === 0) {
          const count = Math.min(Math.floor(speed / STREAK_EVERY), 3);
          for (let s = 0; s < count; s++) {
            const scatter = (Math.random() - 0.5) * 5;
            streaks.push({
              x:   cursorX + scatter,
              y:   cursorY + scatter,
              dx:  -(velX / speed),   // unit vector pointing backward
              dy:  -(velY / speed),
              len: speed * 2.5 + 10 + Math.random() * 12,
              life: 0,
              maxLife: 8 + Math.random() * 6,
            });
          }
        }

        // Age + draw streaks
        for (let i = streaks.length - 1; i >= 0; i--) {
          const s = streaks[i];
          s.life++;
          if (s.life >= s.maxLife) { streaks.splice(i, 1); continue; }

          const t = 1 - s.life / s.maxLife;
          const op = t * t * 0.48;
          if (op < 0.02) continue;

          const ex = s.x + s.dx * s.len;
          const ey = s.y + s.dy * s.len;

          const sg = ctx.createLinearGradient(s.x, s.y, ex, ey);
          sg.addColorStop(0, `rgba(210, 230, 255, ${op})`);
          sg.addColorStop(1,  "rgba(210, 230, 255, 0)");

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = sg;
          ctx.lineWidth = 0.55 + t * 0.65;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // Hover ring — thin scan circle that fades in/out on interactive elements
        if (hoverRingAlpha > 0.015) {
          const ring = ctx.createRadialGradient(
            cursorX, cursorY, 14,
            cursorX, cursorY, 22
          );
          ring.addColorStop(0, `rgba(180, 210, 255, ${hoverRingAlpha * 0.28})`);
          ring.addColorStop(1, "rgba(180, 210, 255, 0)");
          ctx.beginPath();
          ctx.arc(cursorX, cursorY, 18, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(200, 220, 255, ${hoverRingAlpha * 0.22})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cursorX, cursorY, 18, 0, Math.PI * 2);
          ctx.fillStyle = ring;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      document.body.classList.remove("rocket-cursor-active");
      window.removeEventListener("resize",    onResize);
      document.removeEventListener("mousemove",  onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <>
      {/* Trail + streak canvas — full-screen, non-interactive */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 9998,
          pointerEvents: "none",
        }}
      />

      {/* Rocket — NASA/SpaceX minimal silhouette */}
      <div
        ref={rocketRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 9999,
          pointerEvents: "none",
          willChange: "transform, filter",
          transformOrigin: "9px 4px",   // pivot near the nose tip
          opacity: 0,
          transition: "opacity 0.18s ease",
        }}
      >
        {/*
          SVG: 18 × 34 viewBox
          Nose tip: (9, 1)   ← actual pointer hotspot offset
          Layer order: fins → engine → body → nosecone → details → cockpit
        */}
        <svg
          width="18"
          height="34"
          viewBox="0 0 18 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* ── Fins ── drawn first so body sits on top */}
          <path d="M4.5 19.5 L0.5 28.5 L4.5 23 Z"   fill="#b8c8e2" />
          <path d="M13.5 19.5 L17.5 28.5 L13.5 23 Z" fill="#b8c8e2" />

          {/* ── Engine bell ── trapezoid below body */}
          <path d="M6.5 22 L5.2 29 L12.8 29 L11.5 22 Z" fill="#8da0be" />

          {/* ── Thruster exhaust glow ── very subtle */}
          <ellipse cx="9" cy="29.5" rx="4" ry="1.5" fill="rgba(70,120,255,0.16)" />

          {/* ── Main body ── */}
          <rect x="3.5" y="12.5" width="11" height="9.5" rx="1.2" fill="#ecf1ff" />

          {/* ── Nose-to-body transition (fills the gap) ── */}
          <rect x="4.2" y="10.5" width="9.6" height="3" fill="#ecf1ff" />

          {/* ── Nose cone ── */}
          <path d="M9 1 L13.8 11.5 L4.2 11.5 Z" fill="#f5f8ff" />

          {/* ── Nose left bevel highlight ── */}
          <path d="M9 1 L6.8 7.5 L8.4 11.5 L9 11.5 Z" fill="white" fillOpacity="0.2" />

          {/* ── Body left edge highlight ── */}
          <rect x="3.5" y="12.5" width="2.2" height="9.5" rx="0.6"
                fill="white" fillOpacity="0.13" />

          {/* ── Body right edge shadow ── */}
          <rect x="12.3" y="12.5" width="2.2" height="9.5" rx="0.6"
                fill="black" fillOpacity="0.07" />

          {/* ── Cockpit window ── dark navy oval */}
          <ellipse cx="9" cy="11" rx="2.7" ry="3.4"
                   fill="#0c1e50" fillOpacity="0.9" />

          {/* ── Cockpit lens gradient ── */}
          <ellipse cx="8.1" cy="10" rx="1.2" ry="1.5"
                   fill="#4878d8" fillOpacity="0.45" />

          {/* ── Cockpit specular ── tiny bright highlight */}
          <ellipse cx="7.55" cy="9.45" rx="0.48" ry="0.55"
                   fill="white" fillOpacity="0.38" />

          {/* ── Hull center line ── very subtle seam */}
          <line x1="9" y1="1.5" x2="9" y2="12" stroke="white" strokeOpacity="0.07" strokeWidth="0.5" />
        </svg>
      </div>
    </>
  );
}
