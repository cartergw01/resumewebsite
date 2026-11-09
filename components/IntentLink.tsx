"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps } from "react";

// Fetch a destination when someone reaches for it. Viewport prefetching made
// every page download the island code and styles, even on slow phones.
export default function IntentLink({ onPointerEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const pathname = usePathname();
  const prepare = () => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /^(slow-)?2g$/.test(connection?.effectiveType ?? "")) return;
    if (typeof props.href === "string" && props.href.startsWith("/") && props.href.split(/[?#]/)[0] !== pathname) {
      router.prefetch(props.href);
    }
  };
  return <Link {...props} prefetch={false}
    onPointerEnter={event => { onPointerEnter?.(event); if (!event.defaultPrevented) prepare(); }}
    onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) prepare(); }}
    onTouchStart={event => { onTouchStart?.(event); if (!event.defaultPrevented) prepare(); }}
  />;
}
