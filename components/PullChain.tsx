import { useEffect, useRef, type PointerEvent, type MouseEvent, type RefObject } from "react";
import styles from "./IslandHome.module.css";

// The pull chain each island's light hangs from: a hairline cord, a bead
// that glows while the light is on, and the word for what to do with it.
// Hovering, focusing or pulling it says what the pull will do instead.
export function PullChain({ action }: { action: string }) {
  // One swinging piece inside a still button, so the tap target never moves.
  return <span className={styles.chain} aria-hidden="true">
    <span className={styles.chainCord} />
    <span className={styles.chainBead} data-bead />
    <span className={styles.chainLabel}>
      <span data-say="pull">pull</span>
      <span data-say="action">{action}</span>
    </span>
  </span>;
}

// How far the cord gives (px), and how far down a pull has to go to count.
const PULL_MAX = 26, PULL_TRIGGER = 14;

// A click tugs the cord down; it springs back on its own.
function tug(button: HTMLElement) {
  button.dataset.tug = "";
  window.setTimeout(() => { delete button.dataset.tug; }, 260);
}

// Lets a finger (or mouse) actually pull the chain: the cord follows the
// pointer down with a little resistance, and letting go past the trigger
// toggles it. A plain click or tap still works, with a short tug. Touches
// that start here are left out of the islands' swipe paging.
export function usePullChain(toggle: () => void) {
  const drag = useRef<{ id: number; y: number; moved: boolean; armed: boolean } | null>(null);
  const pulledAt = useRef(-Infinity);
  const release = (button: HTMLElement) => {
    drag.current = null;
    delete button.dataset.dragging;
    button.style.removeProperty("--pull");
  };
  return {
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (event.button !== 0) return;
      drag.current = { id: event.pointerId, y: event.clientY, moved: false, armed: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      const dy = event.clientY - gesture.y;
      if (!gesture.moved && Math.abs(dy) < 4) return;
      gesture.moved = true;
      const pull = Math.max(0, Math.min(PULL_MAX, dy * 0.8));
      gesture.armed = pull >= PULL_TRIGGER;
      event.currentTarget.dataset.dragging = "";
      event.currentTarget.style.setProperty("--pull", String(pull));
    },
    onPointerUp(event: PointerEvent<HTMLButtonElement>) {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      release(event.currentTarget);
      if (!gesture.moved) return;
      // The click that may follow a drag is the drag's, not a second pull.
      pulledAt.current = event.timeStamp;
      if (gesture.armed) toggle();
    },
    onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
      if (drag.current?.id === event.pointerId) release(event.currentTarget);
    },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      if (event.timeStamp - pulledAt.current < 500) return;
      tug(event.currentTarget);
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
