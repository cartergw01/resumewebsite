import { useEffect, useId, useRef, type PointerEvent, type MouseEvent, type RefObject } from "react";
import styles from "./IslandHome.module.css";

const CORD_LENGTH = 34, BEAD_HEIGHT = 9;

// The pull chain each island's light hangs from: a hairline cord, a bead
// that glows while the light is on, and the word for what to do with it.
// Hovering, focusing or pulling it says what the pull will do instead.
export function PullChain({ action }: { action: string }) {
  const gradientId = useId();
  // The anchor and hit area stay still; only the cord and bead move.
  return <span className={styles.chain} aria-hidden="true">
    <svg className={styles.chainCord} width="1" height={CORD_LENGTH} viewBox={`-0.5 0 1 ${CORD_LENGTH}`} overflow="visible" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2={CORD_LENGTH} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff1d7" stopOpacity="0" />
          <stop offset="0.3" stopColor="#fff1d7" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff1d7" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path data-cord d={`M 0 0 C 0 12 0 23 0 ${CORD_LENGTH + BEAD_HEIGHT / 2}`} fill="none" stroke={`url(#${gradientId})`} strokeWidth="1" strokeLinecap="round" />
    </svg>
    <span className={styles.chainBead} data-bead style={{ height: BEAD_HEIGHT }} />
    <span className={styles.chainLabel}>
      <span data-say="pull">pull</span>
      <span data-say="action">{action}</span>
    </span>
  </span>;
}

// Bounded resistance keeps the bead close to the island, even if the
// captured pointer leaves the button. Sideways play is never a light pull.
const PULL_MAX = 26, PULL_TRIGGER = 14, SWING_MAX = 30;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function usePullChain(toggle: () => void) {
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean; armed: boolean; startX: number; startPull: number } | null>(null);
  const motion = useRef({ x: 0, pull: 0 });
  const frame = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const visual = useRef<{ button: HTMLElement; cord: SVGPathElement | null } | null>(null);

  // Ref-owned visual updates avoid React renders on pointer moves or frames.
  const paint = (button: HTMLElement, x: number, pull: number) => {
    if (visual.current?.button !== button) {
      visual.current = { button, cord: button.querySelector<SVGPathElement>("[data-cord]") };
    }
    motion.current = { x, pull };
    const y = Math.sqrt(CORD_LENGTH ** 2 - Math.min(Math.abs(x), SWING_MAX) ** 2) + pull;
    button.style.setProperty("--cord-x", `${x}px`);
    button.style.setProperty("--cord-y", `${y - CORD_LENGTH}px`);
    // A vertical tangent at the anchor makes it bend instead of rotating
    // like a stick. The SVG origin is centered on the bead; extend the
    // path beneath it to its exact center, including during spring-back.
    visual.current.cord?.setAttribute("d", `M 0 0 C 0 ${y * 0.35} ${x * 0.65} ${y * 0.8} ${x} ${y + BEAD_HEIGHT / 2}`);
  };
  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const settle = (button: HTMLElement) => {
    stop();
    if (reducedMotion()) { paint(button, 0, 0); return; }
    const from = { ...motion.current };
    const start = performance.now();
    const tick = (now: number) => {
      const seconds = (now - start) / 1000;
      if (seconds >= 1.3 || !button.isConnected || document.hidden || reducedMotion()) {
        paint(button, 0, 0);
        frame.current = null;
        return;
      }
      // Analytic damped springs keep the same timing at every refresh rate.
      const swing = Math.exp(-4.8 * seconds) * (Math.cos(12 * seconds) + 0.4 * Math.sin(12 * seconds));
      const stretch = Math.exp(-7 * seconds) * (Math.cos(15 * seconds) + 7 / 15 * Math.sin(15 * seconds));
      paint(button, from.x * swing, from.pull * stretch);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  const release = (button: HTMLButtonElement) => {
    const gesture = drag.current;
    drag.current = null;
    delete button.dataset.dragging;
    if (gesture && button.hasPointerCapture(gesture.id)) button.releasePointerCapture(gesture.id);
    settle(button);
  };
  const cancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    suppressClick.current = true;
    release(event.currentTarget);
  };

  return {
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (event.button !== 0 || !event.isPrimary || drag.current || event.currentTarget.getAttribute("aria-disabled") === "true") return;
      stop();
      delete event.currentTarget.dataset.sway;
      suppressClick.current = false;
      drag.current = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        moved: false, armed: false, startX: motion.current.x, startPull: motion.current.pull,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
      gesture.moved = true;
      const pull = PULL_MAX * (1 - Math.exp(-Math.max(0, dy) / 30));
      gesture.armed = pull >= PULL_TRIGGER && dy > Math.abs(dx) * 0.75;
      event.currentTarget.dataset.dragging = "";
      const x = SWING_MAX * Math.tanh((dx + gesture.startX / 0.7) / (SWING_MAX / 0.7));
      paint(event.currentTarget, x, Math.min(PULL_MAX, pull + gesture.startPull));
    },
    onPointerUp(event: PointerEvent<HTMLButtonElement>) {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      release(event.currentTarget);
      if (!gesture.moved) return;
      suppressClick.current = true;
      if (gesture.armed) toggle();
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClick(event: MouseEvent<HTMLButtonElement>) {
      // Suppress only a drag's pointer click. Keyboard activation and the
      // next deliberate click still work immediately after playing with it.
      if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
      if (event.currentTarget.getAttribute("aria-disabled") === "true") return;
      delete event.currentTarget.dataset.sway;
      if (!reducedMotion()) paint(event.currentTarget, motion.current.x, 8);
      settle(event.currentTarget);
      toggle();
    },
  };
}

// The first time a visitor settles on this island, the chain sways once on
// its own, as if a breeze caught it: an invitation, never repeated, and
// skipped if they reach for it first or prefer less motion.
export function useChainSway(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const button = ref.current;
    const scene = button?.closest<HTMLElement>("[data-island-scene]");
    const stage = button?.closest<HTMLElement>("[data-island-stage]");
    if (!button || !scene || !stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let done: ReturnType<typeof setTimeout> | undefined;
    const settled = () => scene.dataset.active === "true" && stage.dataset.travelling !== "true" && !stage.dataset.entering && !document.hidden;
    const sync = () => {
      clearTimeout(wait);
      if (!settled()) return;
      wait = setTimeout(() => {
        if (!settled()) return;
        stop();
        button.dataset.sway = "";
        done = setTimeout(() => { delete button.dataset.sway; }, 1700);
      }, 1100);
    };
    const observer = new MutationObserver(sync);
    const stop = () => { observer.disconnect(); clearTimeout(wait); button.removeEventListener("pointerdown", stop); };
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-entering"] });
    button.addEventListener("pointerdown", stop);
    sync();
    return () => { stop(); clearTimeout(done); };
  }, [ref]);
}
