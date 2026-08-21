import { Activity, AlertCircle, Boxes, Building2, CalendarClock, CircleCheckBig, Clock3, PackageSearch, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { Role, type Item, type Room } from "../../../types";
import { BookingModal, type BookingResource } from "../../bookings/components/BookingModal";
import { type BookingAvailabilitySummary, useBookingAvailabilitySummary } from "../../bookings/api/useBookings";
import { useItems } from "../../items/api/useItems";
import { useRooms } from "../../rooms/api/useRooms";
import { ItemCard } from "../components/ItemCard";
import { RoomCard } from "../components/RoomCard";
import { SuccessToast } from "../../../components/common/SuccessToast";

type CatalogTab = "rooms" | "items";

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<CatalogTab>("rooms");
  const [bookingResource, setBookingResource] = useState<BookingResource | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const canBook = useAuthStore((state) => state.user?.role === Role.PEMOHON);
  const isKabag = useAuthStore((state) => state.user?.role === Role.KABAG_UMUM);
  const showStatus = canBook || isKabag;
  const roomsQuery = useRooms(activeTab === "rooms" || isKabag);
  const itemsQuery = useItems(activeTab === "items" || isKabag);
  const availabilitySummary = useBookingAvailabilitySummary(showStatus);
  const activeQuery = activeTab === "rooms" ? roomsQuery : itemsQuery;
  const activeCount = activeTab === "rooms" ? roomsQuery.data?.length : itemsQuery.data?.length;

  return (
    <div className="space-y-6">
      {isKabag ? <KabagRealtimeHeader rooms={roomsQuery.data ?? []} items={itemsQuery.data ?? []} summary={availabilitySummary.data} loading={availabilitySummary.isLoading} /> : <section className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-7 text-white sm:px-8 sm:py-9">
        <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full border-[28px] border-blue-500/10" />
        <div className="absolute right-24 top-8 h-16 w-16 rounded-full bg-blue-500/10 blur-xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-400">Katalog aktif</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">Pilih kebutuhan kerja, periksa detail, lalu ajukan.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Daftar hanya menampilkan ruang dan barang yang aktif.</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sedang dilihat</p>
              <p className="mt-1 text-xl font-bold">{activeQuery.isLoading ? "—" : activeCount ?? 0}</p>
            </div>
          </div>
        </div>
      </section>}

      <section aria-labelledby="catalog-heading">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 id="catalog-heading" className="text-xl font-bold tracking-tight text-slate-900">Katalog peminjaman</h2>
            <p className="mt-1 text-sm text-slate-500">Status pemakaian dan reservasi diperbarui otomatis setiap 3 detik.</p>
          </div>
          <div className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto" role="tablist" aria-label="Kategori katalog">
            <TabButton active={activeTab === "rooms"} onClick={() => setActiveTab("rooms")} icon={<Building2 size={16} />} label="Ruang Rapat" />
            <TabButton active={activeTab === "items"} onClick={() => setActiveTab("items")} icon={<Boxes size={16} />} label="Barang" />
          </div>
        </div>

        <div className="mt-5" role="tabpanel">
          {activeQuery.isLoading && <CatalogSkeleton />}

          {activeQuery.isError && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white px-6 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-700"><AlertCircle size={22} /></div>
              <p className="mt-4 font-bold text-slate-900">Katalog gagal dimuat</p>
              <p className="mt-1 text-sm text-slate-500">Periksa koneksi ke server, lalu coba lagi.</p>
              <button type="button" onClick={() => activeQuery.refetch()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
                <RefreshCw size={15} /> Muat ulang
              </button>
            </div>
          )}

          {!activeQuery.isLoading && !activeQuery.isError && activeCount === 0 && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
              <PackageSearch size={38} className="text-slate-300" aria-hidden="true" />
              <p className="mt-4 font-bold text-slate-800">Belum ada {activeTab === "rooms" ? "ruang rapat" : "barang"} aktif</p>
              <p className="mt-1 text-sm text-slate-500">Data akan muncul setelah tersedia dari pengelola.</p>
            </div>
          )}

          {activeTab === "rooms" && roomsQuery.data && roomsQuery.data.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {roomsQuery.data.map((room) => <RoomCard key={room.id} room={room} availability={availabilitySummary.data?.rooms.find((entry) => entry.resourceId === room.id)} availabilityLoading={availabilitySummary.isLoading} canBook={canBook} showStatus={showStatus} onBook={(selectedRoom) => setBookingResource({ type: "ROOM", room: selectedRoom })} />)}
            </div>
          )}

          {activeTab === "items" && itemsQuery.data && itemsQuery.data.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {itemsQuery.data.map((item) => <ItemCard key={item.id} item={item} availability={availabilitySummary.data?.items.find((entry) => entry.resourceId === item.id)} availabilityLoading={availabilitySummary.isLoading} canBook={canBook} showStatus={showStatus} onBook={(selectedItem) => setBookingResource({ type: "ITEM", item: selectedItem })} />)}
            </div>
          )}
        </div>
      </section>

      {canBook && <BookingModal
        resource={bookingResource}
        onClose={() => setBookingResource(null)}
        onSuccess={() => setShowSuccess(true)}
      />}

      {showSuccess && <SuccessToast message="Pengajuan berhasil dikirim. Status awal: Menunggu Pemeriksaan PJ." onClose={() => setShowSuccess(false)} />}
    </div>
  );
}

function KabagRealtimeHeader({ rooms, items, summary, loading }: { rooms: Room[]; items: Item[]; summary?: BookingAvailabilitySummary; loading: boolean }) {
  const roomInUse = summary?.rooms.filter((entry) => entry.state === "IN_USE").length ?? 0;
  const roomReserved = summary?.rooms.filter((entry) => entry.state === "RESERVED").length ?? 0;
  const roomAwaiting = summary?.rooms.filter((entry) => entry.state === "AWAITING_CONFIRMATION").length ?? 0;
  const itemInUse = summary?.items.reduce((total, entry) => total + Math.max(0, entry.reservedNow - entry.awaitingConfirmation), 0) ?? 0;
  const itemAwaiting = summary?.items.reduce((total, entry) => total + entry.awaitingConfirmation, 0) ?? 0;
  const availableRooms = Math.max(0, rooms.length - (summary?.rooms.length ?? 0));
  const totalItemStock = items.reduce((total, item) => total + item.totalStock, 0);
  const availableItems = Math.max(0, totalItemStock - itemInUse - itemAwaiting);
  const checkedAt = summary?.checkedAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(summary.checkedAt)) : "Menunggu sinkronisasi";

  return <section className="relative overflow-hidden rounded-2xl bg-[#07111f] p-6 text-white shadow-xl shadow-slate-300/40 sm:p-8">
    <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />
    <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
    <div className="relative">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div><div className="flex items-center gap-2 text-cyan-300"><Activity size={18} /><span className="text-xs font-black uppercase tracking-[0.28em]">Live Operations Board</span></div><h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Status Peminjaman Ruangan & Barang</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Pantauan operasional setelah approval KABAG. Data diperbarui otomatis setiap 3 detik.</p></div>
        <div className="flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3"><span className={`h-2.5 w-2.5 rounded-full ${loading ? "animate-pulse bg-amber-300" : "animate-pulse bg-emerald-400"}`} /><div><p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Sinkronisasi terakhir</p><p className="mt-1 text-xs font-semibold text-white">{loading ? "Menghubungkan..." : checkedAt}</p></div></div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LiveMetric icon={CircleCheckBig} label="Tersedia" value={`${availableRooms} ruang / ${availableItems} barang`} tone="emerald" />
        <LiveMetric icon={Activity} label="Sedang digunakan" value={`${roomInUse} ruang / ${itemInUse} barang`} tone="rose" />
        <LiveMetric icon={CalendarClock} label="Sudah dipesan" value={`${roomReserved} ruang`} tone="amber" />
        <LiveMetric icon={Clock3} label="Menunggu konfirmasi" value={`${roomAwaiting} ruang / ${itemAwaiting} barang`} tone="purple" />
      </div>
    </div>
  </section>;
}

function LiveMetric({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: "emerald" | "rose" | "amber" | "purple" }) {
  const tones = { emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-300", rose: "border-rose-300/20 bg-rose-300/10 text-rose-300", amber: "border-amber-300/20 bg-amber-300/10 text-amber-300", purple: "border-purple-300/20 bg-purple-300/10 text-purple-300" };
  return <div className={`rounded-xl border p-4 ${tones[tone]}`}><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Icon size={16} />{label}</div><p className="mt-3 text-xl font-black text-white">{value}</p></div>;
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition sm:flex-none ${active ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
    >
      {icon} {label}
    </button>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Memuat katalog">
      {["one", "two", "three", "four"].map((key) => (
        <div key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-40 animate-pulse bg-slate-200" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
