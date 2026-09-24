import { AlertCircle, Coins, FileClock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { formatBookingCreatedAt, formatBookingDate, getBookingResourceName } from "../bookingDisplay";
import { useMyBookings } from "../api/useBookings";
import { BookingActions } from "../components/BookingActions";
import { BookingDocumentButton } from "../components/BookingDocumentButton";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { BookingModal, type BookingResource } from "../components/BookingModal";
import { ResourceType, Role, type Booking } from "../../../types";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { WhatsAppLink } from "../../../components/common/WhatsAppLink";

export function MyBookingsPage() {
  const bookingsQuery = useMyBookings();
  const user = useAuthStore((state) => state.user);
  const [feedback, setFeedback] = useState<string | null>(null);
  const isPemohon = user?.role === Role.PEMOHON;
  const canViewProcessingActors = user?.role === Role.PJ_RUANGAN || user?.role === Role.KASUBAG_UMUM;
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
      <section className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-6 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-end">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent-soft blur-[100px]" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Riwayat pribadi</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">Pantau status peminjaman</h2>
          <p className="mt-2 text-sm text-ink-3">Semua pengajuan ditampilkan dari yang paling baru.</p>
        </div>
        <div className="relative flex gap-3">
          <div className="rounded-xl border border-line bg-inset px-4 py-3 text-ink">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-4">Total pengajuan</p>
            <p className="mt-1 text-xl font-bold">{bookingsQuery.isLoading ? "-" : bookingsQuery.data?.length ?? 0}</p>
          </div>
          {isPemohon && (
            <div className="rounded-xl border border-accent-line bg-accent-soft px-4 py-3 text-accent">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"><Coins size={13} aria-hidden="true" /> Skor kredibilitas kendaraan</p>
              <p className="mt-1 text-xl font-bold">{user?.creditScore ?? "-"}</p>
            </div>
          )}
        </div>
      </section>

      {bookingsQuery.isLoading && <BookingTableSkeleton />}

      {bookingsQuery.isError && (
        <PageError onRetry={() => bookingsQuery.refetch()} />
      )}

      {bookingsQuery.data?.length === 0 && (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-panel-soft px-6 text-center">
          <FileClock size={42} className="text-ink-4" aria-hidden="true" />
          <p className="mt-4 font-bold text-ink-2">Belum ada riwayat peminjaman</p>
          <p className="mt-1 text-sm text-ink-3">Pengajuan baru akan muncul di halaman ini.</p>
        </div>
      )}

      {bookingsQuery.data && bookingsQuery.data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-line bg-inset-soft text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-5 py-4 font-bold">ID Transaksi</th>
                  <th className="px-5 py-4 font-bold">Nama Peminjam</th>
                  <th className="px-5 py-4 font-bold">No. Telepon</th>
                  <th className="px-5 py-4 font-bold">Kendaraan / Ruangan</th>
                  <th className="px-5 py-4 font-bold">Tanggal Pinjam</th>
                  <th className="px-5 py-4 font-bold">Tanggal Kembali</th>
                  <th className="px-5 py-4 font-bold">Surat &amp; Dokumen</th>
                  <th className="px-5 py-4 font-bold">Status Ketersediaan</th>
                  <th className="px-5 py-4 font-bold">Kembali Aktual</th>
                  <th className="px-5 py-4 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bookingsQuery.data.map((booking) => (
                  <tr key={booking.id} className="align-top transition hover:bg-hover">
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-ink-4" title={booking.id}>#{booking.id.slice(0, 8)}</td>
                    <td className="px-5 py-4 font-bold text-ink">{booking.responsibleName}</td>
                    <td className="px-5 py-4 text-ink-3"><WhatsAppLink phoneNumber={booking.phoneNumber} /></td>
                    <td className="max-w-xs px-5 py-4">
                      <p className="font-bold text-ink">{getBookingResourceName(booking)}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-3">{booking.purpose}</p>
                    </td>
                    <td className="px-5 py-4 text-ink-3">{formatBookingDate(booking.alternativeStartTime ?? booking.startTime)}</td>
                    <td className="px-5 py-4 text-ink-3">{formatBookingDate(booking.alternativeEndTime ?? booking.endTime)}</td>
                    <td className="px-5 py-4"><div className="flex flex-col items-start gap-2">{booking.suratTugasOriginalName && <BookingDocumentButton booking={booking} kind="suratTugas" />}{booking.documentOriginalName && <BookingDocumentButton booking={booking} />}{!booking.suratTugasOriginalName && !booking.documentOriginalName && <span className="text-ink-4">-</span>}</div></td>
                    <td className="px-5 py-4"><BookingStatusBadge status={booking.status} />{canViewProcessingActors && <><BookingApprovalHistory booking={booking} />{booking.rejectionReason && <p className="mt-2 max-w-xs rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-xs leading-5 text-danger"><span className="font-bold">Ditolak oleh {booking.rejectedByName ?? "akun pengelola"}:</span> {booking.rejectionReason}</p>}</>}</td>
                    <td className="px-5 py-4 text-ink-3">
                      {booking.returnedAt ? formatBookingCreatedAt(booking.returnedAt) : "-"}
                      {booking.autoConfirmedAt && <p className="mt-1 text-xs font-semibold text-warn">Dikonfirmasi otomatis</p>}
                    </td>
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

function BookingApprovalHistory({ booking }: { booking: Booking }) {
  if (!booking.pjReviewerName && !booking.kasubagReviewerName) return null;
  return <div className="mt-2 max-w-xs text-xs leading-5 text-ink-3">{booking.pjReviewerName && <p><span className="font-bold">PJ:</span> {booking.pjReviewerName}</p>}{booking.kasubagReviewerName && <p><span className="font-bold">Kasubag:</span> {booking.kasubagReviewerName}</p>}</div>;
}

function BookingTableSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl border border-line bg-panel p-5" aria-label="Memuat riwayat peminjaman">
      {["one", "two", "three", "four"].map((key) => <div key={key} className="h-14 animate-pulse rounded-xl bg-raised-soft" />)}
    </div>
  );
}

interface PageErrorProps {
  onRetry: () => void;
}

function PageError({ onRetry }: PageErrorProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-danger-line bg-panel px-6 text-center backdrop-blur-xl">
      <AlertCircle size={34} className="text-danger" aria-hidden="true" />
      <p className="mt-4 font-bold text-ink">Riwayat gagal dimuat</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-accent-hover"><RefreshCw size={15} /> Muat ulang</button>
    </div>
  );
}
