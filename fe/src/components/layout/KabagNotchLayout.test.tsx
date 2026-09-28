// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/authStore";
import { Role, type User } from "../../types";
import { KabagNotchLayout } from "./KabagNotchLayout";

vi.mock("../ui/adaptive-notch-navigation-bar", () => ({
  NotchNav: ({ items, children }: { items: { id: string; label: string }[]; children: React.ReactNode }) => <div>{items.map((item) => <button key={item.id} type="button">{item.label}</button>)}{children}</div>,
}));

vi.mock("../../features/notifications/components/NotificationMenu", () => ({
  NotificationMenu: () => null,
}));

const kabag: User = {
  id: "kabag-1",
  fullName: "Kabag Umum",
  username: "kabag.umum",
  email: "kabag@example.test",
  role: Role.KABAG_UMUM,
  phoneNumber: null,
  creditScore: 100,
  profileImageUrl: null,
};

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, pendingLoginNotice: false, inactivityTimeoutSeconds: null, activityHeartbeatSeconds: null });
});

describe("KabagNotchLayout", () => {
  it("keeps reports and Disable Menu visible in notch", () => {
    useAuthStore.setState({ user: kabag, pendingLoginNotice: false, isInitialized: true });

    render(<MemoryRouter><KabagNotchLayout /></MemoryRouter>);

    expect(screen.getByRole("button", { name: "Laporan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable Menu" })).toBeInTheDocument();
  });
});
