import type { Booking } from "../../../types";
import { jakartaDateKey } from "../../../lib/datetime";

export function filterBookingsForJakartaToday(bookings: Booking[], now = new Date()): Booking[] {
  const today = jakartaDateKey(now);

  return bookings
    .filter((booking) => {
      const start = new Date(booking.alternativeStartTime ?? booking.startTime);
      const end = new Date(booking.alternativeEndTime ?? booking.endTime);
      return jakartaDateKey(start) <= today && jakartaDateKey(end) >= today;
    })
    .sort((left, right) => new Date(left.alternativeStartTime ?? left.startTime).getTime() - new Date(right.alternativeStartTime ?? right.startTime).getTime());
}
