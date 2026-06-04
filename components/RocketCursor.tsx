"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  life: number; maxLife: number;
  r: number; g: number; b: number;
}
interface Streak {
  x: number; y: number;
  dx: number; dy: number;
  len: number;
  life: number; maxLife: number;
}
interface Shockwave {
  x: number; y: number;
  radius: number; maxRadius: number;
  life: number; maxLife: number;
  r: number; g: number; b: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LERP_ANGLE       = 0.55;  // snappier tilt response
const LERP_SCALE       = 0.50;
const VEL_SMOOTH       = 0.30;  // velocity smoothing (for tilt only, not position)
const MAX_TILT_DEG     = 10;
const PARTICLE_CAP     = 240;
const STREAK_SPEED     = 18;  // only at very fast flicks, not normal scrolling
const STREAK_EVERY     = 2;
const ROCKET_PIVOT_X   = 9;
const ROCKET_PIVOT_Y   = 4;
const ROCKET_EXHAUST_Y = 29.5;
const LAUNCH_DURATION  = 520;   // ms — fast & snappy
const WARP_IN_DURATION = 340;   // ms

export function RocketCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!window.matchMedia("(any-pointer: fine)").matches) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    const rocket = rocketRef.current;
    if (!canvas || !rocket) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    document.body.classList.add("rocket-cursor-active");

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
    let mouseX = -200, mouseY = -200;
    let prevMouseX = -200, prevMouseY = -200;  // for frame-to-frame delta
    let cursorX = -200, cursorY = -200;
    let smoothVelX = 0, smoothVelY = 0;        // smoothed velocity (tilt only)
    let speed = 0;
    let angle = 0;
    let targetAngle = 0;
    let isHovering = false;
    let hoverScale = 1;
    let hoverRingAlpha = 0;
    let animId: number;
    let frameCount = 0;

    // Exhaust position — updated every frame, read by click handler
    let exhaustX = -200, exhaustY = -200;

    // ── Launch state ──────────────────────────────────────────────────────────
    let isLaunching = false;
    let launchStartMs = 0;
    let launchFromX = 0, launchFromY = 0;
    let launchAngleStart = 0;

    // ── Warp-in state ─────────────────────────────────────────────────────────
    let isWarpingIn = false;
    let warpStartMs = 0;
    let warpBurstDone = false;

    const particles: Particle[]  = [];
    const streaks:   Streak[]    = [];
    const shockwaves: Shockwave[] = [];

    // ── Mouse tracking ────────────────────────────────────────────────────────
    // Only record coordinates here — hover check runs in rAF (throttled) so
    // elementFromPoint never blocks the mousemove event.
    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isLaunching) rocket.style.opacity = "1";
    };

    const onMouseLeave = () => {
      if (!isLaunching) rocket.style.opacity = "0";
    };

    document.addEventListener("mousemove",  onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);

    // ── Nav click → launch ────────────────────────────────────────────────────
    const onNavClick = (e: MouseEvent) => {
      if (isLaunching) return;
      const link = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      // Only intercept internal links
      if (!href || href.startsWith("#") || /^https?:/.test(href) || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      e.preventDefault();
      e.stopPropagation();

      isLaunching = true;
      isHovering  = false;
      launchStartMs    = performance.now();
      launchFromX      = cursorX;
      launchFromY      = cursorY;
      launchAngleStart = angle;

      // Shockwave burst at exhaust — immediate punch
      const sx = exhaustX > -100 ? exhaustX : launchFromX;
      const sy = exhaustY > -100 ? exhaustY : launchFromY + 25;
      shockwaves.push({ x: sx, y: sy, radius: 0, maxRadius: 100, life: 0, maxLife: 22, r: 255, g: 150, b: 50 });
      setTimeout(() => {
        shockwaves.push({ x: sx, y: sy, radius: 0, maxRadius: 165, life: 0, maxLife: 30, r: 255, g: 90, b: 15 });
      }, 55);

      setTimeout(() => {
        // Teleport cursor back to mouse so warp-in plays at cursor position
        cursorX = mouseX;
        cursorY = mouseY;
        // Reset velocity tracking — prevents spike on first frame of new page
        prevMouseX  = mouseX;
        prevMouseY  = mouseY;
        smoothVelX  = 0;
        smoothVelY  = 0;
        isLaunching  = false;
        isWarpingIn  = true;
        warpStartMs  = performance.now();
        warpBurstDone = false;
        routerRef.current.push(href);
      }, LAUNCH_DURATION);
    };

    document.addEventListener("click", onNavClick, true);

    // ── Animation loop ────────────────────────────────────────────────────────
    const draw = () => {
      frameCount++;
      const now = performance.now();

      ctx.clearRect(0, 0, W, H);

      // ── Position + angle update ───────────────────────────────────────────
      if (isLaunching) {
        const rawT = Math.min((now - launchStartMs) / LAUNCH_DURATION, 1);
        const eased = rawT * rawT;  // quadratic ease-in: feels snappy

        cursorX    = launchFromX;
        cursorY    = launchFromY - (launchFromY + 160) * eased;
        angle      = launchAngleStart * Math.max(0, 1 - rawT * 5);
        hoverScale = 1 + eased * 2.2;
        hoverRingAlpha = 0;
        speed = 0;
      } else {
        // Cursor follows mouse instantly — no position lag
        const rawVelX = mouseX - prevMouseX;
        const rawVelY = mouseY - prevMouseY;
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        cursorX = mouseX;
        cursorY = mouseY;

        // Smooth velocity separately — only used for tilt, not position
        smoothVelX += (rawVelX - smoothVelX) * VEL_SMOOTH;
        smoothVelY += (rawVelY - smoothVelY) * VEL_SMOOTH;
        speed = Math.sqrt(smoothVelX * smoothVelX + smoothVelY * smoothVelY);

        if (speed > 0.25) {
          const raw = Math.atan2(smoothVelX, -smoothVelY) * (180 / Math.PI);
          const tiltBlend = Math.min(speed / 8, 1);
          targetAngle = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, raw)) * tiltBlend;
        } else {
          targetAngle *= 0.72;
        }
        angle      += (targetAngle - angle) * LERP_ANGLE;
        hoverScale += ((isHovering ? 1.28 : 1) - hoverScale) * LERP_SCALE;
        hoverRingAlpha += ((isHovering ? 1 : 0) - hoverRingAlpha) * 0.10;

        // Hover check — runs in rAF every 3 frames so elementFromPoint never
        // blocks mousemove. ~50ms cadence at 60fps, imperceptible to users.
        // Check hover every 4 frames (~66ms at 60fps). Pure DOM closest()
        // — no getComputedStyle, no style recalc, much cheaper on busy pages.
        if (frameCount % 4 === 0) {
          const el = document.elementFromPoint(mouseX, mouseY) as HTMLElement | null;
          isHovering = !!el?.closest("a, button, [role='button'], [data-cursor-hover]");
        }
      }

      // ── Rocket element ────────────────────────────────────────────────────
      // exhaustOffset is computed first so the tilt-correction translate can
      // use it — this keeps the engine bell pinned to cursorX regardless of
      // how much the rocket leans. The nose tips left/right; the bottom never drifts.
      const exhaustOffset = (ROCKET_EXHAUST_Y - ROCKET_PIVOT_Y) * hoverScale;
      const tiltCorrX = Math.sin(angle * (Math.PI / 180)) * exhaustOffset;
      rocket.style.transform =
        `translate(${cursorX - ROCKET_PIVOT_X + tiltCorrX}px, ${cursorY - ROCKET_PIVOT_Y}px) rotate(${angle}deg) scale(${hoverScale})`;
      // Only write filter when it actually changes — avoids redundant GPU work
      const nextFilter = (isHovering || isLaunching)
        ? "drop-shadow(0 0 5px rgba(255,200,120,0.9)) drop-shadow(0 0 14px rgba(255,140,40,0.4))"
        : "drop-shadow(0 0 2.5px rgba(255,220,160,0.5))";
      if (rocket.style.filter !== nextFilter) rocket.style.filter = nextFilter;

      // ── Engine plume ──────────────────────────────────────────────────────
      // Engine is geometrically pinned to cursorX by the tilt correction above,
      // so the canvas flame at (cursorX, cursorY+exhaustOffset) is always
      // pixel-perfect at the engine bell — on every page, at every speed.
      exhaustX = cursorX;
      exhaustY = cursorY + exhaustOffset;
      const pDirX = 0;   // always straight down
      const pDirY = 1;
      const perpX = 1;   // horizontal cone spread
      const perpY = 0;

      let launchBoost = 0;
      if (isLaunching) {
        const rawT = Math.min((now - launchStartMs) / LAUNCH_DURATION, 1);
        launchBoost = rawT * rawT * 260;
      }
      const plumeLen = 14 + Math.min(speed * 3.8, 52) + launchBoost;
      const tipX = exhaustX + pDirX * plumeLen;
      const tipY = exhaustY + pDirY * plumeLen;

      const flicker  = 0.88 + 0.12 * Math.sin(frameCount * 0.23);
      const flutter  = 0.90 + 0.10 * Math.sin(frameCount * 0.15 + 1.7);
      const plumeStr = isLaunching
        ? Math.min(0.45 + Math.min((now - launchStartMs) / LAUNCH_DURATION, 1) * 0.55, 1.0)
        : 0.45 + Math.min(speed / 8, 1) * 0.55;

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

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Base plume — always present
      drawCone(6.5, 255,  55,  8,  0.18, flutter);
      drawCone(3.2, 255, 145, 20,  0.55);
      drawCone(1.5, 255, 235, 130, 0.95);
      // Launch boost — wide outer flame that grows with acceleration
      if (isLaunching) {
        const boost = Math.min((now - launchStartMs) / LAUNCH_DURATION, 1);
        const b2 = boost * boost;
        drawCone(16 * b2, 255,  75, 10, 0.22 * b2, 1);
        drawCone( 9 * b2, 255, 165, 45, 0.38 * b2, 1);
      }
      ctx.restore();

      // Nozzle bloom
      const bellGlow = ctx.createRadialGradient(exhaustX, exhaustY, 0, exhaustX, exhaustY, 7);
      bellGlow.addColorStop(0,    `rgba(255, 245, 200, ${0.80 * plumeStr * flicker})`);
      bellGlow.addColorStop(0.45, `rgba(255, 160,  50, ${0.35 * plumeStr * flicker})`);
      bellGlow.addColorStop(1,     "rgba(255,  80,  10, 0)");
      ctx.beginPath();
      ctx.arc(exhaustX, exhaustY, 7, 0, Math.PI * 2);
      ctx.fillStyle = bellGlow;
      ctx.fill();

      // ── Exhaust particles (launch only) ───────────────────────────────────
      // During normal movement, particles from prior frames drift left/right
      // of the current cursor and create a misleading off-center glow blob.
      // Particles are only emitted during launch where the effect is intentional.
      const emitCount = isLaunching ? 5 : 0;
      if (particles.length < PARTICLE_CAP && emitCount > 0) {
        for (let i = 0; i < emitCount; i++) {
          const driftSpd = 0.10 + Math.random() * 0.45;
          particles.push({
            x:       tipX + (Math.random() - 0.5) * 4,
            y:       tipY + (Math.random() - 0.5) * 4,
            vx:      pDirX * driftSpd + (Math.random() - 0.5) * 0.12,
            vy:      pDirY * driftSpd + (Math.random() - 0.5) * 0.12,
            size:    0.38 + Math.random() * 2.5,
            life:    0,
            maxLife: 28 + Math.random() * 22,
            r:       255,
            g:       110 + Math.floor(Math.random() * 70),
            b:        10 + Math.floor(Math.random() * 30),
          });
        }
      }

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

      // ── Warp streaks (high-speed motion blur) ─────────────────────────────
      if (!isLaunching && speed > STREAK_SPEED && frameCount % STREAK_EVERY === 0) {
        const count = Math.min(Math.floor(speed / STREAK_EVERY), 3);
        for (let s = 0; s < count; s++) {
          const scatter = (Math.random() - 0.5) * 5;
          streaks.push({
            x:   cursorX + scatter,
            y:   cursorY + scatter,
            dx:  -(smoothVelX / speed),
            dy:  -(smoothVelY / speed),
            len: speed * 2.5 + 10 + Math.random() * 12,
            life: 0,
            maxLife: 8 + Math.random() * 6,
          });
        }
      }

      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.life++;
        if (s.life >= s.maxLife) { streaks.splice(i, 1); continue; }

        const t  = 1 - s.life / s.maxLife;
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

      // ── Shockwaves ────────────────────────────────────────────────────────
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life++;
        if (sw.life >= sw.maxLife) { shockwaves.splice(i, 1); continue; }

        const t = sw.life / sw.maxLife;
        sw.radius = sw.maxRadius * (1 - (1 - t) * (1 - t)); // ease-out expansion
        const alpha = (1 - t) * (1 - t) * 0.72;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${sw.r}, ${sw.g}, ${sw.b}, ${alpha})`;
        ctx.lineWidth = 2.5 * (1 - t) + 0.5;
        ctx.stroke();
        ctx.restore();
      }

      // ── Warp-in arrival burst ─────────────────────────────────────────────
      if (isWarpingIn) {
        const warpT = (now - warpStartMs) / WARP_IN_DURATION;
        if (warpT >= 1) {
          isWarpingIn = false;
        } else if (!warpBurstDone) {
          warpBurstDone = true;
          // Ring of blue-white particles radiating outward
          for (let i = 0; i < 32; i++) {
            const a = (i / 32) * Math.PI * 2;
            const spd = 2.8 + Math.random() * 4.2;
            particles.push({
              x:       cursorX,
              y:       cursorY,
              vx:      Math.cos(a) * spd,
              vy:      Math.sin(a) * spd,
              size:    0.9 + Math.random() * 1.4,
              life:    0,
              maxLife: 18 + Math.random() * 14,
              r:       170 + Math.floor(Math.random() * 85),
              g:       200 + Math.floor(Math.random() * 55),
              b:       255,
            });
          }
          // Blue-white shockwaves — double ring for depth
          shockwaves.push({ x: cursorX, y: cursorY, radius: 0, maxRadius:  70, life: 0, maxLife: 16, r: 160, g: 200, b: 255 });
          shockwaves.push({ x: cursorX, y: cursorY, radius: 0, maxRadius: 115, life: 0, maxLife: 26, r: 140, g: 180, b: 255 });
        }
      }

      // ── Hover ring ────────────────────────────────────────────────────────
      if (hoverRingAlpha > 0.015) {
        const ring = ctx.createRadialGradient(cursorX, cursorY, 14, cursorX, cursorY, 22);
        ring.addColorStop(0, `rgba(180, 210, 255, ${hoverRingAlpha * 0.28})`);
        ring.addColorStop(1,  "rgba(180, 210, 255, 0)");
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

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else animId = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(animId);
      document.body.classList.remove("rocket-cursor-active");
      window.removeEventListener("resize",          onResize);
      document.removeEventListener("mousemove",     onMouseMove);
      document.removeEventListener("mouseleave",    onMouseLeave);
      document.removeEventListener("click",         onNavClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <>
      {/* Trail + shockwave canvas — full-screen, non-interactive */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
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
          transformOrigin: `${ROCKET_PIVOT_X}px ${ROCKET_PIVOT_Y}px`,
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
