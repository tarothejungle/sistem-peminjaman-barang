import { describe, expect, it } from "vitest";
import { Role } from "../../types";
import { getNotificationDestination } from "./notificationDestination";

describe("getNotificationDestination", () => {
  it("routes USER notifications to booking status", () => {
    expect(getNotificationDestination(Role.PEMOHON)).toBe("/my-bookings");
  });

  it("routes approver notifications to booking approvals", () => {
    expect(getNotificationDestination(Role.PJ_RUANGAN)).toBe("/admin/approvals");
    expect(getNotificationDestination(Role.KABAG_UMUM)).toBe("/admin/approvals");
    expect(getNotificationDestination(Role.KASUBAG_UMUM)).toBe("/admin/approvals");
  });

  it("routes Kasubag cancellation notifications to cancellation history", () => {
    expect(getNotificationDestination(Role.KASUBAG_UMUM, "ROOM_BOOKING_CANCELLED")).toBe("/admin/room-booking-cancellations");
  });
});
