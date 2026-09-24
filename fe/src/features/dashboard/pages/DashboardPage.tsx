import { Activity, CalendarClock, CircleCheckBig, Clock3, History } from "lucide-react";
import { useAuthStore } from "../../../store/authStore";
import { ResourceType, Role, isAdministratorRole, type Booking, type Item, type Room } from "../../../types";
import { type BookingAvailabilitySummary, useAllBookings, useBookingAvailabilitySummary } from "../../bookings/api/useBookings";
import { formatBookingSchedule, getBookingResourceName } from "../../bookings/bookingDisplay";
import { BookingStatusBadge } from "../../bookings/components/BookingStatusBadge";
import { filterBookingsForJakartaToday } from "./dashboardBookingHistory";
import { useItems } from "../../items/api/useItems";
import { useRooms } from "../../rooms/api/useRooms";
import { LoginActivityPanel } from "../components/LoginActivityPanel";
import { ProfileDashboard } from "../../profile/components/ProfileDashboard";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = isAdministratorRole(user?.role);
  const isKabag = user?.role === Role.KABAG_UMUM;
  const roomsQuery = useRooms(isAdmin);
  const itemsQuery = useItems(isAdmin);
  const availabilitySummary = useBookingAvailabilitySummary(isAdmin);
  const bookingsQuery = useAllBookings(undefined, isKabag);
  const todayBookings = isKabag ? filterBookingsForJakartaToday(bookingsQuery.data ?? []) : [];

  return (
    <div className="space-y-8">
      {isAdmin ? (
        <>
          {isKabag && <KabagGreeting fullName={user.fullName} />}
          <LiveOpsBoard rooms={roomsQuery.data ?? []} items={itemsQuery.data ?? []} summary={availabilitySummary.data} loading={availabilitySummary.isLoading} />
          {isKabag && <TodayBookingHistory bookings={todayBookings} loading={bookingsQuery.isLoading} error={bookingsQuery.isError} onRetry={() => bookingsQuery.refetch()} />}
          <LoginActivityPanel />
        </>
      ) : (
        <ProfileDashboard />
      )}
    </div>
  );
}

function KabagGreeting({ fullName }: { fullName: string }) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  return (
    <section className="rounded-2xl border border-accent-line bg-accent-soft px-6 py-5">
      <p className="text-sm font-semibold text-accent">Dashboard KABAG UMUM</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">{greeting}, {fullName}</h1>
      <p className="mt-2 text-sm text-ink-3">Pantau persetujuan dan aktivitas peminjaman hari ini.</p>
    </section>
  );
}

function TodayBookingHistory({ bookings, loading, error, onRetry }: { bookings: Booking[]; loading: boolean; error: boolean; onRetry: () => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col justify-between gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-accent"><History size={17} /><span className="text-xs font-black uppercase tracking-[0.2em]">Aktivitas Hari Ini</span></div>
          <h2 className="mt-2 text-xl font-black text-ink">Riwayat Peminjaman Hari Ini</h2>
        </div>
        {!loading && !error && <span className="rounded-full border border-line bg-inset-soft px-3 py-1 text-xs font-bold text-ink-3">{bookings.length} peminjaman</span>}
      </div>

      {loading && <div className="grid gap-2 p-5" aria-label="Memuat riwayat peminjaman">{["one", "two", "three"].map((key) => <div key={key} className="h-14 animate-pulse rounded-xl bg-raised-soft" />)}</div>}
      {error && <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center"><p className="font-bold text-danger">Riwayat peminjaman gagal dimuat.</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent">Muat ulang</button></div>}
      {!loading && !error && bookings.length === 0 && <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center"><History size={32} className="text-ink-4" /><p className="mt-3 font-bold text-ink-2">Belum ada peminjaman hari ini</p></div>}

      {!loading && !error && bookings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-inset-soft text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-5 py-3 font-bold">Pemohon</th><th className="px-5 py-3 font-bold">Jenis</th><th className="px-5 py-3 font-bold">Resource</th><th className="px-5 py-3 font-bold">Jadwal</th><th className="px-5 py-3 font-bold">Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-hover">
                  <td className="px-5 py-4"><p className="font-bold text-ink">{booking.user?.fullName ?? booking.responsibleName}</p><p className="mt-1 text-xs text-ink-3">{booking.workUnit ?? "Unit kerja tidak tersedia"}</p></td>
                  <td className="px-5 py-4 font-semibold text-ink-2">{booking.resourceType === ResourceType.ROOM ? "Ruangan" : "Kendaraan"}</td>
                  <td className="max-w-xs px-5 py-4"><p className="font-bold text-ink">{getBookingResourceName(booking)}</p><p className="mt-1 line-clamp-1 text-xs text-ink-3">{booking.purpose}</p></td>
                  <td className="px-5 py-4 text-ink-3">{formatBookingSchedule(booking)}</td>
                  <td className="px-5 py-4"><BookingStatusBadge status={booking.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LiveOpsBoard({ rooms, items, summary, loading }: { rooms: Room[]; items: Item[]; summary?: BookingAvailabilitySummary; loading: boolean }) {
  const roomInUse = summary?.rooms.filter((entry) => entry.state === "IN_USE").length ?? 0;
  const roomReserved = summary?.rooms.filter((entry) => entry.state === "RESERVED").length ?? 0;
  const roomAwaiting = summary?.rooms.filter((entry) => entry.state === "AWAITING_CONFIRMATION").length ?? 0;
  const itemInUse = summary?.items.reduce((total, entry) => total + Math.max(0, entry.reservedNow - entry.awaitingConfirmation), 0) ?? 0;
  const itemAwaiting = summary?.items.reduce((total, entry) => total + entry.awaitingConfirmation, 0) ?? 0;
  const availableRooms = Math.max(0, rooms.length - (summary?.rooms.length ?? 0));
  const totalItemStock = items.reduce((total, item) => total + item.totalStock, 0);
  const availableItems = Math.max(0, totalItemStock - itemInUse - itemAwaiting);
  const checkedAt = summary?.checkedAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(summary.checkedAt)) : "Menunggu sinkronisasi";

  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-line bg-panel-strong p-6 text-ink shadow-2xl backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent-soft blur-[100px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.4] [background-image:linear-gradient(var(--login-grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--login-grid-line)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-info"><Activity size={16} /><span className="text-xs font-bold uppercase tracking-[0.28em]">Live Operations Board</span></div>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Status Peminjaman Ruangan &amp; Kendaraan</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-3">Pantauan operasional setelah approval KABAG. Data diperbarui otomatis setiap 3 detik.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-info-line bg-info-soft px-4 py-3">
            <span className={`h-2.5 w-2.5 rounded-full ${loading ? "animate-pulse bg-warn" : "animate-pulse bg-ok"}`} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-info">Sinkronisasi terakhir</p>
              <p className="mt-1 text-xs font-semibold text-ink">{loading ? "Menghubungkan..." : checkedAt}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LiveMetric icon={CircleCheckBig} label="Tersedia" value={`${availableRooms} ruang / ${availableItems} kendaraan`} tone="emerald" />
          <LiveMetric icon={Activity} label="Sedang digunakan" value={`${roomInUse} ruang / ${itemInUse} kendaraan`} tone="rose" />
          <LiveMetric icon={CalendarClock} label="Sudah dipesan" value={`${roomReserved} ruang`} tone="amber" />
          <LiveMetric icon={Clock3} label="Menunggu konfirmasi" value={`${roomAwaiting} ruang / ${itemAwaiting} kendaraan`} tone="purple" />
        </div>
      </div>
    </section>
  );
}

function LiveMetric({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: "emerald" | "rose" | "amber" | "purple" }) {
  const tones = {
    emerald: "border-ok-line text-ok",
    rose: "border-danger-line text-danger",
    amber: "border-warn-line text-warn",
    purple: "border-alt-line text-alt",
  };
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-inset p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><Icon size={16} />{label}</div>
      <p className="mt-3 text-xl font-black text-ink">{value}</p>
    </div>
  );
}
