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

const LERP_ANGLE       = 0.78;  // fast tilt response
const LERP_SCALE       = 0.68;  // fast hover scale
const VEL_SMOOTH       = 0.52;  // velocity smoothing (for tilt only, not position)
const MAX_TILT_DEG     = 10;
const PARTICLE_CAP     = 240;
const STREAK_SPEED     = 18;  // only at very fast flicks, not normal scrolling
const STREAK_EVERY     = 2;
const ROCKET_PIVOT_X   = 9;
const ROCKET_PIVOT_Y   = 4;
const ROCKET_EXHAUST_Y = 29.5;
const LAUNCH_DURATION  = 330;   // ms — brisk, but long enough to read as a launch
const TOUCH_LAUNCH_DURATION = 290;  // ms — still responsive on taps without feeling rushed
const WARP_IN_DURATION = 280;   // ms
const ROCKET_OPACITY_TRANSITION = "opacity 0.08s ease-out";

type WorldAsset = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  height: number;
  width: number;
};

const WORLD_ASSET_URLS = [
  "/world-work-cutout-v1.webp",
  "/world-writing-cutout-v1.webp",
  "/world-projects-cutout-v2.webp",
];

const worldAssetCache = new Map<string, WorldAsset>();
const worldAssetLoads = new Map<string, Promise<void>>();

function absoluteAssetUrl(url: string) {
  return new URL(url, window.location.href).href;
}

function backgroundImageUrl(value: string) {
  const match = value.match(/url\((['"]?)(.*?)\1\)/);
  return match?.[2] ? absoluteAssetUrl(match[2]) : null;
}

function loadWorldAsset(url: string) {
  const absoluteUrl = absoluteAssetUrl(url);
  if (worldAssetCache.has(absoluteUrl)) return;
  if (worldAssetLoads.has(absoluteUrl)) return;

  const load = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        worldAssetCache.set(absoluteUrl, {
          canvas,
          ctx,
          height: img.naturalHeight,
          width: img.naturalWidth,
        });
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = absoluteUrl;
  });

  worldAssetLoads.set(absoluteUrl, load);
}

function cssLength(value: string, basis: number, natural: number) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "auto") return natural;
  if (trimmed.endsWith("%")) return basis * (Number.parseFloat(trimmed) / 100);
  if (trimmed.endsWith("px")) return Number.parseFloat(trimmed);
  const numeric = Number.parseFloat(trimmed);
  return Number.isFinite(numeric) ? numeric : natural;
}

function isModifiedNavigationClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

function internalRouteHref(link: HTMLAnchorElement) {
  const href = link.getAttribute("href") ?? "";
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  if (link.hasAttribute("download")) return null;
  if (link.target && link.target !== "_self") return null;

  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return null;

  const samePath = url.pathname === window.location.pathname;
  const sameSearch = url.search === window.location.search;
  if (samePath && sameSearch && url.hash) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

function externalNavigationHref(link: HTMLAnchorElement) {
  const href = link.getAttribute("href") ?? "";
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  if (link.hasAttribute("download")) return null;
  if (link.target && link.target !== "_self") return null;

  const url = new URL(href, window.location.href);
  return url.origin === window.location.origin ? null : url.href;
}

function isOpaqueWorldOrbClick(link: HTMLAnchorElement, clientX: number, clientY: number) {
  const visual = link.parentElement?.querySelector<HTMLElement>(".world-visual");
  if (!visual) return false;

  const style = window.getComputedStyle(visual);
  const assetUrl = backgroundImageUrl(style.backgroundImage);
  if (!assetUrl) return false;

  const asset = worldAssetCache.get(assetUrl);
  if (!asset) {
    loadWorldAsset(assetUrl);
    return false;
  }

  const visualRect = visual.getBoundingClientRect();
  const [rawSizeX = "auto", rawSizeY = "auto"] = style.backgroundSize.split(/\s+/);
  let renderedWidth = cssLength(rawSizeX, visualRect.width, asset.width);
  const renderedHeight = rawSizeY === "auto"
    ? renderedWidth * (asset.height / asset.width)
    : cssLength(rawSizeY, visualRect.height, asset.height);

  if (rawSizeX === "auto" && rawSizeY !== "auto") {
    renderedWidth = renderedHeight * (asset.width / asset.height);
  }

  const baselineShift = Number.parseFloat(style.getPropertyValue("--world-baseline-shift")) || 0;
  const renderedLeft = visualRect.left + (visualRect.width - renderedWidth) / 2;
  const renderedTop = visualRect.top + visualRect.height - renderedHeight + baselineShift;
  const imageX = ((clientX - renderedLeft) / renderedWidth) * asset.width;
  const imageY = ((clientY - renderedTop) / renderedHeight) * asset.height;

  if (imageX < 0 || imageY < 0 || imageX >= asset.width || imageY >= asset.height) {
    return false;
  }

  const alpha = asset.ctx.getImageData(Math.floor(imageX), Math.floor(imageY), 1, 1).data[3];
  return alpha > 24;
}

export function RocketCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef    = useRef<HTMLDivElement>(null);   // position — updated in mousemove (zero lag)
  const rocketRef = useRef<HTMLDivElement>(null);   // tilt / scale / effects — updated in rAF
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      document.body.classList.remove("rocket-cursor-active");
      return;
    }

    // Two modes share all the launch/warp/canvas machinery below:
    //   • cursor mode (desktop, laptop, trackpad iPad): a rocket follows the
    //     pointer and launches on nav click.
    //   • tap mode (phones, pure-touch tablets, narrow windows): no persistent
    //     rocket — a one-shot rocket launches from the tapped point on nav, so
    //     touch users get the same "shoot off into the next page" moment.
    const cursorQuery = window.matchMedia("(any-hover: hover) and (any-pointer: fine) and (min-width: 761px)");

    const canvas = canvasRef.current;
    const pos    = posRef.current;
    const rocket = rocketRef.current;
    if (!canvas || !pos || !rocket) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    WORLD_ASSET_URLS.forEach(loadWorldAsset);

    // Declared early so syncCursorCapability (called below) can avoid hiding the
    // rocket mid-launch in tap mode.
    let isLaunching = false;

    // cursorEnabled drives the pointer-following rocket. In tap mode it stays
    // false (no persistent rocket); the one-shot launch still works via clicks.
    let cursorEnabled: boolean = cursorQuery.matches;

    const syncCursorCapability = () => {
      cursorEnabled = cursorQuery.matches;
      document.body.classList.toggle("rocket-cursor-active", cursorEnabled);
      if (!cursorEnabled && !isLaunching) {
        rocket.style.opacity = "0";
        pos.style.transform = "translate(-200px,-200px)";
      }
    };

    syncCursorCapability();

    // Size the canvas backing store to its actual *rendered* CSS box times
    // devicePixelRatio, then scale the context so all drawing happens in CSS
    // pixels. Using window.innerWidth would include the scrollbar — but the
    // fixed canvas renders at the scrollbar-excluded width, so the backing
    // store would be squished horizontally and the flame would drift left of
    // the rocket (a DOM element positioned in CSS px). The drift grows toward
    // the right edge, which is exactly the reported "flame off to the left on
    // nav click" bug. A ResizeObserver (not just window 'resize') is required
    // because a scrollbar appearing after content loads shrinks the canvas
    // without firing a resize event. DPR scaling also keeps the flame sharp.
    let W = 0, H = 0;
    const sizeCanvas = () => {
      // Cap at 2× — the canvas is full-screen and cleared every frame, so 3×+
      // on hi-DPI screens quadruples fill cost for no visible gain on a flame.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      W = rect.width || document.documentElement.clientWidth;
      H = rect.height || document.documentElement.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeCanvas();

    const canvasResizeObserver = new ResizeObserver(() => sizeCanvas());
    canvasResizeObserver.observe(canvas);

    const onResize = () => {
      sizeCanvas();
      syncCursorCapability();
    };
    window.addEventListener("resize", onResize);
    cursorQuery.addEventListener("change", syncCursorCapability);

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
    // isLaunching declared above
    let launchStartMs = 0;
    let launchFromX = 0, launchFromY = 0;
    let launchAngleStart = 0;
    let launchDuration = LAUNCH_DURATION;  // per-launch: shorter on touch

    // rAF loop run state. Cursor mode runs the loop continuously; tap mode wakes
    // it on a launch and sleeps when idle to save battery on phones.
    let running = false;
    let restoreOpacityTransitionId = 0;

    // ── Warp-in state ─────────────────────────────────────────────────────────
    let isWarpingIn = false;
    let warpStartMs = 0;
    let warpBurstDone = false;

    // ── Jetpack state ─────────────────────────────────────────────────────────
    let jetpackOffsetY = 0;
    let jetpackVelY = 0;
    let jetpackFiringUntil = 0;

    const particles: Particle[]  = [];
    const streaks:   Streak[]    = [];
    const shockwaves: Shockwave[] = [];

    const revealRocketNow = () => {
      cancelAnimationFrame(restoreOpacityTransitionId);
      rocket.style.transition = "none";
      rocket.style.opacity = "1";
      restoreOpacityTransitionId = requestAnimationFrame(() => {
        rocket.style.transition = ROCKET_OPACITY_TRANSITION;
      });
    };

    const startLaunch = ({
      href,
      isExternal = false,
      originX,
      originY,
      showArrival = false,
    }: {
      href?: string;
      isExternal?: boolean;
      originX: number;
      originY: number;
      showArrival?: boolean;
    }) => {
      if (isLaunching) return false;

      launchDuration = cursorEnabled ? LAUNCH_DURATION : TOUCH_LAUNCH_DURATION;

      isLaunching = true;
      isHovering  = false;
      launchStartMs    = performance.now();
      cursorX      = originX;
      cursorY      = originY;
      launchFromX  = originX;
      launchFromY  = originY;
      launchAngleStart = 0;
      angle            = 0;
      hoverScale       = 1;

      // Place + reveal the rocket at the origin before rAF takes over. Snapping
      // here (not next frame) keeps the SVG rocket, canvas flame, and shockwave
      // aligned from frame zero.
      pos.style.transform = `translate(${originX}px,${originY}px)`;
      rocket.style.transform = `translate(${-ROCKET_PIVOT_X}px,${-ROCKET_PIVOT_Y}px) rotate(0deg) scale(1)`;
      revealRocketNow();

      // Tap mode: the loop is asleep — wake it so the launch animates.
      if (!cursorEnabled) ensureRunning();

      // Shockwave burst at the screen-vertical engine point. Launch is a
      // straight upward takeoff, so its flame/effects should never drift left.
      const launchExhaustY = launchFromY + (ROCKET_EXHAUST_Y - ROCKET_PIVOT_Y);
      const sx = launchFromX;
      const sy = launchExhaustY;
      shockwaves.push({ x: sx, y: sy, radius: 0, maxRadius: 100, life: 0, maxLife: 22, r: 255, g: 150, b: 50 });
      setTimeout(() => {
        shockwaves.push({ x: sx, y: sy, radius: 0, maxRadius: 165, life: 0, maxLife: 30, r: 255, g: 90, b: 15 });
      }, 55);

      setTimeout(() => {
        isLaunching = false;

        if (cursorEnabled) {
          // Reset velocity tracking — prevents a tilt spike on the first frame
          cursorX    = mouseX;
          cursorY    = mouseY;
          prevMouseX = mouseX;
          prevMouseY = mouseY;
          smoothVelX = 0;
          smoothVelY = 0;
        } else {
          // Tap mode: no cursor to return to after the one-shot launch.
          rocket.style.opacity = "0";
          cursorX = W / 2;
          cursorY = H * 0.32;
        }

        if (showArrival) {
          isWarpingIn   = true;
          warpStartMs   = performance.now();
          warpBurstDone = false;
        }

        if (href) {
          if (isExternal) {
            window.open(href, "_blank", "noopener,noreferrer");
          } else {
            routerRef.current.push(href);
          }
        }

        // Tap mode: make sure the loop is still awake to finish any particles
        // and, on route transitions, the arrival burst.
        if (!cursorEnabled) ensureRunning();
      }, launchDuration);

      return true;
    };

    // ── Mouse tracking ────────────────────────────────────────────────────────
    // Only record coordinates here — hover check runs in rAF (throttled) so
    // elementFromPoint never blocks the mousemove event.
    const onMouseMove = (e: MouseEvent) => {
      if (!cursorEnabled) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isLaunching) {
        // Update position immediately — no rAF lag for the cursor itself
        pos.style.transform = `translate(${mouseX}px,${mouseY}px)`;
        rocket.style.opacity = "1";
      }
    };

    const onMouseLeave = () => {
      if (!cursorEnabled) return;
      if (!isLaunching) rocket.style.opacity = "0";
    };

    // Pointer-follow + jetpack only matter when cursorEnabled is true, but the
    // media query can change when an iPad gains/loses a trackpad or a viewport
    // crosses the breakpoint. Keep listeners installed; the handlers are gated.
    document.addEventListener("mousemove",  onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);

    // ── Jetpack fire on click ─────────────────────────────────────────────────
    const onJetpackFire = (e: MouseEvent) => {
      if (!cursorEnabled) return;
      if (isLaunching) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("[data-rocket-launch-zone]")) return;

      // Skip jetpack on any navigating link — the launch animation handles those
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (link) {
        const href = link.getAttribute("href") ?? "";
        if (href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:")) return;
      }
      jetpackFiringUntil = performance.now() + 260;  // sustained burn
      // Burst of downward thrust particles from exhaust
      const burstCount = Math.min(PARTICLE_CAP - particles.length, 14);
      for (let i = 0; i < burstCount; i++) {
        particles.push({
          x:       exhaustX + (Math.random() - 0.5) * 6,
          y:       exhaustY + (Math.random() - 0.5) * 4,
          vx:      (Math.random() - 0.5) * 2.0,
          vy:      2.5 + Math.random() * 4.5,
          size:    1.0 + Math.random() * 2.8,
          life:    0,
          maxLife: 22 + Math.random() * 18,
          r:       255,
          g:       120 + Math.floor(Math.random() * 90),
          b:       10  + Math.floor(Math.random() * 20),
        });
      }
    };

    document.addEventListener("mousedown", onJetpackFire);

    // ── Nav click → launch ────────────────────────────────────────────────────
    const onNavClick = (e: MouseEvent) => {
      if (isLaunching) return;
      if (isModifiedNavigationClick(e)) return;

      const link = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      if (link.classList.contains("world-orb-link") && !isOpaqueWorldOrbClick(link, e.clientX, e.clientY)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const internalHref = internalRouteHref(link);
      const externalHref = externalNavigationHref(link);
      if (!internalHref && !externalHref) return;

      e.preventDefault();
      e.stopPropagation();

      // Launch origin: desktop and touch both use the exact click/tap point so
      // every internal route transition feels like the same gesture.
      startLaunch({
        href: internalHref ?? externalHref ?? undefined,
        isExternal: Boolean(externalHref),
        originX: e.clientX,
        originY: e.clientY,
        showArrival: Boolean(internalHref),
      });
    };

    const onSubpageClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target || !target.closest("[data-rocket-launch-zone]")) return;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;

      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      const href = link?.getAttribute("href") ?? "";
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // Real navigation links are handled by onNavClick so the route-transition
      // effect stays consistent. This branch is only for decorative click bursts
      // inside subpage content.
      if (link) return;

      startLaunch({
        originX: e.clientX,
        originY: e.clientY,
      });
    };

    document.addEventListener("click", onNavClick, true);
    document.addEventListener("click", onSubpageClick);

    // ── Animation loop ────────────────────────────────────────────────────────
    const draw = () => {
      frameCount++;
      const now = performance.now();

      ctx.clearRect(0, 0, W, H);

      // ── Position + angle update ───────────────────────────────────────────
      if (isLaunching) {
        const rawT = Math.min((now - launchStartMs) / launchDuration, 1);
        const eased = rawT * rawT * (3 - 2 * rawT);  // smooth acceleration, then clean exit

        cursorX    = launchFromX;
        cursorY    = launchFromY - (launchFromY + 160) * eased;
        angle      = launchAngleStart;
        targetAngle = 0;
        hoverScale = 1 + eased * 2.2;
        hoverRingAlpha = 0;
        speed = 0;
        jetpackOffsetY = 0;
        jetpackVelY    = 0;
      } else if (cursorEnabled) {
        // Cursor follows mouse instantly — no position lag
        const rawVelX = mouseX - prevMouseX;
        const rawVelY = mouseY - prevMouseY;
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        cursorX = mouseX;
        cursorY = mouseY;

        // Jetpack: burn phase → powered ascent, then graceful glide back (no bounce)
        if (now < jetpackFiringUntil) {
          // Sustained thrust — accelerate upward, cap at terminal velocity
          jetpackVelY = Math.max(jetpackVelY - 1.2, -4.2);
          jetpackOffsetY += jetpackVelY;
        } else {
          // Engines off — exponential decay straight back, no spring oscillation
          jetpackOffsetY *= 0.88;
          jetpackVelY = 0;
          if (Math.abs(jetpackOffsetY) < 0.12) jetpackOffsetY = 0;
        }

        // Smooth velocity separately — only used for tilt, not position
        smoothVelX += (rawVelX - smoothVelX) * VEL_SMOOTH;
        smoothVelY += (rawVelY - smoothVelY) * VEL_SMOOTH;
        speed = Math.sqrt(smoothVelX * smoothVelX + smoothVelY * smoothVelY);

        if (speed > 0.25) {
          const raw = Math.atan2(smoothVelX, -smoothVelY) * (180 / Math.PI);
          const tiltBlend = Math.min(speed / 8, 1);
          targetAngle = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, raw)) * tiltBlend;
        } else {
          targetAngle *= 0.80;
        }
        angle      += (targetAngle - angle) * LERP_ANGLE;
        hoverScale += ((isHovering ? 1.28 : 1) - hoverScale) * LERP_SCALE;
        hoverRingAlpha += ((isHovering ? 1 : 0) - hoverRingAlpha) * 0.18;

        // Hover check every 4 frames (~66ms at 60fps) — imperceptible, avoids layout thrash.
        if (frameCount % 4 === 0) {
          const el = document.elementFromPoint(mouseX, mouseY) as HTMLElement | null;
          isHovering = !!el?.closest("a, button, [role='button'], [data-cursor-hover]");
        }
      }

      // ── Rocket element ────────────────────────────────────────────────────
      // pos outer wrapper: holds position only.
      //   • In mousemove (above): updated instantly when NOT launching.
      //   • Here in rAF: driven by animation when launching.
      // rocket inner div: tilt + scale + jetpack offset only — no position.
      const exhaustOffset = (ROCKET_EXHAUST_Y - ROCKET_PIVOT_Y) * hoverScale;
      if (isLaunching) {
        pos.style.transform = `translate(${cursorX}px,${cursorY}px)`;
      }
      rocket.style.transform =
        `translate(${-ROCKET_PIVOT_X}px,${-ROCKET_PIVOT_Y + jetpackOffsetY}px) rotate(${angle}deg) scale(${hoverScale})`;

      // ── Engine plume ──────────────────────────────────────────────────────
      // Canvas exhaust effects are always screen-vertical and centered below
      // the cursor. The SVG owns the tiny normal flame; canvas handles bursts,
      // shockwaves, and launch boosts, where sideways drift looks broken.
      exhaustX = cursorX;
      exhaustY = cursorY + jetpackOffsetY + exhaustOffset;
      const pDirX = 0;
      const pDirY = 1;
      const perpX = 1;
      const perpY = 0;

      let launchBoost = 0;
      if (isLaunching) {
        const rawT = Math.min((now - launchStartMs) / launchDuration, 1);
        launchBoost = (1 - (1 - rawT) * (1 - rawT)) * 300;
      }
      const plumeLen = 14 + Math.min(speed * 3.8, 52) + launchBoost;
      const tipX = exhaustX + pDirX * plumeLen;
      const tipY = exhaustY + pDirY * plumeLen;

      const flicker  = 0.88 + 0.12 * Math.sin(frameCount * 0.23);
      const flutter  = 0.90 + 0.10 * Math.sin(frameCount * 0.15 + 1.7);
      const jetpackBurnT  = now < jetpackFiringUntil ? 1 - (jetpackFiringUntil - now) / 260 : 0;
      const jetpackBoost  = Math.min(jetpackBurnT * 1.4, 1);
      const plumeStr = isLaunching
        ? Math.min(0.45 + Math.min((now - launchStartMs) / launchDuration, 1) * 0.55, 1.0)
        : 0.45 + Math.min(speed / 8, 1) * 0.55 + jetpackBoost * 0.45;

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

      const canvasFlameActive = isLaunching;
      if (canvasFlameActive) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // Launch boost is canvas-based because the rocket leaves the viewport.
        drawCone(6.5, 255,  55,  8,  0.18, flutter);
        drawCone(3.2, 255, 145, 20,  0.55);
        drawCone(1.5, 255, 235, 130, 0.95);
      }
      if (isLaunching) {
        const boost = Math.min((now - launchStartMs) / launchDuration, 1);
        const b2 = boost * boost;
        drawCone(16 * b2, 255,  75, 10, 0.22 * b2, 1);
        drawCone( 9 * b2, 255, 165, 45, 0.38 * b2, 1);
      }
      if (canvasFlameActive) {
        ctx.restore();

        // Nozzle bloom for launch only; normal movement uses the SVG flame so it
        // cannot visually lag behind the rocket.
        const bellGlow = ctx.createRadialGradient(exhaustX, exhaustY, 0, exhaustX, exhaustY, 7);
        bellGlow.addColorStop(0,    `rgba(255, 245, 200, ${0.80 * plumeStr * flicker})`);
        bellGlow.addColorStop(0.45, `rgba(255, 160,  50, ${0.35 * plumeStr * flicker})`);
        bellGlow.addColorStop(1,     "rgba(255,  80,  10, 0)");
        ctx.beginPath();
        ctx.arc(exhaustX, exhaustY, 7, 0, Math.PI * 2);
        ctx.fillStyle = bellGlow;
        ctx.fill();
      }

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

      // Cursor mode animates continuously (the rocket follows the pointer).
      // Tap mode only needs frames while something is on screen, then sleeps so
      // a phone isn't clearing a full-screen canvas 60×/sec for nothing.
      if (cursorEnabled) {
        animId = requestAnimationFrame(draw);
      } else if (isLaunching || isWarpingIn || particles.length || shockwaves.length || streaks.length) {
        animId = requestAnimationFrame(draw);
      } else {
        running = false;
      }
    };

    // Start (or restart) the loop if it isn't already running.
    const ensureRunning = () => {
      if (!running && !document.hidden) {
        running = true;
        animId = requestAnimationFrame(draw);
      }
    };

    // Cursor mode runs immediately; tap mode waits for the first launch.
    if (cursorEnabled) ensureRunning();

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        running = false;
      } else if (cursorEnabled || isLaunching || isWarpingIn || particles.length || shockwaves.length) {
        ensureRunning();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(animId);
      cancelAnimationFrame(restoreOpacityTransitionId);
      canvasResizeObserver.disconnect();
      document.body.classList.remove("rocket-cursor-active");
      window.removeEventListener("resize",          onResize);
      cursorQuery.removeEventListener("change", syncCursorCapability);
      document.removeEventListener("mousemove",     onMouseMove);
      document.removeEventListener("mouseleave",    onMouseLeave);
      document.removeEventListener("mousedown",     onJetpackFire);
      document.removeEventListener("click",         onNavClick, true);
      document.removeEventListener("click",         onSubpageClick);
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

      {/* Outer: position only — updated in mousemove for zero lag */}
      <div
        ref={posRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 9999,
          pointerEvents: "none",
          willChange: "transform",
          transform: "translate(-200px,-200px)",
        }}
      >
      {/* Inner: tilt / scale / jetpack — updated in rAF */}
      <div
        ref={rocketRef}
        style={{
          willChange: "transform",
          transformOrigin: `${ROCKET_PIVOT_X}px ${ROCKET_PIVOT_Y}px`,
          opacity: 0,
          transition: ROCKET_OPACITY_TRANSITION,
        }}
      >
        {/*
          SVG: 18 × 34 viewBox
          Nose tip: (9, 1)   ← actual pointer hotspot offset
          Layer order: fins → flame → engine → body → nosecone → details → cockpit
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

          {/* ── Normal flame ── part of the SVG so it stays locked to the engine */}
          <g>
            <path
              d="M6.2 28.3 C5.9 30.7 7.25 32.65 9 33.75 C10.75 32.65 12.1 30.7 11.8 28.3 C10.35 29.05 7.65 29.05 6.2 28.3 Z"
              fill="#ff6f12"
              fillOpacity="0.9"
            >
              <animate attributeName="fill-opacity" values="0.72;0.95;0.78" dur="0.28s" repeatCount="indefinite" />
            </path>
            <path
              d="M7.45 28.7 C7.35 30.45 8.2 31.9 9 32.72 C9.8 31.9 10.65 30.45 10.55 28.7 C9.65 29.2 8.35 29.2 7.45 28.7 Z"
              fill="#ffd06a"
              fillOpacity="0.92"
            >
              <animate attributeName="fill-opacity" values="0.78;1;0.84" dur="0.18s" repeatCount="indefinite" />
            </path>
          </g>

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
      </div>
    </>
  );
}
