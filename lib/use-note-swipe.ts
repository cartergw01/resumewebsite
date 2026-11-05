"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";

const SLOP = 8; // px a finger travels before it counts as a drag
const COMMIT_SHARE = .22; // of the card's width, for a slow drag
const FLING_SPEED = .45; // px/ms at release that turns the page regardless of distance
const FLING_MIN = 24; // px, so a jittery tap can't count as a fling
const FLING_STALE = 80; // ms a finger can rest before lifting and still fling
const LIFT_EASE = "cubic-bezier(.16, 1, .3, 1)";
const REVEAL_REACH = .7; // of the card's width dragged, when the card underneath has fully come forward
const REVEAL_SPAN = 1000; // ms, only a scale for scrubbing: nothing plays at this speed
const FLY_OUT = 160; // ms
const RETURN = 200; // ms

type Direction = 1 | -1;

// Horizontal touch drags turn the page: the card follows the finger, then leaves
// in that direction or returns. Vertical drags stay native (touch-action: pan-y in
// the CSS), and the browser cancels the pointer the moment it takes one over.
// Touches are read from the surface, which stays put, so a quick second swipe
// still registers once the card has flown out from under the finger.
// The card underneath shows the post being turned to and comes forward with the
// drag, so when the top card has gone the page swap underneath it doesn't show.
export function useNoteSwipe(
  dialog: RefObject<HTMLDialogElement | null>,
  surface: RefObject<HTMLElement | null>,
  card: RefObject<HTMLElement | null>,
  onPage: (direction: Direction) => void,
  onPeek: (direction: Direction) => void,
  enabled: boolean,
) {
  const onPageRef = useRef(onPage);
  const onPeekRef = useRef(onPeek);
  useLayoutEffect(() => { onPageRef.current = onPage; onPeekRef.current = onPeek; });

  useEffect(() => {
    const shell = dialog.current;
    const area = surface.current;
    const note = card.current;
    const under = area?.querySelector<HTMLElement>('[data-note-sheet="middle"]');
    const back = area?.querySelector<HTMLElement>('[data-note-sheet="back"]');
    const closeRow = shell?.querySelector<HTMLElement>("[data-note-dismiss]");
    if (!shell || !area || !note || !under || !back || !closeRow || !enabled) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const viewport = window.visualViewport;
    const zoomed = () => (viewport?.scale ?? 1) > 1.01;
    let drag: { id: number; x: number; y: number; dx: number; width: number; moving: boolean; time: number; speed: number; peek?: Direction } | null = null;
    let flight: { animation: Animation; next?: () => void } | null = null;
    let reveal: Animation[] = [];

    const stopReveal = () => {
      reveal.forEach(animation => animation.cancel());
      reveal = [];
    };
    // Paused animations from each element's resting state to where it will be once
    // the page has turned, scrubbed by the drag. The stack is centred, so a longer
    // post grows from the middle and the close button rides up with its top edge.
    const startReveal = (direction: Direction) => {
      stopReveal();
      flushSync(() => onPeekRef.current(direction));
      under.style.bottom = "auto";
      const grow = (under.offsetHeight - area.offsetHeight) / 2;
      under.style.bottom = "";
      const inset = { top: `${-grow}px`, bottom: `${-grow}px` };
      const top = getComputedStyle(note);
      const options = { duration: REVEAL_SPAN, fill: "both" } as const;
      reveal = [
        back.animate([{ transform: getComputedStyle(under).transform, ...inset }], options),
        under.animate([{ transform: "none", backgroundColor: top.backgroundColor, borderColor: top.borderTopColor, boxShadow: top.boxShadow, ...inset }], options),
        closeRow.animate([{ transform: `translateY(${-grow}px)` }], options),
      ];
      reveal.forEach(animation => animation.pause());
    };
    // Finishes the reveal over `duration`, forwards or back, from wherever the drag left it.
    const playReveal = (forwards: boolean, duration: number) => {
      reveal.forEach(animation => {
        const at = Number(animation.currentTime);
        animation.playbackRate = Math.max(1, (forwards ? REVEAL_SPAN - at : at) / duration) * (forwards ? 1 : -1);
        animation.play();
      });
    };

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
      stopReveal();
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
        if (motion.matches) { note.style.transform = ""; note.style.willChange = ""; stopReveal(); return; }
        playReveal(false, RETURN);
        fly([{ transform: from }, { transform: "none" }], { duration: RETURN, easing: LIFT_EASE });
        return;
      }
      const direction: Direction = held.dx < 0 ? 1 : -1;
      const page = () => flushSync(() => onPageRef.current(direction));
      if (motion.matches) { note.style.transform = ""; note.style.willChange = ""; stopReveal(); page(); return; }
      // The post is replaced when the card lands, so a finger touching down
      // before then must not start on an element that is about to be removed.
      note.dataset.noteLeaving = "";
      playReveal(true, FLY_OUT);
      fly([{ transform: from, opacity: 1 }, { transform: offset(-direction * held.width * 1.1, held.width), opacity: 0 }],
        { duration: FLY_OUT, easing: "cubic-bezier(.2, .7, .4, 1)" },
        () => {
          page();
          // The swap must not show: the new post skips its fade, having been on screen
          // all along, and a fresh edge slides out from behind the stack.
          note.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
          stopReveal();
          back.animate([{ transform: getComputedStyle(under).transform }, { transform: getComputedStyle(back).transform }], { duration: 220, easing: LIFT_EASE });
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
      const peek: Direction = dx < 0 ? 1 : -1;
      if (dx !== 0 && peek !== drag.peek) {
        drag.peek = peek;
        startReveal(peek);
      }
      const progress = Math.min(1, Math.abs(dx) / (drag.width * REVEAL_REACH));
      reveal.forEach(animation => { animation.currentTime = progress * REVEAL_SPAN; });
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

    // Without this, iOS gives a slow sideways drag over a post long enough to scroll
    // to the scroller and cancels the pointer, so the card snaps back mid-swipe.
    const keepDrag = (event: TouchEvent) => { if (drag?.moving && event.cancelable) event.preventDefault(); };

    syncZoom();
    viewport?.addEventListener("resize", syncZoom);
    area.addEventListener("touchmove", keepDrag, { passive: false });
    area.addEventListener("pointerdown", down);
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerup", up);
    area.addEventListener("pointercancel", cancel);
    return () => {
      viewport?.removeEventListener("resize", syncZoom);
      area.removeEventListener("touchmove", keepDrag);
      area.removeEventListener("pointerdown", down);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerup", up);
      area.removeEventListener("pointercancel", cancel);
      if (flight) { flight.next = undefined; land(); }
      stopReveal();
      note.style.transform = "";
      note.style.willChange = "";
    };
  }, [dialog, surface, card, enabled]);
}
