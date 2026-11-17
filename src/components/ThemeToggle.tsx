"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const label = mounted
    ? `Switch to ${isDark ? "light" : "dark"} mode`
    : "Toggle color mode";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={label}
          aria-pressed={mounted ? isDark : undefined}
          // top-4 + h-8 → icon vertical center at y=32, matching the
          // BrandedHeader text center (top-6 + line-height-4 / 2 = 32).
          className="fixed top-4 right-4 z-40 text-content-secondary hover:text-content-primary"
        >
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
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
