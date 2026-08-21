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
  const availabilityLabel = availability?.state === "AWAITING_CONFIRMATION" ? "Menunggu konfirmasi selesai" : availability?.state === "IN_USE" ? "Sedang digunakan" : availability ? "Sudah dipesan" : "Tersedia";
  const availabilityClass = availability?.state === "AWAITING_CONFIRMATION" ? "border-purple-200 bg-purple-50 text-purple-800" : availability?.state === "IN_USE" ? "border-rose-200 bg-rose-50 text-rose-800" : availability ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70">
      <div className="relative grid h-44 place-items-center overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.34),transparent_40%),linear-gradient(140deg,transparent_20%,rgba(255,255,255,0.07)_20%,rgba(255,255,255,0.07)_21%,transparent_21%)]" />
        <ResourceImage url={room.imageUrl} alt={`Foto ${room.name}`} className="absolute inset-0 h-full w-full object-cover" fallback={<div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-slate-200 backdrop-blur-sm"><Building2 size={30} aria-hidden="true" /></div>} />
        {room.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />}
        <span className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-slate-950/50 px-2.5 py-1 text-[11px] font-semibold text-slate-200 backdrop-blur-sm">
          Ruang rapat
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="truncate text-lg font-bold tracking-tight text-slate-900" title={room.name}>{room.name}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
          <span className="flex min-w-0 items-center gap-2">
            <UsersRound size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{room.capacity} orang</span>
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <MapPin size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate" title={room.location}>{room.location}</span>
          </span>
        </div>

        <div className="mt-4 flex min-h-7 flex-wrap gap-1.5">
          {room.facilities.length > 0 ? (
            room.facilities.slice(0, 4).map((facility) => (
              <span key={facility} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                {facility}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">Fasilitas belum dicatat</span>
          )}
          {room.facilities.length > 4 && (
            <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">+{room.facilities.length - 4}</span>
          )}
        </div>

        {showStatus && <div className={`mt-4 rounded-xl border px-3.5 py-3 ${availabilityLoading ? "border-slate-200 bg-slate-50 text-slate-500" : availabilityClass}`}>
          <div className="flex items-center gap-2 text-sm font-bold">{availabilityLoading ? <LoaderCircle size={16} className="animate-spin" /> : <CalendarClock size={16} />} {availabilityLoading ? "Memeriksa status..." : availabilityLabel}</div>
          {!availabilityLoading && availability && <p className="mt-1.5 text-xs leading-5">{formatReservation(availability.startTime, availability.endTime)}</p>}
          {!availabilityLoading && !availability && <p className="mt-1.5 text-xs">Belum ada peminjaman aktif atau terjadwal.</p>}
        </div>}

        {canBook && <button
          type="button"
          onClick={() => onBook(room)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Pinjam <ArrowUpRight size={16} aria-hidden="true" />
        </button>}
      </div>
    </article>
  );
}

function formatReservation(startTime: string, endTime: string): string {
  const format = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
  return `${format.format(new Date(startTime))} sampai ${format.format(new Date(endTime))}`;
}
