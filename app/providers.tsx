"use client";

import { HeroUIProvider } from "@heroui/react";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>{children}</ThemeProvider>
      </MotionConfig>
    </HeroUIProvider>
  );
}
