// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../../store/themeStore";
import { BrandLogo } from "./BrandLogo";

afterEach(() => {
  cleanup();
  useThemeStore.setState({ theme: "light" });
});

function logoSource(): string | null {
  return screen.getByRole("img", { name: "Logo Kementerian Ketenagakerjaan" }).getAttribute("src");
}

describe("BrandLogo", () => {
  it("uses the blue artwork on the light theme", () => {
    useThemeStore.setState({ theme: "light" });

    render(<BrandLogo />);

    expect(logoSource()).toMatch(/\/logo-kemnaker-biru\.png$/);
  });

  it("swaps to the white artwork on the dark theme", () => {
    useThemeStore.setState({ theme: "dark" });

    render(<BrandLogo />);

    expect(logoSource()).toMatch(/\/logo-kemnaker-putih\.png$/);
  });
});
