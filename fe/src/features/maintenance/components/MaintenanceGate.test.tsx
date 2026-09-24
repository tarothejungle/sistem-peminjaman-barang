// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../store/authStore";
import { Role, type User } from "../../../types";
import { MaintenanceGate } from "./MaintenanceGate";

const maintenance = vi.hoisted(() => ({
  status: { isEnabled: false, message: "Website sedang diperbaiki.", estimatedEndAt: null, updatedAt: null },
}));

vi.mock("../api/useMaintenance", () => ({
  useMaintenanceStatus: () => ({ data: maintenance.status, isLoading: false, isError: false }),
}));

const baseUser: User = {
  id: "user-1",
  fullName: "Siti Rahma",
  username: "siti.rahma",
  email: "siti@example.test",
  role: Role.PEMOHON,
  phoneNumber: "081234567890",
  creditScore: 100,
  profileImageUrl: null,
};

function renderGate(path = "/dashboard") {
  return render(<MemoryRouter initialEntries={[path]}><MaintenanceGate><p>aplikasi utama</p></MaintenanceGate></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  maintenance.status = { isEnabled: false, message: "Website sedang diperbaiki.", estimatedEndAt: null, updatedAt: null };
  useAuthStore.setState({ user: null, isInitialized: true });
});

describe("MaintenanceGate", () => {
  it("renders the application while maintenance mode is off", () => {
    useAuthStore.setState({ user: baseUser, isInitialized: true });

    renderGate();

    expect(screen.getByText("aplikasi utama")).toBeInTheDocument();
  });

  it("replaces the application with the notice for a borrower", () => {
    maintenance.status = { ...maintenance.status, isEnabled: true };
    useAuthStore.setState({ user: baseUser, isInitialized: true });

    renderGate();

    expect(screen.queryByText("aplikasi utama")).not.toBeInTheDocument();
    expect(screen.getByText("Website sedang dalam perbaikan")).toBeInTheDocument();
    expect(screen.getByText("Website sedang diperbaiki.")).toBeInTheDocument();
    // The administrator door must point at the route that skips the signed-in bounce.
    expect(screen.getByRole("link", { name: "Masuk sebagai administrator" })).toHaveAttribute("href", "/maintenance-login");
  });

  it("keeps working for an administrator so maintenance can be switched off", () => {
    maintenance.status = { ...maintenance.status, isEnabled: true };
    useAuthStore.setState({ user: { ...baseUser, role: Role.KASUBAG_UMUM }, isInitialized: true });

    renderGate();

    expect(screen.getByText("aplikasi utama")).toBeInTheDocument();
  });

  it("leaves the sign-in page reachable", () => {
    maintenance.status = { ...maintenance.status, isEnabled: true };
    useAuthStore.setState({ user: null, isInitialized: true });

    renderGate("/login");

    expect(screen.getByText("aplikasi utama")).toBeInTheDocument();
  });

  it("keeps the administrator door reachable while the site is closed", () => {
    maintenance.status = { ...maintenance.status, isEnabled: true };
    useAuthStore.setState({ user: null, isInitialized: true });

    renderGate("/maintenance-login");

    expect(screen.getByText("aplikasi utama")).toBeInTheDocument();
  });

  it("keeps the splash up until the session probe finishes", () => {
    maintenance.status = { ...maintenance.status, isEnabled: true };
    useAuthStore.setState({ user: null, isInitialized: false });

    renderGate();

    expect(screen.getByLabelText("Memuat sesi pengguna")).toBeInTheDocument();
    expect(screen.queryByText("aplikasi utama")).not.toBeInTheDocument();
  });
});