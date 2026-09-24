// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManageMaintenancePage } from "./ManageMaintenancePage";

interface MaintenanceFormPayload {
  isEnabled: boolean;
  message: string;
  estimatedEndAt: string | null;
}

const state = vi.hoisted(() => ({
  status: { isEnabled: false, message: "Pesan bawaan", estimatedEndAt: null as string | null, updatedAt: null as string | null },
  mutateAsync: vi.fn(),
}));

vi.mock("../../maintenance/api/useMaintenance", () => ({
  useMaintenanceStatus: () => ({ data: state.status, isLoading: false, isError: false }),
  useUpdateMaintenance: () => ({ mutateAsync: state.mutateAsync, error: null, isPending: false }),
}));

beforeEach(() => {
  state.mutateAsync = vi.fn(async () => undefined);
  state.status = { isEnabled: false, message: "Pesan bawaan", estimatedEndAt: null, updatedAt: null };
});

afterEach(cleanup);

describe("ManageMaintenancePage", () => {
  it("offers a future 24-hour window as soon as maintenance is switched on", async () => {
    render(<ManageMaintenancePage />);

    fireEvent.click(screen.getByRole("checkbox"));

    const hour = screen.getByLabelText("Jam (24 jam)") as HTMLSelectElement;
    const minute = screen.getByLabelText("Menit") as HTMLSelectElement;
    expect(hour.tagName).toBe("SELECT");
    // The whole 24-hour range is offered, so the field never falls back to AM/PM.
    expect(Array.from(hour.options).map((option) => option.value)).toContain("23");
    expect(hour.value).toMatch(/^\d{2}$/);
    expect(minute.value).toMatch(/^\d{2}$/);
    expect((screen.getByLabelText("Tanggal") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    fireEvent.click(screen.getByRole("button", { name: /Simpan pengaturan/ }));

    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = state.mutateAsync.mock.calls[0][0] as MaintenanceFormPayload;
    expect(payload.isEnabled).toBe(true);
    expect(new Date(payload.estimatedEndAt ?? "").getTime()).toBeGreaterThan(Date.now());
  });

  it("follows the status back to off once the deadline passes and the site reopens", async () => {
    const view = render(<ManageMaintenancePage />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Simpan pengaturan/ }));
    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);

    // The server flips isEnabled off by itself when estimatedEndAt passes.
    state.status = { isEnabled: false, message: "Pesan bawaan", estimatedEndAt: null, updatedAt: null };
    view.rerender(<ManageMaintenancePage />);

    await waitFor(() => expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false));
  });

  it("refuses to submit a deadline that has already passed", async () => {
    render(<ManageMaintenancePage />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Tanggal"), { target: { value: "2020-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: /Simpan pengaturan/ }));

    expect(await screen.findByText("Perkiraan selesai harus tanggal dan jam yang akan datang")).toBeInTheDocument();
    expect(state.mutateAsync).not.toHaveBeenCalled();
  });
});