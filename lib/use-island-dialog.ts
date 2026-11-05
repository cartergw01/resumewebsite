"use client";

import { useLayoutEffect, type RefObject } from "react";

export const ISLAND_DIALOG_CHANGE = "island-dialog-change";

// Native modal focus and scroll locking must settle before paint, particularly
// on iOS where focusing the opener before the dialog closes silently fails.
export function useIslandDialog(dialog: RefObject<HTMLDialogElement | null>, initialFocus: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const root = document.documentElement;
    const stage = document.querySelector<HTMLElement>("[data-island-stage]");
    const rootOverflow = root.style.overflow;
    const previousOverlay = stage?.dataset.overlay;
    // Only the root: hidden overflow on body would make it the sticky stage's
    // scroller, and the scene would jump out of view behind the dialog.
    root.style.overflow = "hidden";
    if (stage) stage.dataset.overlay = "true";
    element.showModal();
    initialFocus.current?.focus({ preventScroll: true });
    document.dispatchEvent(new Event(ISLAND_DIALOG_CHANGE));
    return () => {
      element.close();
      document.dispatchEvent(new Event(ISLAND_DIALOG_CHANGE));
      root.style.overflow = rootOverflow;
      if (stage) {
        if (previousOverlay === undefined) delete stage.dataset.overlay;
        else stage.dataset.overlay = previousOverlay;
      }
    };
  }, [dialog, initialFocus]);
}
