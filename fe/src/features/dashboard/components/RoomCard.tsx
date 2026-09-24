import { ArrowUpRight, Building2, CalendarClock, LoaderCircle, MapPin, UsersRound } from "lucide-react";
import type { Room } from "../../../types";
import type { RoomAvailabilitySummary } from "../../bookings/api/useBookings";
import { ResourceImage } from "../../../components/common/ResourceImage";

interface RoomCardProps {
  room: Room;
  onBook: (room: Room) => void;
  canBook: boolean;
  availability?: RoomAvailabilitySummary;
  availabilityLoading: boolean;
  showStatus: boolean;
}

export function RoomCard({ room, onBook, canBook, showStatus, availability, availabilityLoading }: RoomCardProps) {
  const availabilityLabel =
    availability?.state === "AWAITING_CONFIRMATION"
      ? "Menunggu konfirmasi selesai"
      : availability?.state === "IN_USE"
        ? "Sedang digunakan"
        : availability
          ? "Sudah dipesan"
          : "Tersedia";
  const availabilityClass =
    availability?.state === "AWAITING_CONFIRMATION"
      ? "border-alt-line bg-alt-soft text-alt"
      : availability?.state === "IN_USE"
        ? "border-danger-line bg-danger-soft text-danger"
        : availability
          ? "border-warn-line bg-warn-soft text-warn"
          : "border-ok-line bg-ok-soft text-ok";

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-line-strong">
      <div className="relative flex h-32 items-end overflow-hidden rounded-t-2xl bg-gradient-to-t from-raised-strong to-raised p-3">
        <ResourceImage
          url={room.imageUrl}
          alt={`Foto ${room.name}`}
          className="absolute inset-0 h-full w-full object-cover"
          fallback={
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-hover text-ink-2 backdrop-blur-sm">
                <Building2 size={26} aria-hidden="true" />
              </div>
            </div>
          }
        />
        {room.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-overlay via-transparent to-transparent" />}
        <span className="relative rounded-full border border-line bg-inset px-2.5 py-1 text-[11px] font-semibold text-ink-2 backdrop-blur-sm">
          Ruang rapat
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="truncate text-lg font-bold tracking-tight text-ink" title={room.name}>{room.name}</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <UsersRound size={14} className="shrink-0 text-ink-4" aria-hidden="true" />
            <span className="truncate">{room.capacity} orang</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin size={14} className="shrink-0 text-ink-4" aria-hidden="true" />
            <span className="truncate" title={room.location}>{room.location}</span>
          </span>
        </div>

        <div className="mt-4 flex min-h-7 flex-wrap gap-1.5">
          {room.facilities.length > 0 ? (
            room.facilities.slice(0, 4).map((facility) => (
              <span key={facility} className="flex items-center gap-1 rounded-md border border-line bg-raised px-2 py-1 text-[10px] font-medium text-ink-2">
                {facility}
              </span>
            ))
          ) : (
            <span className="text-xs text-ink-4">Fasilitas belum dicatat</span>
          )}
          {room.facilities.length > 4 && (
            <span className="rounded-md border border-accent-line bg-accent-soft px-2 py-1 text-[10px] font-semibold text-accent">+{room.facilities.length - 4}</span>
          )}
        </div>

        {showStatus && (
          <div className={`mt-4 rounded-xl border p-3 text-xs ${availabilityLoading ? "border-line bg-inset-soft text-ink-3" : availabilityClass}`}>
            <div className="flex items-center gap-2 text-sm font-bold">
              {availabilityLoading ? <LoaderCircle size={16} className="animate-spin" /> : <CalendarClock size={16} />} {availabilityLoading ? "Memeriksa status..." : availabilityLabel}
            </div>
            {!availabilityLoading && availability && <p className="mt-1.5 leading-5">{formatReservation(availability.startTime, availability.endTime)}</p>}
            {!availabilityLoading && !availability && <p className="mt-1.5">Belum ada peminjaman aktif atau terjadwal.</p>}
          </div>
        )}

        {canBook && (
          <button
            type="button"
            onClick={() => onBook(room)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-solid px-4 py-2.5 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Pinjam <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

function formatReservation(startTime: string, endTime: string): string {
  const format = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
  return `${format.format(new Date(startTime))} sampai ${format.format(new Date(endTime))}`;
}
