"use client";

import { useEffect, type RefObject } from "react";

// A single invitation after the camera settles. No animation loop or work
// while another island, a dialog, or a background tab has the visitor's focus.
export function useIslandCue(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    const scene = root?.closest<HTMLElement>("[data-island-scene]");
    const stage = root?.closest<HTMLElement>("[data-island-stage]");
    if (!root || !scene || !stage) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let offered = false;
    let start = 0;
    let finish = 0;
    const stop = () => {
      clearTimeout(start); start = 0;
      clearTimeout(finish); finish = 0;
      if (offered) root.dataset.cueState = "done";
    };
    const sync = () => {
      const settled = scene.dataset.active === "true" && stage.dataset.travelling !== "true" && stage.dataset.coasting !== "true"
        && !stage.dataset.entering && !stage.dataset.overlay && !document.hidden && !motion.matches;
      if (!settled) { stop(); return; }
      if (offered || start) return;
      start = window.setTimeout(() => {
        start = 0; offered = true;
        root.dataset.cueState = "playing";
        finish = window.setTimeout(() => { root.dataset.cueState = "done"; finish = 0; }, 3600);
      }, 450);
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-active"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["data-travelling", "data-coasting", "data-entering", "data-overlay"] });
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      stop(); observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref]);
}
