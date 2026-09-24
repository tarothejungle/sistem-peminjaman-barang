// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { BookingStatus, ResourceType, type Booking } from "../../../types";
import { filterBookingsForJakartaToday } from "./dashboardBookingHistory";

function booking(id: string, startTime: string, endTime: string): Booking {
  return {
    id,
    userId: "user-1",
    resourceType: ResourceType.ROOM,
    roomId: "room-1",
    startTime,
    endTime,
    purpose: "Rapat koordinasi",
    responsibleName: "Siti Rahma",
    phoneNumber: "081234567890",
    workUnit: "Bagian Umum",
    status: BookingStatus.APPROVED,
    alternativeRoomId: null,
    alternativeStartTime: null,
    alternativeEndTime: null,
    approvalNotes: null,
    inspectionNotes: null,
    rejectionReason: null,
    returnedAt: null,
    createdAt: startTime,
    updatedAt: startTime,
  };
}

describe("filterBookingsForJakartaToday", () => {
  it("includes bookings active on Jakarta calendar date and excludes others", () => {
    const now = new Date("2026-09-08T05:00:00.000Z");
    const result = filterBookingsForJakartaToday([
      booking("today", "2026-09-08T01:00:00.000Z", "2026-09-08T05:00:00.000Z"),
      booking("multi-day", "2026-09-07T01:00:00.000Z", "2026-09-09T05:00:00.000Z"),
      booking("tomorrow", "2026-09-09T01:00:00.000Z", "2026-09-09T05:00:00.000Z"),
    ], now);

    expect(result.map(({ id }) => id)).toEqual(["multi-day", "today"]);
  });
});
