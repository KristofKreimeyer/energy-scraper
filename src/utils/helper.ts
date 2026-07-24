import { useState } from "react";

// Zentraler Seiten-Container: mittig, volle Breite bis zur Layout-Maximalbreite,
// horizontale Innenabstände. Von allen Top-Level-Sektionen genutzt.
export const WRAP = "mx-auto w-full max-w-[var(--maxw)] px-5";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const isDark =
    theme === "dark" ||
    (theme === null &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  function toggle() {
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }
  return { isDark, toggle };
}
