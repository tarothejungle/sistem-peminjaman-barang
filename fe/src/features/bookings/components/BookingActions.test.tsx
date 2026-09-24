// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingStatus, ResourceType, Role, type Booking, type Room } from "../../../types";
import { BookingActions } from "./BookingActions";

vi.mock("../../rooms/api/useRooms", () => ({
  useRooms: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../../settings/api/useRoomBookingSettings", () => ({
  useRoomBookingSettings: () => ({
    data: { id: 1, startTime: "08:00:00", endTime: "16:00:00", morningStartTime: "08:00:00", morningEndTime: "12:00:00", afternoonStartTime: "13:00:00", afternoonEndTime: "16:00:00", timezone: "Asia/Jakarta" },
    isLoading: false,
  }),
}));

const idleMutation = { isPending: false, isError: false, error: null, mutateAsync: vi.fn(), reset: vi.fn() };

vi.mock("../api/useBookings", () => ({
  useUpdateBookingStatus: () => idleMutation,
  useRelocateBooking: () => idleMutation,
  useDeletePendingBooking: () => idleMutation,
  useConfirmBookingFinished: () => idleMutation,
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

function booking(startTime: string, endTime: string, status: Booking["status"] = BookingStatus.APPROVED): Booking {
  return {
    id: "booking-1",
    userId: "user-1",
    resourceType: ResourceType.ROOM,
    roomId: mainRoom.id,
    startTime,
    endTime,
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
    rejectionReason: null,
    returnedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    room: mainRoom,
  };
}

const now = Date.parse("2026-09-10T04:00:00.000Z");

afterEach(cleanup);

describe("BookingActions alternative offer", () => {
  it("offers the alternative room only while the booking window is open", () => {
    render(<BookingActions booking={booking("2026-09-10T01:00:00.000Z", "2026-09-10T05:00:00.000Z")} role={Role.KASUBAG_UMUM} currentTime={now} />);

    expect(screen.getByRole("button", { name: /Beri Alternatif Ruangan/ })).toBeInTheDocument();
  });

  it("offers an alternative immediately after the booking is approved", () => {
    render(<BookingActions booking={booking("2026-09-12T01:00:00.000Z", "2026-09-12T05:00:00.000Z")} role={Role.KASUBAG_UMUM} currentTime={now} />);

    expect(screen.getByRole("button", { name: /Beri Alternatif Ruangan/ })).toBeInTheDocument();
  });

  it("withdraws the offer once the booking duration has ended", () => {
    render(<BookingActions booking={booking("2026-09-09T01:00:00.000Z", "2026-09-09T05:00:00.000Z")} role={Role.KASUBAG_UMUM} currentTime={now} />);

    expect(screen.queryByRole("button", { name: /Beri Alternatif Ruangan/ })).not.toBeInTheDocument();
  });

  it("keeps approve and reject but drops the expired alternative offer during kabag approval", () => {
    render(<BookingActions booking={booking("2026-09-09T01:00:00.000Z", "2026-09-09T05:00:00.000Z", BookingStatus.PENDING_KABAG_APPROVAL)} role={Role.KASUBAG_UMUM} currentTime={now} />);

    expect(screen.getByRole("button", { name: /Setujui/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tolak/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Beri Alternatif Ruangan/ })).not.toBeInTheDocument();
  });

  it("keeps the offer on a request that still waits for the KASUBAG decision", () => {
    render(<BookingActions booking={booking("2026-09-12T01:00:00.000Z", "2026-09-12T05:00:00.000Z", BookingStatus.PENDING_KABAG_APPROVAL)} role={Role.KASUBAG_UMUM} currentTime={now} />);

    expect(screen.getByRole("button", { name: /Beri Alternatif Ruangan/ })).toBeInTheDocument();
  });

  it("renders the alternative form through document body so table overflow cannot clip it", () => {
    render(<div className="overflow-hidden backdrop-blur-xl"><BookingActions booking={booking("2026-09-10T01:00:00.000Z", "2026-09-10T05:00:00.000Z")} role={Role.KASUBAG_UMUM} currentTime={now} /></div>);

    fireEvent.click(screen.getByRole("button", { name: /Beri Alternatif Ruangan/ }));

    const dialog = screen.getByRole("dialog", { name: "Beri Alternatif Ruangan" });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });

  it("shows the alternative action to PJ Ruangan after approval", () => {
    render(<BookingActions booking={booking("2026-09-10T01:00:00.000Z", "2026-09-10T05:00:00.000Z")} role={Role.PJ_RUANGAN} currentTime={now} />);

    expect(screen.getByRole("button", { name: /Beri Alternatif Ruangan/ })).toBeInTheDocument();
  });

  it("lets the administrator pick a configured session for the alternative schedule", () => {
    render(<BookingActions booking={booking("2026-09-10T01:00:00.000Z", "2026-09-10T05:00:00.000Z")} role={Role.KASUBAG_UMUM} currentTime={now} />);

    fireEvent.click(screen.getByRole("button", { name: /Beri Alternatif Ruangan/ }));

    // Every registered session is selectable; the request was single-day so nothing is locked.
    const morning = screen.getByRole("button", { name: /Pagi/ });
    const afternoon = screen.getByRole("button", { name: /Siang/ });
    expect(morning).toHaveTextContent("08:00 - 12:00 WIB");
    expect(afternoon).toHaveTextContent("13:00 - 16:00 WIB");
    expect(afternoon).toBeEnabled();

    fireEvent.click(afternoon);
    expect(afternoon).toHaveAttribute("aria-pressed", "true");
    expect(morning).toHaveAttribute("aria-pressed", "false");
  });

  it("locks a multi-day request to the full-day session", () => {
    render(<BookingActions booking={booking("2026-09-10T01:00:00.000Z", "2026-09-12T09:00:00.000Z")} role={Role.KASUBAG_UMUM} currentTime={now} />);

    fireEvent.click(screen.getByRole("button", { name: /Beri Alternatif Ruangan/ }));

    expect(screen.getByRole("button", { name: /Pagi/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Siang/ })).toBeDisabled();
    const fullDay = screen.getByRole("button", { name: /Sehari penuh/ });
    expect(fullDay).toBeEnabled();
    expect(fullDay).toHaveAttribute("aria-pressed", "true");
  });
});

describe("BookingActions borrower handover", () => {
  it("hides the room handover until the scheduled end", () => {
    render(<BookingActions booking={booking("2026-09-10T01:00:00.000Z", "2026-09-10T05:00:00.000Z")} role={Role.PEMOHON} currentTime={now} />);

    expect(screen.queryByRole("button", { name: /Konfirmasi Selesai Menggunakan/ })).not.toBeInTheDocument();
  });

  it("shows the room handover after the scheduled end", () => {
    render(<BookingActions booking={booking("2026-09-09T01:00:00.000Z", "2026-09-09T05:00:00.000Z")} role={Role.PEMOHON} currentTime={now} />);

    expect(screen.getByRole("button", { name: /Konfirmasi Selesai Menggunakan/ })).toBeInTheDocument();
  });

  it("uses an alternative schedule as the handover deadline", () => {
    const relocated = booking("2026-09-09T01:00:00.000Z", "2026-09-09T05:00:00.000Z", BookingStatus.IN_USE);
    relocated.alternativeStartTime = "2026-09-10T01:00:00.000Z";
    relocated.alternativeEndTime = "2026-09-10T03:00:00.000Z";
    render(<BookingActions booking={relocated} role={Role.PEMOHON} currentTime={now} />);

    expect(screen.getByRole("button", { name: /Konfirmasi Selesai Menggunakan/ })).toBeInTheDocument();
  });
});

describe("BookingActions read-only monitoring", () => {
  it("hides every approval action from KABAG on a pending request", () => {
    render(<BookingActions booking={booking("2026-09-10T01:00:00.000Z", "2026-09-10T05:00:00.000Z", BookingStatus.PENDING_KABAG_APPROVAL)} role={Role.KABAG_UMUM} currentTime={now} />);

    expect(screen.queryByRole("button", { name: /Setujui/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tolak/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Beri Alternatif Ruangan/ })).not.toBeInTheDocument();
  });

  it("hides the relocation action from KABAG on an approved request", () => {
    render(<BookingActions booking={booking("2026-09-10T01:00:00.000Z", "2026-09-10T05:00:00.000Z")} role={Role.KABAG_UMUM} currentTime={now} />);

    expect(screen.queryByRole("button", { name: /Beri Alternatif Ruangan/ })).not.toBeInTheDocument();
  });
});
