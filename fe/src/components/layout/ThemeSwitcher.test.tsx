// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME, THEME_STORAGE_KEY, useThemeStore } from "../../store/themeStore";
import { ThemeSwitcher } from "./ThemeSwitcher";

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({ theme: "dark" });
  document.documentElement.dataset.theme = "dark";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThemeSwitcher", () => {
  it("applies the selected theme to the document and persists it", () => {
    render(<ThemeSwitcher collapsed={false} />);

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("keeps both options reachable in the compact variant used before login", () => {
    render(<ThemeSwitcher variant="compact" />);

    // The compact pill drops the visible "Tema" heading, so the group label and the
    // per-option names are the only things a screen reader has to work with.
    expect(screen.getByRole("radiogroup", { name: "Tema tampilan" })).toBeInTheDocument();
    expect(screen.queryByText("Tema")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("defaults to light when nothing is stored, ignoring a dark OS preference", () => {
    expect(DEFAULT_THEME).toBe("light");

    // matchMedia is stubbed to report a dark-mode OS so the assertion proves the
    // store ignores the hint rather than merely agreeing with the environment.
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, media: "", addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    localStorage.clear();
    vi.resetModules();

    return import("../../store/themeStore").then((module) => {
      expect(module.useThemeStore.getState().theme).toBe("light");
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });
});
