import { heroui } from "@heroui/react";

export default heroui({
  themes: {
    light: {
      colors: {
        primary: {
          DEFAULT: "#1f2937",
          foreground: "#fcfaf6",
        },
      },
    },
    dark: {
      colors: {
        primary: {
          DEFAULT: "#f4ede2",
          foreground: "#111111",
        },
      },
    },
  },
});
