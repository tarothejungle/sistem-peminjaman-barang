// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Role, type Item, type Room } from "../../../types";
import { useAuthStore } from "../../../store/authStore";
import { tomorrowInJakarta } from "../../../lib/datetime";
import { BookingModal } from "./BookingModal";

vi.mock("../../settings/api/useRoomBookingSettings", () => ({
  useRoomBookingSettings: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("../api/useBookings", () => ({
  useCreateBooking: () => ({ isPending: false, isError: false, error: null, mutateAsync: vi.fn() }),
  useUpdatePendingBooking: () => ({ isPending: false, isError: false, error: null, mutateAsync: vi.fn() }),
  useBookingAvailability: () => ({
    data: { available: true, message: "Tersedia" },
    isFetching: false,
    refetch: vi.fn().mockResolvedValue({ data: { available: true, message: "Tersedia" } }),
  }),
}));

const room: Room = {
  id: "room-1",
  name: "Ruang Rapat A",
  capacity: 20,
  location: "Lantai 2",
  facilities: [],
  isActive: true,
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const vehicle: Item = {
  id: "item-1",
  name: "Toyota Hilux",
  totalStock: 2,
  category: "Kendaraan",
  plateNumber: "BE 1234 XY",
  isActive: true,
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const laptop: Item = { ...vehicle, id: "item-2", name: "Laptop Lenovo", category: "Elektronik", plateNumber: null };
afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  useAuthStore.setState({ user: null });
});

describe("BookingModal", () => {
  it("keeps form values when realtime availability causes the parent to rerender", () => {
    const props = { onClose: vi.fn(), onSuccess: vi.fn() };
    const { rerender } = render(<BookingModal {...props} resource={{ type: "ROOM", room }} />);

    fireEvent.change(screen.getByLabelText("Nama Penanggungjawab"), { target: { value: "Budi Santoso" } });
    fireEvent.change(screen.getByLabelText("No. Telepon"), { target: { value: "081234567890" } });
    fireEvent.change(screen.getByLabelText("Unit Kerja"), { target: { value: "Bagian Umum" } });
    fireEvent.change(screen.getByLabelText("Keperluan"), { target: { value: "Rapat koordinasi" } });

    rerender(<BookingModal {...props} resource={{ type: "ROOM", room: { ...room } }} />);

    expect(screen.getByLabelText("Nama Penanggungjawab")).toHaveValue("Budi Santoso");
    expect(screen.getByLabelText("No. Telepon")).toHaveValue("081234567890");
    expect(screen.getByLabelText("Unit Kerja")).toHaveValue("Bagian Umum");
    expect(screen.getByLabelText("Keperluan")).toHaveValue("Rapat koordinasi");
  });

  it("uses profile identity as the default booking contact", () => {
    useAuthStore.setState({ user: {
      id: "user-1",
      fullName: "Siti Rahma",
      username: "siti.rahma",
      email: "siti@example.test",
      role: Role.PEMOHON,
      phoneNumber: "081298765432",
      creditScore: 100,
      profileImageUrl: null,
    } });

    render(<BookingModal resource={{ type: "ROOM", room }} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByLabelText("Nama Penanggungjawab")).toHaveValue("Siti Rahma");
    expect(screen.getByLabelText("No. Telepon")).toHaveValue("081298765432");
  });

  it("starts the schedule at H-1 and refuses anything earlier", () => {
    render(<BookingModal resource={{ type: "ROOM", room }} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const start = screen.getByLabelText("Tanggal mulai");
    expect(start).toHaveValue(tomorrowInJakarta());
    expect(start).toHaveAttribute("min", tomorrowInJakarta());
  });
  it("asks a vehicle for a Surat Tugas right above the Keperluan field", () => {
    render(<BookingModal resource={{ type: "ITEM", item: vehicle }} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const suratTugas = screen.getByText("Surat Tugas (PDF, wajib)");
    const keperluan = screen.getByText("Keperluan");

    expect(suratTugas.compareDocumentPosition(keperluan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the Surat Tugas optional for a non-vehicle item", () => {
    render(<BookingModal resource={{ type: "ITEM", item: laptop }} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const suratTugas = screen.getByText("Surat Tugas (PDF, opsional)");
    const keperluan = screen.getByText("Keperluan");

    expect(suratTugas.compareDocumentPosition(keperluan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});