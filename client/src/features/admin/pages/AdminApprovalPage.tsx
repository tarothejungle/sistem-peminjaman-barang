import { AlertCircle, ClipboardCheck, RefreshCw, SearchX } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { BookingStatus, type BookingStatus as BookingStatusType } from "../../../types";
import { useAllBookings } from "../../bookings/api/useBookings";
import { formatBookingCreatedAt, formatBookingSchedule, getBookingResourceName } from "../../bookings/bookingDisplay";
import { BookingActions } from "../../bookings/components/BookingActions";
import { BookingDocumentButton } from "../../bookings/components/BookingDocumentButton";
import { BookingStatusBadge } from "../../bookings/components/BookingStatusBadge";
import { SuccessToast } from "../../../components/common/SuccessToast";

type StatusFilter = "ALL" | BookingStatusType;

const filters: Array<{ label: string; value: StatusFilter }> = [
  { label: "Semua", value: "ALL" },
  { label: "Review PJ", value: BookingStatus.PENDING_PJ_REVIEW },
  { label: "Sedang Dipersiapkan", value: BookingStatus.PREPARING },
  { label: "Persetujuan Kabag", value: BookingStatus.PENDING_KABAG_APPROVAL },
  { label: "Disetujui", value: BookingStatus.APPROVED },
  { label: "Menunggu Inspeksi", value: BookingStatus.FINISHED_PENDING_INSPECTION },
  { label: "Selesai", value: BookingStatus.COMPLETED },
  { label: "Ditolak", value: BookingStatus.REJECTED },
];

export function AdminApprovalPage() {
  const user = useAuthStore((state) => state.user);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [feedback, setFeedback] = useState<string | null>(null);
  const bookingsQuery = useAllBookings(statusFilter === "ALL" ? undefined : statusFilter);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 px-6 py-7 text-white sm:px-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600"><ClipboardCheck size={24} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Panel pengelola</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Alur pemakaian ruang rapat</h2><p className="mt-2 text-sm text-slate-300">Tinjau jadwal, persetujuan, persiapan, dan inspeksi akhir.</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filter status peminjaman">
            {filters.map((filter) => <button key={filter.value} type="button" role="tab" aria-selected={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)} className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-bold transition ${statusFilter === filter.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>{filter.label}</button>)}
          </div>
          <p className="text-sm text-slate-500">{bookingsQuery.isLoading ? "Memuat..." : `${bookingsQuery.data?.length ?? 0} pengajuan`}</p>
        </div>
      </section>

      {bookingsQuery.isLoading && <AdminTableSkeleton />}
      {bookingsQuery.isError && <AdminLoadError onRetry={() => bookingsQuery.refetch()} />}
      {bookingsQuery.data?.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center"><SearchX size={40} className="text-slate-300" /><p className="mt-4 font-bold text-slate-800">Tidak ada pengajuan pada filter ini</p></div>}

      {bookingsQuery.data && bookingsQuery.data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4 font-bold">Pemohon</th><th className="px-5 py-4 font-bold">Resource</th><th className="px-5 py-4 font-bold">Diajukan</th><th className="px-5 py-4 font-bold">Jadwal</th><th className="px-5 py-4 font-bold">Status</th><th className="px-5 py-4 font-bold">Catatan Penolakan</th><th className="px-5 py-4 text-right font-bold">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{bookingsQuery.data.map((booking) => <tr key={booking.id} className="align-top hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-bold text-slate-900">{booking.user?.fullName ?? "Pengguna"}</p><p className="mt-1 text-xs text-slate-500">{booking.user?.email}</p></td><td className="max-w-xs px-5 py-4"><p className="font-bold text-slate-900">{getBookingResourceName(booking)}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{booking.purpose}</p><BookingDocumentButton booking={booking} /></td><td className="px-5 py-4 text-slate-600">{formatBookingCreatedAt(booking.createdAt)}</td><td className="px-5 py-4 text-slate-600">{formatBookingSchedule(booking)}</td><td className="px-5 py-4"><BookingStatusBadge status={booking.status} /></td><td className="max-w-xs px-5 py-4 text-xs leading-5 text-slate-600">{booking.rejectionReason ?? <span className="text-slate-400">Belum ada catatan</span>}</td><td className="px-5 py-4">{user && <BookingActions booking={booking} role={user.role} onSuccess={setFeedback} />}</td></tr>)}</tbody>
        </table></div></div>
      )}

      {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}

function AdminTableSkeleton() {
  return <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Memuat pengajuan">{["one", "two", "three", "four"].map((key) => <div key={key} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>;
}

function AdminLoadError({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white"><AlertCircle size={34} className="text-rose-500" /><p className="mt-4 font-bold">Pengajuan gagal dimuat</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"><RefreshCw size={15} /> Muat ulang</button></div>;
}
