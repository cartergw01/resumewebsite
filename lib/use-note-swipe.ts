"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";

const SLOP = 8; // px a finger travels before it counts as a drag
const COMMIT_SHARE = .22; // of the card's width, for a slow drag
const FLING_SPEED = .45; // px/ms at release that turns the page regardless of distance
const FLING_MIN = 24; // px, so a jittery tap can't count as a fling
const FLING_STALE = 80; // ms a finger can rest before lifting and still fling
const LIFT_EASE = "cubic-bezier(.16, 1, .3, 1)";

type Direction = 1 | -1;

// Horizontal touch drags turn the page: the card follows the finger, then leaves
// in that direction or returns. Vertical drags stay native (touch-action: pan-y in
// the CSS), and the browser cancels the pointer the moment it takes one over.
// Touches are read from the surface, which stays put, so a quick second swipe
// still registers once the card has flown out from under the finger.
export function useNoteSwipe(
  dialog: RefObject<HTMLDialogElement | null>,
  surface: RefObject<HTMLElement | null>,
  card: RefObject<HTMLElement | null>,
  onPage: (direction: Direction) => void,
  enabled: boolean,
) {
  const onPageRef = useRef(onPage);
  useLayoutEffect(() => { onPageRef.current = onPage; });

  useEffect(() => {
    const shell = dialog.current;
    const area = surface.current;
    const note = card.current;
    if (!shell || !area || !note || !enabled) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const viewport = window.visualViewport;
    const zoomed = () => (viewport?.scale ?? 1) > 1.01;
    let drag: { id: number; x: number; y: number; dx: number; width: number; moving: boolean; time: number; speed: number } | null = null;
    let flight: { animation: Animation; next?: () => void } | null = null;

    // While pinch-zoomed a sideways drag has to pan the page, not the card.
    const syncZoom = () => shell.toggleAttribute("data-zoomed", zoomed());

    const land = () => {
      if (!flight) return;
      const { animation, next } = flight;
      flight = null;
      animation.onfinish = null;
      animation.cancel();
      delete note.dataset.noteLeaving;
      note.style.willChange = "";
      next?.();
    };
    const fly = (frames: Keyframe[], options: KeyframeAnimationOptions, next?: () => void) => {
      note.style.transform = "";
      note.style.willChange = "transform, opacity";
      const animation = note.animate(frames, { fill: "both", ...options });
      animation.onfinish = land;
      flight = { animation, next };
    };
    const offset = (dx: number, width: number) => `translate3d(${dx}px, 0, 0) rotate(${dx / width * 3}deg)`;

    const release = (held: NonNullable<typeof drag>, turn: boolean) => {
      const from = offset(held.dx, held.width);
      if (!turn) {
        if (motion.matches) { note.style.transform = ""; note.style.willChange = ""; return; }
        fly([{ transform: from }, { transform: "none" }], { duration: 200, easing: LIFT_EASE });
        return;
      }
      const direction: Direction = held.dx < 0 ? 1 : -1;
      const page = () => flushSync(() => onPageRef.current(direction));
      if (motion.matches) { note.style.transform = ""; note.style.willChange = ""; page(); return; }
      // The post is replaced when the card lands, so a finger touching down
      // before then must not start on an element that is about to be removed.
      note.dataset.noteLeaving = "";
      fly([{ transform: from, opacity: 1 }, { transform: offset(-direction * held.width * 1.1, held.width), opacity: 0 }],
        { duration: 160, easing: "cubic-bezier(.2, .7, .4, 1)" },
        () => {
          page();
          fly([{ transform: `translate3d(${direction * held.width * .35}px, 0, 0)`, opacity: 0 }, { transform: "none", opacity: 1 }],
            { duration: 220, easing: LIFT_EASE });
        });
    };

    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      if (drag) {
        // A second finger means a pinch, which belongs to the browser.
        const held = drag;
        drag = null;
        if (held.moving) release(held, false);
        return;
      }
      if (!event.isPrimary || zoomed()) return;
      // A quick second swipe finishes the first one rather than waiting for it.
      while (flight) land();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, width: note.offsetWidth, moving: false, time: event.timeStamp, speed: 0 };
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      if (!drag.moving) {
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }
        drag.moving = true;
        note.style.willChange = "transform";
      }
      const elapsed = event.timeStamp - drag.time;
      if (elapsed > 0) drag.speed = drag.speed * .3 + (dx - drag.dx) / elapsed * .7;
      drag.dx = dx;
      drag.time = event.timeStamp;
      note.style.transform = offset(dx, drag.width);
    };
    const up = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const held = drag;
      drag = null;
      if (!held.moving) return;
      const speed = event.timeStamp - held.time > FLING_STALE ? 0 : held.speed;
      const flung = Math.abs(speed) > FLING_SPEED && Math.abs(held.dx) > FLING_MIN;
      release(held, flung ? Math.sign(speed) === Math.sign(held.dx) : Math.abs(held.dx) > held.width * COMMIT_SHARE);
    };
    const cancel = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const held = drag;
      drag = null;
      if (held.moving) release(held, false);
    };

    syncZoom();
    viewport?.addEventListener("resize", syncZoom);
    area.addEventListener("pointerdown", down);
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerup", up);
    area.addEventListener("pointercancel", cancel);
    return () => {
      viewport?.removeEventListener("resize", syncZoom);
      area.removeEventListener("pointerdown", down);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerup", up);
      area.removeEventListener("pointercancel", cancel);
      if (flight) { flight.next = undefined; land(); }
      note.style.transform = "";
      note.style.willChange = "";
    };
  }, [dialog, surface, card, enabled]);
}
