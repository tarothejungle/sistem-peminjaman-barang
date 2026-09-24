// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../store/authStore";
import { BookingStatus, ResourceType, Role, type Booking, type Room, type User } from "../../../types";
import { AdminApprovalPage } from "./AdminApprovalPage";

const idleMutation = { isPending: false, isError: false, error: null, mutateAsync: vi.fn(), reset: vi.fn() };

vi.mock("../../bookings/api/useBookings", () => ({
  useAllBookings: () => ({ data: [pendingBooking], isLoading: false, isError: false, refetch: vi.fn() }),
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
