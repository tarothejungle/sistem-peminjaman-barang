import { create } from "zustand";

export const THEME_STORAGE_KEY = "app-theme";

export type Theme = "light" | "dark";

export const DEFAULT_THEME: Theme = "light";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Light is the product default, so an unset preference resolves to light rather
 * than following prefers-color-scheme. The OS hint is deliberately ignored: this
 * is shared office hardware where a dark-mode workstation would otherwise open
 * the portal in a palette nobody chose, and index.css declares light on :root to
 * match — so the first paint already agrees with this value before hydration.
 */
function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);

  return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export const useThemeStore = create<ThemeState>()((set) => {
  const theme = readStoredTheme();
  applyTheme(theme);

  return {
    theme,
    setTheme: (next) => {
      localStorage.setItem(THEME_STORAGE_KEY, next);
      applyTheme(next);
      set({ theme: next });
    },
  };
});
