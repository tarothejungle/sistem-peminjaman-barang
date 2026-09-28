import { AlertCircle, ClipboardCheck, Eye, RefreshCw, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { jakartaDateKey } from "../../../lib/datetime";
import { useAuthStore } from "../../../store/authStore";
import { Role, type Booking } from "../../../types";
import { useAllBookings } from "../../bookings/api/useBookings";
import { formatBookingCreatedAt, formatBookingSchedule, getBookingResourceName } from "../../bookings/bookingDisplay";
import { BookingActions } from "../../bookings/components/BookingActions";
import { BookingDocumentButton } from "../../bookings/components/BookingDocumentButton";
import { BookingStatusBadge } from "../../bookings/components/BookingStatusBadge";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { WhatsAppLink } from "../../../components/common/WhatsAppLink";

const PAGE_SIZE = 10;

export function AdminApprovalPage() {
  const user = useAuthStore((state) => state.user);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const bookingsQuery = useAllBookings();
  const rangeInvalid = Boolean(startDate && endDate && startDate > endDate);
  const filteredBookings = bookingsQuery.data?.filter((booking) => {
    if (rangeInvalid) return false;
    const bookingStart = jakartaDateKey(booking.alternativeStartTime ?? booking.startTime);
    const bookingEnd = jakartaDateKey(booking.alternativeEndTime ?? booking.endTime);
    if (startDate && bookingEnd < startDate) return false;
    if (endDate && bookingStart > endDate) return false;
    return true;
  });
  const pageCount = Math.ceil((filteredBookings?.length ?? 0) / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const pagedBookings = filteredBookings?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const canViewProcessingActors = user?.role === Role.PJ_RUANGAN || user?.role === Role.KASUBAG_UMUM;

  // The relocation offer closes with the booking window, so the table has to notice
  // the session boundary without a manual page reload.
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-7 text-ink shadow-2xl backdrop-blur-xl sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent-soft blur-[100px]" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-solid text-onaccent shadow-lg shadow-accent-glow"><ClipboardCheck size={24} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Panel pengelola</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Alur pemakaian ruang rapat</h2><p className="mt-2 text-sm text-ink-3">Tinjau jadwal, persetujuan, persiapan, dan inspeksi akhir.</p>{user?.role === Role.KABAG_UMUM && <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent-line bg-accent-soft px-3 py-2 text-xs font-bold text-accent"><Eye size={14} aria-hidden="true" />Mode monitoring (read-only): Anda melihat seluruh pengajuan tanpa mengubah statusnya.</p>}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">Dari tanggal
              <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">Sampai tanggal
              <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink" />
            </label>
            {(startDate || endDate) && <button type="button" onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Reset</button>}
          </div>
          <p className="text-sm text-ink-3">{bookingsQuery.isLoading ? "Memuat..." : `${filteredBookings?.length ?? 0} pengajuan`}</p>
        </div>
        {rangeInvalid && <p className="mt-3 text-sm font-semibold text-danger">Tanggal akhir tidak boleh lebih awal dari tanggal mulai.</p>}
      </section>

      {bookingsQuery.isLoading && <AdminTableSkeleton />}
      {bookingsQuery.isError && <AdminLoadError onRetry={() => bookingsQuery.refetch()} />}
      {!bookingsQuery.isError && filteredBookings?.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-panel-soft px-6 text-center"><SearchX size={40} className="text-ink-4" /><p className="mt-4 font-bold text-ink-2">Tidak ada pengajuan pada filter ini</p></div>}

      {pagedBookings && pagedBookings.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl"><div className="overflow-x-auto"><table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="border-b border-line bg-inset-soft text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-5 py-4 font-bold">Pemohon</th><th className="px-5 py-4 font-bold">Penanggung Jawab</th><th className="px-5 py-4 font-bold">Resource</th><th className="px-5 py-4 font-bold">Diajukan</th><th className="px-5 py-4 font-bold">Jadwal</th><th className="px-5 py-4 font-bold">Status</th>{canViewProcessingActors && <th className="px-5 py-4 font-bold">Diproses Oleh</th>}<th className="px-5 py-4 font-bold">Catatan Penolakan</th><th className="px-5 py-4 text-right font-bold">Aksi</th></tr></thead>
          <tbody className="divide-y divide-line">{pagedBookings.map((booking) => <tr key={booking.id} className="align-top hover:bg-hover"><td className="px-5 py-4"><p className="font-bold text-ink">{booking.user?.fullName ?? "Pengguna"}</p><p className="mt-1 text-xs text-ink-3">{booking.user?.email}</p></td><td className="px-5 py-4"><p className="font-bold text-ink">{booking.responsibleName}</p><WhatsAppLink phoneNumber={booking.phoneNumber} /></td><td className="max-w-xs px-5 py-4"><p className="font-bold text-ink">{getBookingResourceName(booking)}</p><p className="mt-1 line-clamp-2 text-xs text-ink-3">{booking.purpose}</p><BookingDocumentButton booking={booking} /></td><td className="px-5 py-4 text-ink-3">{formatBookingCreatedAt(booking.createdAt)}</td><td className="px-5 py-4 text-ink-3">{formatBookingSchedule(booking)}</td><td className="px-5 py-4"><BookingStatusBadge status={booking.status} /></td>{canViewProcessingActors && <td className="min-w-48 px-5 py-4 text-xs leading-5 text-ink-3"><ApprovalActors booking={booking} /></td>}<td className="max-w-xs px-5 py-4 text-xs leading-5 text-ink-3">{booking.rejectionReason ? <>{canViewProcessingActors && <span className="font-bold text-danger">{booking.rejectedByName ?? "Akun penolak"}</span>}<p>{booking.rejectionReason}</p></> : <span className="text-ink-4">Belum ada catatan</span>}</td><td className="px-5 py-4">{user && <BookingActions booking={booking} role={user.role} currentTime={currentTime} onSuccess={setFeedback} />}</td></tr>)}</tbody>
        </table></div>{pageCount > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 text-sm text-ink-3"><span>Halaman {currentPage} dari {pageCount} ({filteredBookings?.length ?? 0} pengajuan)</span><div className="flex gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-line px-3 py-2 font-bold transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-line px-3 py-2 font-bold transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button></div></div>}</div>
      )}

      {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}

function ApprovalActors({ booking }: { booking: Booking }) {
  if (!booking.pjReviewerName && !booking.kasubagReviewerName && !booking.rejectedByName) return <span className="text-ink-4">Belum diproses</span>;
  return <div className="space-y-1"><p><span className="font-bold text-ink-2">PJ:</span> {booking.pjReviewerName ?? "-"}</p><p><span className="font-bold text-ink-2">Kasubag:</span> {booking.kasubagReviewerName ?? "-"}</p>{booking.rejectedByName && <p className="font-semibold text-danger">Ditolak oleh {booking.rejectedByName}</p>}</div>;
}

function AdminTableSkeleton() {
  return <div className="space-y-2 rounded-2xl border border-line bg-panel p-5" aria-label="Memuat pengajuan">{["one", "two", "three", "four"].map((key) => <div key={key} className="h-16 animate-pulse rounded-xl bg-raised-soft" />)}</div>;
}

function AdminLoadError({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-danger-line bg-panel backdrop-blur-xl"><AlertCircle size={34} className="text-danger" /><p className="mt-4 font-bold text-ink">Pengajuan gagal dimuat</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-accent-hover"><RefreshCw size={15} /> Muat ulang</button></div>;
}
