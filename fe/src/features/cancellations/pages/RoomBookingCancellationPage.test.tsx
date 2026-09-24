// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../store/authStore";
import { Role, type RoomBookingCancellation, type User } from "../../../types";
import { RoomBookingCancellationPage } from "./RoomBookingCancellationPage";

const cancellation: RoomBookingCancellation = {
  id: "cancel-1",
  bookingId: "booking-1",
  roomId: "room-1",
  requestedBy: "pj-1",
  requestedByName: "PJ Ruangan Satu",
  roomName: "Ruang Rapat Utama",
  workUnit: "Bagian Umum",
  responsibleName: "Budi Santoso",
  purpose: "Rapat koordinasi pimpinan",
  bookingStartTime: "2026-09-24T01:00:00.000Z",
  bookingEndTime: "2026-09-24T05:00:00.000Z",
  reason: "Agenda dibatalkan pimpinan",
  createdAt: "2026-09-23T01:00:00.000Z",
  updatedAt: "2026-09-23T01:00:00.000Z",
};

vi.mock("../api/useRoomBookingCancellations", () => ({
  useRoomBookingCancellationOptions: () => ({ data: [], isLoading: false }),
  useRoomBookingCancellations: () => ({ data: [cancellation], isLoading: false, isError: false }),
  useCancelRoomBooking: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
}));

function user(role: Role): User {
  return { id: "user-1", fullName: "Pengelola", username: "pengelola", email: "pengelola@example.test", role, phoneNumber: null, creditScore: null, profileImageUrl: null };
}

beforeEach(() => useAuthStore.setState({ user: user(Role.PJ_RUANGAN) }));
afterEach(() => { cleanup(); useAuthStore.setState({ user: null }); });

describe("RoomBookingCancellationPage", () => {
  it("shows cancellation form and history to PJ Ruangan", () => {
    render(<RoomBookingCancellationPage />);

    expect(screen.getByLabelText("Nama ruang rapat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batalkan Peminjaman" })).toBeInTheDocument();
    expect(screen.getAllByText("Keterangan / Keperluan")).toHaveLength(2);
    expect(screen.getByText("Rapat koordinasi pimpinan")).toBeInTheDocument();
    expect(screen.getByText("Agenda dibatalkan pimpinan")).toBeInTheDocument();
  });

  it("shows only cancellation history to Kasubag", () => {
    useAuthStore.setState({ user: user(Role.KASUBAG_UMUM) });
    render(<RoomBookingCancellationPage />);

    expect(screen.queryByLabelText("Nama ruang rapat")).not.toBeInTheDocument();
    expect(screen.getByText("Keterangan / Keperluan")).toBeInTheDocument();
    expect(screen.getByText("Rapat koordinasi pimpinan")).toBeInTheDocument();
    expect(screen.getByText("Agenda dibatalkan pimpinan")).toBeInTheDocument();
  });
});
