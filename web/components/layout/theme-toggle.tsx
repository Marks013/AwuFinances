"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const targetTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
      className={cn(
        "theme-toggle",
        compact ? "theme-toggle--compact relative z-20" : "theme-toggle--floating fixed right-5 top-5 z-[90]"
      )}
      data-target-theme={targetTheme}
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden="true" className="theme-toggle__scene">
        <span className="theme-toggle__stars">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="theme-toggle__clouds">
          <span />
          <span />
          <span />
        </span>
        <span className="theme-toggle__orb">
          {targetTheme === "dark" ? <MoonStar className="size-3.5" /> : <SunMedium className="size-3.5" />}
        </span>
      </span>
      <span className="theme-toggle__label">{targetTheme === "dark" ? "Escuro" : "Claro"}</span>
    </button>
  );
}
