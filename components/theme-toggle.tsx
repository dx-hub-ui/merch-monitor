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
      className="rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? "Light" : "Dark"} mode
    </button>
  );
}
