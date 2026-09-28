// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../store/authStore";
import { BookingStatus, ResourceType, Role, type Booking, type Room, type User } from "../../../types";
import { AdminApprovalPage } from "./AdminApprovalPage";

const idleMutation = { isPending: false, isError: false, error: null, mutateAsync: vi.fn(), reset: vi.fn() };
let bookings: Booking[];

vi.mock("../../bookings/api/useBookings", () => ({
  useAllBookings: () => ({ data: bookings, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateBookingStatus: () => idleMutation,
  useRelocateBooking: () => idleMutation,
  useDeletePendingBooking: () => idleMutation,
  useConfirmBookingFinished: () => idleMutation,
}));

vi.mock("../../rooms/api/useRooms", () => ({
  useRooms: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../../settings/api/useRoomBookingSettings", () => ({
  useRoomBookingSettings: () => ({
    data: { id: 1, startTime: "08:00:00", endTime: "16:00:00", morningStartTime: "08:00:00", morningEndTime: "12:00:00", afternoonStartTime: "13:00:00", afternoonEndTime: "16:00:00", timezone: "Asia/Jakarta" },
    isLoading: false,
  }),
}));

const mainRoom: Room = {
  id: "room-main",
  name: "Ruang Rapat Utama",
  capacity: 30,
  location: "Lantai 3",
  facilities: [],
  isActive: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const pendingBooking: Booking = {
  id: "booking-1",
  userId: "user-1",
  resourceType: ResourceType.ROOM,
  roomId: mainRoom.id,
  startTime: "2026-09-12T01:00:00.000Z",
  endTime: "2026-09-12T05:00:00.000Z",
  purpose: "Rapat koordinasi",
  responsibleName: "Budi Santoso",
  phoneNumber: "081234567890",
  workUnit: "Bagian Umum",
  status: BookingStatus.PENDING_KABAG_APPROVAL,
  alternativeRoomId: null,
  alternativeStartTime: null,
  alternativeEndTime: null,
  approvalNotes: null,
  inspectionNotes: null,
  rejectionReason: null,
  pjReviewedBy: "pj-1",
  pjReviewerName: "PJ Ruangan Satu",
  kasubagReviewedBy: null,
  kasubagReviewerName: null,
  rejectedBy: null,
  rejectedByName: null,
  returnedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  room: mainRoom,
};

function user(role: Role): User {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Siti Rahma",
    username: "siti.rahma",
    email: "siti@example.test",
    role,
    phoneNumber: null,
    creditScore: 100,
    profileImageUrl: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  bookings = [pendingBooking];
  useAuthStore.setState({ user: user(Role.KABAG_UMUM) });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
});

describe("AdminApprovalPage read-only monitoring", () => {
  it("tells Kabag the queue is read-only and withholds the approval buttons", () => {
    render(<AdminApprovalPage />);

    expect(screen.getByText(/Mode monitoring \(read-only\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Setujui$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tolak$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Beri Alternatif Ruangan/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Diproses Oleh")).not.toBeInTheDocument();
    expect(screen.queryByText("PJ Ruangan Satu")).not.toBeInTheDocument();
  });

  it("lets Kasubag approve the same request without the monitoring notice", () => {
    useAuthStore.setState({ user: user(Role.KASUBAG_UMUM) });

    render(<AdminApprovalPage />);

    expect(screen.queryByText(/Mode monitoring/)).not.toBeInTheDocument();
    expect(screen.getByText("Diproses Oleh")).toBeInTheDocument();
    expect(screen.getByText("PJ Ruangan Satu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Setujui$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tolak$/ })).toBeInTheDocument();
  });
});

describe("AdminApprovalPage booking list", () => {
  it("removes status navigation while retaining bookings and approval actions", () => {
    useAuthStore.setState({ user: user(Role.KASUBAG_UMUM) });
    bookings = [pendingBooking, { ...pendingBooking, id: "booking-2", status: BookingStatus.APPROVED, responsibleName: "Budi Disetujui" }];

    render(<AdminApprovalPage />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    for (const label of ["Review PJ", "Sedang Dipersiapkan", "Persetujuan Kasubag", "Disetujui", "Menunggu Inspeksi"]) {
      expect(screen.queryByRole("tab", { name: label })).not.toBeInTheDocument();
    }
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Budi Disetujui")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Setujui$/ })).toBeInTheDocument();
  });

  it("filters by Jakarta booking date range and resets pagination on change", () => {
    bookings = Array.from({ length: 11 }, (_, index) => ({ ...pendingBooking, id: `booking-${index + 1}`, responsibleName: `Pemohon ${index + 1}` }));
    bookings.push({ ...pendingBooking, id: "booking-other", responsibleName: "Pemohon Lain", startTime: "2026-09-20T01:00:00.000Z", endTime: "2026-09-20T05:00:00.000Z" });

    render(<AdminApprovalPage />);

    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Halaman 1 dari 2 (12 pengajuan)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(screen.getByText("Halaman 2 dari 2 (12 pengajuan)")).toBeInTheDocument();
    expect(screen.getByText("Pemohon Lain")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Dari tanggal"), { target: { value: "2026-09-12" } });
    fireEvent.change(screen.getByLabelText("Sampai tanggal"), { target: { value: "2026-09-12" } });
    expect(screen.getByText("Halaman 1 dari 2 (11 pengajuan)")).toBeInTheDocument();
    expect(screen.getByText("Pemohon 1")).toBeInTheDocument();
    expect(screen.queryByText("Pemohon Lain")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Pemohon 11")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sampai tanggal"), { target: { value: "2026-09-20" } });
    expect(screen.getByText("Halaman 1 dari 2 (12 pengajuan)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(screen.getByText("Pemohon Lain")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Dari tanggal"), { target: { value: "2026-09-25" } });
    fireEvent.change(screen.getByLabelText("Sampai tanggal"), { target: { value: "2026-09-26" } });
    expect(screen.getByText("Tidak ada pengajuan pada filter ini")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Halaman 1 dari 2 (12 pengajuan)")).toBeInTheDocument();
  });

  it("keeps a multi-day booking visible for any date inside the range", () => {
    bookings = [{ ...pendingBooking, startTime: "2026-09-15T01:00:00.000Z", endTime: "2026-09-25T05:00:00.000Z" }];
    render(<AdminApprovalPage />);

    fireEvent.change(screen.getByLabelText("Dari tanggal"), { target: { value: "2026-09-18" } });
    fireEvent.change(screen.getByLabelText("Sampai tanggal"), { target: { value: "2026-09-19" } });
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dari tanggal"), { target: { value: "2026-09-26" } });
    fireEvent.change(screen.getByLabelText("Sampai tanggal"), { target: { value: "2026-09-30" } });
    expect(screen.queryByText("Budi Santoso")).not.toBeInTheDocument();
  });

  it("shows only the start bound when the end date is left empty", () => {
    bookings = [
      { ...pendingBooking, id: "booking-early", responsibleName: "Pemohon Awal", startTime: "2026-09-10T01:00:00.000Z", endTime: "2026-09-10T05:00:00.000Z" },
      { ...pendingBooking, id: "booking-late", responsibleName: "Pemohon Akhir", startTime: "2026-09-20T01:00:00.000Z", endTime: "2026-09-20T05:00:00.000Z" },
    ];
    render(<AdminApprovalPage />);

    fireEvent.change(screen.getByLabelText("Dari tanggal"), { target: { value: "2026-09-15" } });
    expect(screen.queryByText("Pemohon Awal")).not.toBeInTheDocument();
    expect(screen.getByText("Pemohon Akhir")).toBeInTheDocument();
  });

  it("uses displayed alternative schedule for date filtering", () => {
    bookings = [{ ...pendingBooking, alternativeStartTime: "2026-09-13T01:00:00.000Z", alternativeEndTime: "2026-09-13T05:00:00.000Z" }];
    render(<AdminApprovalPage />);

    fireEvent.change(screen.getByLabelText("Dari tanggal"), { target: { value: "2026-09-12" } });
    fireEvent.change(screen.getByLabelText("Sampai tanggal"), { target: { value: "2026-09-12" } });
    expect(screen.queryByText("Budi Santoso")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dari tanggal"), { target: { value: "2026-09-13" } });
    fireEvent.change(screen.getByLabelText("Sampai tanggal"), { target: { value: "2026-09-13" } });
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
  });
});
