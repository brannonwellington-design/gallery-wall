"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const STORAGE_KEY = "gw-theme";

function readSavedTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

export default function ThemeToggle() {
  // Render a placeholder until mount so SSR markup matches the
  // pre-hydration script's output (which only sets data-theme="dark"
  // if it was previously saved). After mount the real state takes over.
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = readSavedTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        mounted
          ? `Switch to ${isDark ? "light" : "dark"} mode`
          : "Toggle color mode"
      }
      title={
        mounted
          ? `Switch to ${isDark ? "light" : "dark"} mode`
          : "Toggle color mode"
      }
      aria-pressed={mounted ? isDark : undefined}
      className="fixed top-4 right-4 z-40 inline-flex items-center justify-center w-11 h-11 rounded-md text-content-secondary bg-surface-primary border border-surface-tertiary hover:text-content-primary hover:bg-surface-secondary"
    >
      {/* Both icons rendered; the inactive one is hidden. Prevents layout
          shift and keeps the SSR markup stable regardless of theme. */}
      <Sun
        size={16}
        strokeWidth={1.25}
        aria-hidden="true"
        className={isDark ? "hidden" : "block"}
      />
      <Moon
        size={16}
        strokeWidth={1.25}
        aria-hidden="true"
        className={isDark ? "block" : "hidden"}
      />
    </button>
  );
}
