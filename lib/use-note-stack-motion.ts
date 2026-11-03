"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

export type NoteOrigin = { x: number; y: number; width: number };

// Measure once, then leave the lift and fan to compositor animations. The
// dialog stays modal until its exit completes, including interrupted entries.
export function useNoteStackMotion(
  dialog: RefObject<HTMLDialogElement | null>,
  stack: RefObject<HTMLDivElement | null>,
  origin: NoteOrigin | null,
  onClose: () => void,
) {
  const close = useRef<() => void>(() => {});
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const shell = dialog.current;
    const pile = stack.current;
    if (!shell || !pile) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sheets = Array.from(pile.querySelectorAll<HTMLElement>("[data-note-sheet]"));
    const rests = sheets.map(sheet => getComputedStyle(sheet).transform);
    const entryBox = pile.getBoundingClientRect();
    const animations = new Set<Animation>();
    let closing = false;
    let disposed = false;
    let travel = Boolean(origin && (window.visualViewport?.scale ?? 1) <= 1.01);

    const folded = (box: DOMRect) => {
      if (!origin || !travel) return "translate3d(0, 16px, 0) scale(.96) rotate(-.6deg)";
      const x = origin.x - box.x - box.width / 2;
      const y = origin.y - box.y - box.height / 2;
      const sx = Math.min(.16, Math.max(.055, origin.width / box.width));
      const sy = Math.min(.1, Math.max(.025, origin.width * .4 / box.height));
      return `translate3d(${x}px, ${y}px, 0) scale(${sx}, ${sy}) rotate(-8deg)`;
    };
    const clear = () => {
      animations.forEach(animation => animation.cancel());
      animations.clear();
      [pile, ...sheets].forEach(element => { element.style.willChange = ""; });
    };
    const animate = (element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      element.style.willChange = "transform, opacity";
      const animation = element.animate(frames, { fill: "both", ...options });
      animations.add(animation);
      // Cancellation is expected when closing mid-lift or changing preferences.
      animation.finished.catch(() => {});
      return animation;
    };
    const settle = () => {
      if (disposed || closing) return;
      clear();
      shell.dataset.noteMotion = "idle";
    };
    const finishClose = () => {
      if (disposed) return;
      clear();
      onCloseRef.current();
    };

    if (motion.matches) shell.dataset.noteMotion = "idle";
    else {
      shell.dataset.noteMotion = "opening";
      animate(pile, [{ transform: folded(entryBox), opacity: 0 }, { transform: "none", opacity: 1 }], {
        duration: 420, easing: "cubic-bezier(.16, 1, .3, 1)",
      });
      sheets.forEach((sheet, index) => {
        const fan = index === 0 ? "translate3d(0, 18px, 0) rotate(3deg) scaleX(.96)" : "translate3d(0, 10px, 0) rotate(-2.5deg) scaleX(.98)";
        const delay = index === 0 ? 45 : 30;
        animate(sheet, [
          { transform: "none", opacity: .3 },
          { transform: fan, opacity: 1, offset: .6 },
          { transform: rests[index], opacity: 1 },
        ], { duration: 420 - delay, delay, easing: "ease-out" });
      });
      Promise.all([...animations].map(animation => animation.finished)).then(settle).catch(() => {});
    }

    close.current = () => {
      if (closing || disposed) return;
      const box = shell.dataset.noteMotion === "opening" ? entryBox : pile.getBoundingClientRect();
      const current = [pile, ...sheets].map(element => {
        const style = getComputedStyle(element);
        return { transform: style.transform, opacity: style.opacity };
      });
      closing = true;
      clear();
      shell.dataset.noteMotion = "closing";
      if (motion.matches) { finishClose(); return; }
      const exit = animate(pile, [current[0], { transform: folded(box), opacity: 0 }], {
        duration: 220, easing: "cubic-bezier(.4, 0, 1, 1)",
      });
      sheets.forEach((sheet, index) => animate(sheet, [current[index + 1], { transform: "none", opacity: .3 }], {
        duration: 180, easing: "ease-in",
      }));
      exit.finished.then(finishClose).catch(() => {});
    };
    const reduce = () => {
      if (!motion.matches) return;
      if (closing) finishClose(); else settle();
    };
    const resize = () => {
      travel = false;
      if (closing) finishClose(); else settle();
    };
    motion.addEventListener("change", reduce);
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      clear();
      motion.removeEventListener("change", reduce);
      window.removeEventListener("resize", resize);
      close.current = () => {};
    };
  }, [dialog, stack, origin]);

  return () => close.current();
}
