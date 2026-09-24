import { Role, type Role as RoleType } from "../../types";

export function getNotificationDestination(role?: RoleType, type?: string): string {
  if (type === "ROOM_BOOKING_CANCELLED" && role === Role.KASUBAG_UMUM) return "/admin/room-booking-cancellations";
  return role === Role.PEMOHON ? "/my-bookings" : "/admin/approvals";
}
