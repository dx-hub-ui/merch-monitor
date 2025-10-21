"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm font-medium text-white shadow-sm backdrop-blur transition hover:bg-white/20 focus-visible:ring-white/70 focus-visible:ring-offset-0"
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? "Light" : "Dark"} mode
    </button>
  );
}
