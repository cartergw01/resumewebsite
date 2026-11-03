"use client";

import { useLayoutEffect, type RefObject } from "react";

// Native modal focus and scroll locking must settle before paint, particularly
// on iOS where focusing the opener before the dialog closes silently fails.
export function useIslandDialog(dialog: RefObject<HTMLDialogElement | null>, initialFocus: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const root = document.documentElement;
    const stage = document.querySelector<HTMLElement>("[data-island-stage]");
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = root.style.overflow;
    const previousOverlay = stage?.dataset.overlay;
    document.body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    if (stage) stage.dataset.overlay = "true";
    element.showModal();
    initialFocus.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = bodyOverflow;
      root.style.overflow = rootOverflow;
      if (stage) {
        if (previousOverlay === undefined) delete stage.dataset.overlay;
        else stage.dataset.overlay = previousOverlay;
      }
    };
  }, [dialog, initialFocus]);
}
