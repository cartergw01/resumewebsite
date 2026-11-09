"use client";

import { useEffect } from "react";
import { RocketCursor } from "@/components/RocketCursor";

export default function ClientChrome() {
  // Track input at the shared layout: lazy island widgets cannot catch the
  // first tap, and unmounting them must not reset focus styling on subpages.
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => { root.dataset.pointerInput = ""; };
    const key = (event: KeyboardEvent) => { if (event.key === "Tab") delete root.dataset.pointerInput; };
    window.addEventListener("pointerdown", pointer, { capture: true, passive: true });
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", key, true);
      delete root.dataset.pointerInput;
    };
  }, []);

  return <RocketCursor />;
}
