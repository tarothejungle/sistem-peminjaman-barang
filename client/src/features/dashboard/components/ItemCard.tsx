import { ArrowUpRight, Boxes, CalendarClock, LoaderCircle, PackageCheck, Tag } from "lucide-react";
import type { Item } from "../../../types";
import type { ItemAvailabilitySummary } from "../../bookings/api/useBookings";
import { ResourceImage } from "../../../components/common/ResourceImage";

interface ItemCardProps {
  item: Item;
  onBook: (item: Item) => void;
  canBook: boolean;
  availability?: ItemAvailabilitySummary;
  availabilityLoading: boolean;
  showStatus: boolean;
}

export function ItemCard({ item, onBook, canBook, showStatus, availability, availabilityLoading }: ItemCardProps) {
  const remainingNow = Math.max(0, item.totalStock - (availability?.reservedNow ?? 0));
  const hasStock = remainingNow > 0;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70">
      <div className="relative grid h-36 place-items-center overflow-hidden bg-gradient-to-br from-slate-100 to-blue-50">
        <div className="absolute right-4 top-4 h-16 w-16 rounded-full border border-blue-100" />
        <div className="absolute -bottom-8 -left-7 h-24 w-24 rounded-full bg-blue-100/70" />
        <ResourceImage url={item.imageUrl} alt={`Foto ${item.name}`} className="absolute inset-0 h-full w-full object-cover" fallback={<Boxes className="relative text-slate-700 transition-transform duration-200 group-hover:scale-105" size={42} aria-hidden="true" />} />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold tracking-tight text-slate-900" title={item.name}>{item.name}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Tag size={13} aria-hidden="true" /> {item.category}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${hasStock ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
            {availability?.awaitingConfirmation ? "Menunggu konfirmasi" : hasStock ? "Tersedia sekarang" : "Sedang digunakan"}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <PackageCheck size={20} className="text-blue-600" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stok tersedia sekarang</p>
            <p className="text-sm font-bold text-slate-800">{availabilityLoading ? "Memeriksa..." : `${remainingNow} dari ${item.totalStock} unit`}</p>
          </div>
        </div>

        {showStatus && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-800">
          <div className="flex items-center gap-2 text-xs font-bold">{availabilityLoading ? <LoaderCircle size={15} className="animate-spin" /> : <CalendarClock size={15} />} Reservasi terdekat</div>
          <p className="mt-1.5 text-xs leading-5">{availabilityLoading ? "Memeriksa jadwal..." : availability?.nextStartTime && availability.nextEndTime ? `${availability.nextReservedQuantity} unit, ${formatReservation(availability.nextStartTime, availability.nextEndTime)}` : "Belum ada reservasi mendatang."}</p>
        </div>}

        {canBook && <button
          type="button"
          onClick={() => onBook(item)}
          disabled={!hasStock}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
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
