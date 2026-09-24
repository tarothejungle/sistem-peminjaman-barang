// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../store/authStore";
import { BookingStatus, ResourceType, Role, type Booking, type User } from "../../../types";
import { MyBookingsPage } from "./MyBookingsPage";

const bookings: Booking[] = [
  booking("approved-1", BookingStatus.APPROVED),
  booking("rejected-1", BookingStatus.REJECTED),
  booking("cancelled-1", BookingStatus.CANCELLED),
];

vi.mock("../api/useBookings", () => ({
  useMyBookings: () => ({ data: bookings, isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("../components/BookingActions", () => ({ BookingActions: () => null }));
vi.mock("../components/BookingDocumentButton", () => ({ BookingDocumentButton: () => null }));

function booking(id: string, status: BookingStatus): Booking {
  return {
    id,
    userId: "user-1",
    resourceType: ResourceType.ROOM,
    roomId: "room-1",
    startTime: "2026-09-25T01:00:00.000Z",
    endTime: "2026-09-25T05:00:00.000Z",
    purpose: "Rapat koordinasi",
    responsibleName: "Budi Santoso",
    phoneNumber: "081234567890",
    workUnit: "Bagian Umum",
    status,
    alternativeRoomId: null,
    alternativeStartTime: null,
    alternativeEndTime: null,
    approvalNotes: null,
    inspectionNotes: null,
    rejectionReason: status === BookingStatus.REJECTED ? "Jadwal tidak tersedia" : null,
    pjReviewedBy: "pj-1",
    pjReviewerName: "PJ Ruangan Satu",
    kasubagReviewedBy: "kasubag-1",
    kasubagReviewerName: "Kasubag Umum Satu",
    rejectedBy: status === BookingStatus.REJECTED ? "kasubag-1" : null,
    rejectedByName: status === BookingStatus.REJECTED ? "Kasubag Umum Satu" : null,
    returnedAt: null,
    createdAt: "2026-09-20T01:00:00.000Z",
    updatedAt: "2026-09-20T01:00:00.000Z",
  };
}

function user(role: Role): User {
  return {
    id: "user-1",
    fullName: "Budi Santoso",
    username: "budi",
    email: "budi@example.test",
    role,
    phoneNumber: "081234567890",
    creditScore: 100,
    profileImageUrl: null,
  };
}

beforeEach(() => useAuthStore.setState({ user: user(Role.PEMOHON) }));
afterEach(() => { cleanup(); useAuthStore.setState({ user: null }); });

describe("MyBookingsPage processing actors", () => {
  it("shows only booking statuses to PEMOHON", () => {
    render(<MyBookingsPage />);

    expect(screen.getByText("Disetujui")).toBeInTheDocument();
    expect(screen.getByText("Ditolak")).toBeInTheDocument();
    expect(screen.getByText("Dibatalkan")).toBeInTheDocument();
    expect(screen.queryByText("PJ Ruangan Satu")).not.toBeInTheDocument();
    expect(screen.queryByText("Kasubag Umum Satu")).not.toBeInTheDocument();
    expect(screen.queryByText("Jadwal tidak tersedia")).not.toBeInTheDocument();
  });

  it("shows processing actors to PJ Ruangan", () => {
    useAuthStore.setState({ user: user(Role.PJ_RUANGAN) });

    render(<MyBookingsPage />);

    expect(screen.getAllByText("PJ Ruangan Satu")).toHaveLength(3);
    expect(screen.getAllByText("Kasubag Umum Satu").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Jadwal tidak tersedia")).toBeInTheDocument();
  });
});
