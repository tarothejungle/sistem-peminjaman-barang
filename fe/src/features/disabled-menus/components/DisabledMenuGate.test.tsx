// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisabledMenuGate } from "./DisabledMenuGate";

const { useDisabledMenus } = vi.hoisted(() => ({
  useDisabledMenus: vi.fn(),
}));
vi.mock("../api/useDisabledMenus", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/useDisabledMenus")>(),
  useDisabledMenus,
}));

function Location() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderGate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route element={<DisabledMenuGate />}>
          <Route path="/admin/reports" element={<div>Laporan aktif</div>} />
          <Route path="/peminjaman-ruang-rapat" element={<div>Peminjaman aktif</div>} />
        </Route>
        <Route path="/admin/disabled-menus" element={<div>Pengaturan menu tersedia</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  useDisabledMenus.mockReset();
});

describe("DisabledMenuGate", () => {
  it.each([
    ["/admin/reports", "reports"],
    ["/peminjaman-ruang-rapat", "room-booking"],
  ])("shows development message at disabled direct URL %s without redirect", (path, key) => {
    useDisabledMenus.mockReturnValue({ data: { disabledMenuKeys: [key] }, isLoading: false, isError: false });

    renderGate(path);

    expect(screen.getByRole("status")).toHaveTextContent("Menu Sedang Dalam Pengembangan");
    expect(screen.getByTestId("location")).toHaveTextContent(path);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("renders enabled page and keeps settings reachable", () => {
    useDisabledMenus.mockReturnValue({ data: { disabledMenuKeys: ["reports"] }, isLoading: false, isError: false });

    renderGate("/peminjaman-ruang-rapat");
    expect(screen.getByText("Peminjaman aktif")).toBeInTheDocument();
    cleanup();

    renderGate("/admin/disabled-menus");
    expect(screen.getByText("Pengaturan menu tersedia")).toBeInTheDocument();
  });

  it("does not expose disabled page when settings fail to load", () => {
    useDisabledMenus.mockReturnValue({ isLoading: false, isError: true });

    renderGate("/admin/reports");

    expect(screen.getByRole("alert")).toHaveTextContent("Status menu gagal dimuat.");
    expect(screen.queryByText("Laporan aktif")).not.toBeInTheDocument();
  });
});
