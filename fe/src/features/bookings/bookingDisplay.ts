import type { Booking } from "../../types";
import { ResourceType } from "../../types";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
});

export function getBookingResourceName(booking: Booking): string {
  if (booking.resourceType === ResourceType.ROOM) {
    return booking.alternativeRoom?.name ?? booking.room?.name ?? "Ruang rapat";
  }

  if (!booking.bookingItems?.length) {
    return "Kendaraan";
  }

  return booking.bookingItems
    .map(({ item, quantity }) => `${item?.name ?? "Kendaraan"} (${quantity})`)
    .join(", ");
}

export function formatBookingSchedule(booking: Booking): string {
  const start = new Date(booking.alternativeStartTime ?? booking.startTime);
  const end = new Date(booking.alternativeEndTime ?? booking.endTime);

  if (booking.resourceType === ResourceType.ROOM) {
    return `${dateTimeFormatter.format(start)} – ${dateTimeFormatter.format(end)}`;
  }

  return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

export function formatBookingDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function formatBookingCreatedAt(createdAt: string): string {
  return dateTimeFormatter.format(new Date(createdAt));
}
