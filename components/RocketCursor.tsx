"use client";

import { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

// Stardust particle — emitted from engine bell, drifts + fades
interface Particle {
  x: number; y: number;
  vx: number; vy: number;      // gentle drift
  size: number;                // radius 0.4–2.0px
  life: number; maxLife: number;
  r: number; g: number; b: number;  // pre-baked color
}
interface Streak {
  x: number; y: number;
  dx: number; dy: number;   // unit vector, backward direction
  len: number;
  life: number; maxLife: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LERP_POS        = 0.16;  // cursor smoothing
const LERP_ANGLE      = 0.10;  // tilt smoothing
const LERP_SCALE      = 0.11;  // hover scale smoothing
const MAX_TILT_DEG    = 28;    // max rocket tilt degrees
const PARTICLE_CAP    = 160;   // max live particles
const STREAK_SPEED    = 7;     // min px/frame to spawn warp streaks
const STREAK_EVERY    = 2;     // spawn streaks every N frames

export function RocketCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ── Guard: disable only when NO fine pointer is available ────────────────
    // Use any-pointer, not pointer — iPad with Magic Keyboard has a fine trackpad
    // as a secondary input even though its primary pointer is touch (coarse).
    if (!window.matchMedia("(any-pointer: fine)").matches) return;

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

    const particles: Particle[] = [];
    const streaks: Streak[] = [];

    // ── Mouse tracking ────────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      // Reveal rocket on first move — mouseenter only fires when re-entering
      // from outside the viewport, missing the common already-on-page case.
      rocket.style.opacity = "1";

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

    const onMouseLeave = () => { rocket.style.opacity = "0"; };

    document.addEventListener("mousemove",  onMouseMove);
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
        ? "drop-shadow(0 0 5px rgba(255,200,120,0.9)) drop-shadow(0 0 14px rgba(255,140,40,0.4))"
        : "drop-shadow(0 0 2.5px rgba(255,220,160,0.5))";

      // ── Canvas: trail + streaks ───────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      if (!prefersReduced) {
        // ── Engine plume ──────────────────────────────────────────────────────
        // Direction vectors along the plume axis.
        // CSS rotate(θ) matrix: x' = x·cos-y·sin, y' = x·sin+y·cos
        // Engine bell is at SVG (9,29), pivot at (9,4) → local offset (0, 25).
        // After rotate(θ): engine offset = (-sin(θ)·25, cos(θ)·25)
        // So the plume exits toward (-sin, +cos), NOT (+sin, +cos).
        const rad    = angle * (Math.PI / 180);
        const pDirX  = -Math.sin(rad);   // plume direction: opposite x of nose lean
        const pDirY  =  Math.cos(rad);   // always downward (engine is below nose)
        const perpX  =  Math.cos(rad);   // perpendicular to plume axis (dot = 0 ✓)
        const perpY  =  Math.sin(rad);

        // Engine bell sits 22px behind the nose along the plume axis
        const exhaustX = cursorX + pDirX * 22;
        const exhaustY = cursorY + pDirY * 22;

        // Plume tip: always some length at idle, extends with speed
        const plumeLen = 14 + Math.min(speed * 3.8, 52);
        const tipX = exhaustX + pDirX * plumeLen;
        const tipY = exhaustY + pDirY * plumeLen;

        // Subtle flicker — makes the flame feel alive even when still
        const flicker = 0.88 + 0.12 * Math.sin(frameCount * 0.23);
        const flutter = 0.90 + 0.10 * Math.sin(frameCount * 0.15 + 1.7);
        // Overall brightness: always on at 45%, grows to 100% when moving
        const plumeStr = 0.45 + Math.min(speed / 8, 1) * 0.55;

        // Helper: draw one triangular plume cone with a linear gradient fill
        const drawCone = (hw: number, r: number, g: number, b: number, baseOp: number, flic = flicker) => {
          const lx = exhaustX + perpX * hw;
          const ly = exhaustY + perpY * hw;
          const rx = exhaustX - perpX * hw;
          const ry = exhaustY - perpY * hw;
          const grad = ctx.createLinearGradient(exhaustX, exhaustY, tipX, tipY);
          grad.addColorStop(0,    `rgba(${r},${g},${b},${baseOp * plumeStr * flic})`);
          grad.addColorStop(0.35, `rgba(${r},${g},${b},${baseOp * 0.38 * plumeStr * flic})`);
          grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(rx, ry);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
        };

        // Additive blending so layers brighten where they overlap — hot core
        // naturally emerges where all three cones stack up
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // Layer 1 — outer flame envelope: wide, deep orange-red
        drawCone(6.5, 255,  55,  8,  0.18, flutter);
        // Layer 2 — main flame body: bright orange
        drawCone(3.2, 255, 145, 20,  0.55);
        // Layer 3 — inner hot core: yellow-white (hottest combustion zone)
        drawCone(1.5, 255, 235, 130, 0.95);

        ctx.restore();

        // Nozzle bloom — warm white glow right at the engine bell
        const bellGlow = ctx.createRadialGradient(exhaustX, exhaustY, 0, exhaustX, exhaustY, 7);
        bellGlow.addColorStop(0,    `rgba(255, 245, 200, ${0.80 * plumeStr * flicker})`);
        bellGlow.addColorStop(0.45, `rgba(255, 160,  50, ${0.35 * plumeStr * flicker})`);
        bellGlow.addColorStop(1,     "rgba(255,  80,  10, 0)");
        ctx.beginPath();
        ctx.arc(exhaustX, exhaustY, 7, 0, Math.PI * 2);
        ctx.fillStyle = bellGlow;
        ctx.fill();

        // ── Exhaust trail particles ────────────────────────────────────────────
        // Emitted from the plume TIP (not the nozzle) — these are cooling exhaust
        // gases drifting away, not hot combustion. Sparse so the shaped plume
        // remains the hero.
        if (speed > 0.7 && particles.length < PARTICLE_CAP) {
          const emitCount = speed > 5 ? 2 : 1;
          for (let i = 0; i < emitCount; i++) {
            const driftSpd = 0.10 + Math.random() * 0.13;
            particles.push({
              x:       tipX + (Math.random() - 0.5) * 3,
              y:       tipY + (Math.random() - 0.5) * 3,
              vx:      pDirX * driftSpd + (Math.random() - 0.5) * 0.10,
              vy:      pDirY * driftSpd + (Math.random() - 0.5) * 0.10,
              size:    0.38 + Math.random() * 0.80,
              life:    0,
              maxLife: 28 + Math.random() * 22,
              r:       255,
              g:       110 + Math.floor(Math.random() * 70),
              b:        10 + Math.floor(Math.random() * 30),
            });
          }
        }

        // Update + draw trail particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life++;
          if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }

          const t  = p.life / p.maxLife;
          const op = Math.sin(t * Math.PI) * 0.52 * Math.min(p.size / 0.9, 1);
          if (op < 0.015) continue;

          const glowR = p.size * 3;
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
          grd.addColorStop(0,    `rgba(${p.r},${p.g},${p.b},${op * 0.78})`);
          grd.addColorStop(0.38, `rgba(${p.r},${p.g},${p.b},${op * 0.20})`);
          grd.addColorStop(1,    `rgba(${p.r},${p.g},${p.b},0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.36, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${Math.min(p.r+10,255)},${Math.min(p.g+60,255)},${Math.min(p.b+20,255)},${op})`;
          ctx.fill();
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
      document.body.classList.remove("rocket-cursor-active");
      window.removeEventListener("resize",    onResize);
      document.removeEventListener("mousemove",  onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibility);
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

          {/* ── Thruster exhaust glow ── very subtle warm orange */}
          <ellipse cx="9" cy="29.5" rx="4" ry="1.5" fill="rgba(255,130,50,0.18)" />

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
