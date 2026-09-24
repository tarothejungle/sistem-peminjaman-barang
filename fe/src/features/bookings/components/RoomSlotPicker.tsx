import type { RoomBookingSettings } from "../../settings/api/useRoomBookingSettings";
import type { RoomBookingSlot } from "../api/useBookings";
import { roomSlotOptions } from "../roomSlots";

/**
 * Session selector shared by the booking form and the administrator
 * alternative-room offer, so both always present the sessions configured in
 * "Pengaturan Jam Ruangan".
 *
 * `lockedTo` pins the choice to one session (multi-day ranges are full-day only).
 */
export function RoomSlotPicker({ settings, value, lockedTo, onSelect }: { settings: RoomBookingSettings | undefined; value: RoomBookingSlot | undefined; lockedTo?: RoomBookingSlot; onSelect: (slot: RoomBookingSlot) => void }) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      {roomSlotOptions(settings).map((slot) => (
        <RoomSlotButton
          key={slot.value}
          slot={slot.value}
          label={slot.label}
          time={slot.time}
          selected={value === slot.value}
          disabled={lockedTo !== undefined && slot.value !== lockedTo}
          onSelect={() => onSelect(slot.value)}
        />
      ))}
    </div>
  );
}

function RoomSlotButton({ slot, label, time, selected, disabled, onSelect }: { slot: RoomBookingSlot; label: string; time: string; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect} className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-accent bg-accent-soft text-accent ring-2 ring-accent-ring" : "border-line text-ink-2 hover:border-accent-line"}`}><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs">{time} WIB</span><span className="sr-only">{slot}</span></button>;
}
