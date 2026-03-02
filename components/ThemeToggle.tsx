"use client";

import { Switch } from "@heroui/react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Switch
      isSelected={theme === "dark"}
      onValueChange={(selected) => setTheme(selected ? "dark" : "light")}
      color="default"
      size="sm"
    >
      {theme === "dark" ? "dark blue" : "light"}
    </Switch>
  );
}
