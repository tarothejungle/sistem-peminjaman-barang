import { AlertCircle, CalendarRange, FileClock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { formatBookingCreatedAt, formatBookingSchedule, getBookingResourceName } from "../bookingDisplay";
import { useMyBookings } from "../api/useBookings";
import { BookingActions } from "../components/BookingActions";
import { BookingDocumentButton } from "../components/BookingDocumentButton";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { BookingModal, type BookingResource } from "../components/BookingModal";
import { ResourceType, type Booking } from "../../../types";
import { SuccessToast } from "../../../components/common/SuccessToast";

export function MyBookingsPage() {
  const bookingsQuery = useMyBookings();
  const user = useAuthStore((state) => state.user);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [editing, setEditing] = useState<Booking | null>(null);
  const editResource: BookingResource | null = editing?.resourceType === ResourceType.ROOM && editing.room
    ? { type: "ROOM", room: editing.room }
    : editing?.resourceType === ResourceType.ITEM && editing.bookingItems?.[0]?.item
      ? { type: "ITEM", item: editing.bookingItems[0].item }
      : null;

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 3_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Riwayat pribadi</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Pantau status peminjaman</h2>
          <p className="mt-2 text-sm text-slate-500">Semua pengajuan ditampilkan dari yang paling baru.</p>
        </div>
        <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total pengajuan</p>
          <p className="mt-1 text-xl font-bold">{bookingsQuery.isLoading ? "—" : bookingsQuery.data?.length ?? 0}</p>
        </div>
      </section>

      {bookingsQuery.isLoading && <BookingTableSkeleton />}

      {bookingsQuery.isError && (
        <PageError onRetry={() => bookingsQuery.refetch()} />
      )}

      {bookingsQuery.data?.length === 0 && (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
          <FileClock size={42} className="text-slate-300" aria-hidden="true" />
          <p className="mt-4 font-bold text-slate-800">Belum ada riwayat peminjaman</p>
          <p className="mt-1 text-sm text-slate-500">Pengajuan baru akan muncul di halaman ini.</p>
        </div>
      )}

      {bookingsQuery.data && bookingsQuery.data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-bold">ID Transaksi</th>
                  <th className="px-5 py-4 font-bold">Tanggal Pengajuan</th>
                  <th className="px-5 py-4 font-bold">Item / Ruangan</th>
                  <th className="px-5 py-4 font-bold">Jadwal</th>
                   <th className="px-5 py-4 font-bold">Status</th>
                   <th className="px-5 py-4 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookingsQuery.data.map((booking) => (
                  <tr key={booking.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-500" title={booking.id}>#{booking.id.slice(0, 8)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatBookingCreatedAt(booking.createdAt)}</td>
                    <td className="max-w-xs px-5 py-4">
                      <p className="font-bold text-slate-900">{getBookingResourceName(booking)}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{booking.purpose}</p>
                      <BookingDocumentButton booking={booking} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className="inline-flex items-start gap-2"><CalendarRange size={15} className="mt-0.5 shrink-0 text-slate-400" />{formatBookingSchedule(booking)}</span>
                    </td>
                    <td className="px-5 py-4"><BookingStatusBadge status={booking.status} />{booking.rejectionReason && <p className="mt-2 max-w-xs rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700"><span className="font-bold">Alasan:</span> {booking.rejectionReason}</p>}</td>
                    <td className="px-5 py-4 text-right">{user && <BookingActions booking={booking} role={user.role} currentTime={currentTime} onSuccess={setFeedback} onEdit={setEditing} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && editResource && <BookingModal resource={editResource} booking={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); setFeedback("Perubahan pengajuan berhasil disimpan."); }} />}

      {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}

function BookingTableSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Memuat riwayat peminjaman">
      {["one", "two", "three", "four"].map((key) => <div key={key} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
  );
}

interface PageErrorProps {
  onRetry: () => void;
}

function PageError({ onRetry }: PageErrorProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white px-6 text-center">
      <AlertCircle size={34} className="text-rose-500" aria-hidden="true" />
      <p className="mt-4 font-bold text-slate-900">Riwayat gagal dimuat</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"><RefreshCw size={15} /> Muat ulang</button>
    </div>
  );
}
