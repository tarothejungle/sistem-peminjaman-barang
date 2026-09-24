import type { RoomBookingSettings } from "../settings/api/useRoomBookingSettings";
import type { RoomBookingSlot } from "./api/useBookings";

export interface RoomSlotOption {
  value: RoomBookingSlot;
  label: string;
  startTime: string;
  endTime: string;
  /** Human readable range, e.g. "08:00 - 12:00". */
  time: string;
}

/**
 * Sessions registered in "Pengaturan Jam Ruangan", shared by the booking form and
 * the administrator alternative-room offer so both screens always show the same
 * hours. The fallbacks mirror the backend defaults for the first render before
 * the settings query resolves.
 */
export function roomSlotOptions(settings: RoomBookingSettings | undefined): RoomSlotOption[] {
  const time = (value: string | undefined, fallback: string) => value?.slice(0, 5) ?? fallback;
  const option = (value: RoomBookingSlot, label: string, startTime: string, endTime: string): RoomSlotOption => ({
    value,
    label,
    startTime,
    endTime,
    time: `${startTime} - ${endTime}`,
  });

  return [
    option("MORNING", "Pagi", time(settings?.morningStartTime, "08:00"), time(settings?.morningEndTime, "12:00")),
    option("AFTERNOON", "Siang", time(settings?.afternoonStartTime, "13:00"), time(settings?.afternoonEndTime, "16:00")),
    option("FULL_DAY", "Sehari penuh", time(settings?.startTime, "08:00"), time(settings?.endTime, "16:00")),
  ];
}

/** Resolves which configured session a stored schedule belongs to. */
export function matchRoomSlot(startTime: string, endTime: string, settings: RoomBookingSettings | undefined): RoomBookingSlot {
  const start = jakartaTime(startTime);
  const end = jakartaTime(endTime);
  return roomSlotOptions(settings).find((slot) => slot.startTime === start && slot.endTime === end)?.value ?? "FULL_DAY";
}

function jakartaTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}
