"use client";

import { useEffect, useState, type ComponentType } from "react";

// The rocket is decoration: its code loads once the page is idle, off the
// path to first paint and hydration. It takes over the cursor only when ready.
export default function ClientChrome() {
  const [Rocket, setRocket] = useState<ComponentType | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => void import("@/components/RocketCursor").then(({ RocketCursor }) => {
      if (!cancelled) setRocket(() => RocketCursor);
    });
    // Safari has no requestIdleCallback.
    const idle = typeof window.requestIdleCallback === "function";
    const id = idle ? window.requestIdleCallback(load, { timeout: 2000 }) : setTimeout(load, 200);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(id as number);
      else clearTimeout(id);
    };
  }, []);
  return Rocket ? <Rocket /> : null;
}
