"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "awu-finances-theme";
const LEGACY_STORAGE_KEY = "savepoint-theme";
const DEFAULT_THEME: Theme = "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Firefox can block storage access under strict privacy settings.
  }

  try {
    document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Keep the in-memory theme even when cookie persistence is unavailable.
  }
}

export function ThemeProvider({ children, initialTheme = DEFAULT_THEME }: { children: ReactNode; initialTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return initialTheme;
    }

    const stored = readStoredTheme();
    const serverTheme = document.documentElement.dataset.theme;
    return stored === "light" || serverTheme === "light" ? "light" : DEFAULT_THEME;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        persistTheme(nextTheme);
      },
      toggleTheme: () => {
        const nextTheme: Theme = theme === "light" ? "dark" : "light";
        setThemeState(nextTheme);
        persistTheme(nextTheme);
      }
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
