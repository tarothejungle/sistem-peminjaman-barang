import { ArrowUpRight, Boxes, CalendarClock, Car, LoaderCircle, PackageCheck, Tag } from "lucide-react";
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
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-line-strong">
      <div className="relative flex h-32 items-end overflow-hidden rounded-t-2xl bg-gradient-to-t from-raised-strong to-raised p-3">
        <ResourceImage
          url={item.imageUrl}
          alt={`Foto ${item.name}`}
          className="absolute inset-0 h-full w-full object-cover"
          fallback={
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-hover text-ink-2 backdrop-blur-sm">
                <Boxes size={26} aria-hidden="true" />
              </div>
            </div>
          }
        />
        {item.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-overlay via-transparent to-transparent" />}
        <span
          className={`relative rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm ${
            availability?.awaitingConfirmation
              ? "border-warn-line bg-warn-soft text-warn"
              : hasStock
                ? "border-ok-line bg-ok-soft text-ok"
                : "border-danger-line bg-danger-soft text-danger"
          }`}
        >
          {availability?.awaitingConfirmation ? "Menunggu konfirmasi" : hasStock ? "Tersedia sekarang" : "Sedang digunakan"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="truncate text-lg font-bold tracking-tight text-ink" title={item.name}>{item.name}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-ink-3">
          <Tag size={13} aria-hidden="true" className="text-ink-4" /> {item.category}
        </p>
        {item.plateNumber && <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-line bg-inset-soft px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-ink-2"><Car size={12} aria-hidden="true" className="text-ink-4" />{item.plateNumber}</p>}

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-inset px-3.5 py-3">
          <PackageCheck size={20} className="text-accent" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">Stok tersedia sekarang</p>
            <p className="text-sm font-bold text-ink">{availabilityLoading ? "Memeriksa..." : `${remainingNow} dari ${item.totalStock} unit`}</p>
          </div>
        </div>

        {showStatus && (
          <div className="mt-3 rounded-xl border border-warn-line bg-warn-soft p-3 text-warn">
            <div className="flex items-center gap-2 text-xs font-bold">{availabilityLoading ? <LoaderCircle size={15} className="animate-spin" /> : <CalendarClock size={15} />} Reservasi terdekat</div>
            <p className="mt-1.5 text-xs leading-5">{availabilityLoading ? "Memeriksa jadwal..." : availability?.nextStartTime && availability.nextEndTime ? `${availability.nextReservedQuantity} unit, ${formatReservation(availability.nextStartTime, availability.nextEndTime)}` : "Belum ada reservasi mendatang."}</p>
          </div>
        )}

        {canBook && (
          <button
            type="button"
            onClick={() => onBook(item)}
            disabled={!hasStock}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-solid px-4 py-2.5 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-raised-strong disabled:text-ink-3 disabled:shadow-none"
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
