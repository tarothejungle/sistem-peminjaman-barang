import { useState } from "react";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { useAuthStore } from "../../../store/authStore";
import { Role, isAdministratorRole, type Room } from "../../../types";
import { useBookingAvailabilitySummary } from "../../bookings/api/useBookings";
import { BookingModal } from "../../bookings/components/BookingModal";
import { RoomCard } from "../../dashboard/components/RoomCard";
import { useRooms } from "../../rooms/api/useRooms";
import { CatalogPageShell } from "../components/CatalogPageShell";

export function RoomCatalogPage() {
  const user = useAuthStore((state) => state.user);
  const canBook = user?.role === Role.PEMOHON;
  const showStatus = canBook || isAdministratorRole(user?.role);
  const rooms = useRooms();
  const availability = useBookingAvailabilitySummary(showStatus);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  return <>
    <CatalogPageShell eyebrow="Katalog ruang rapat" title="Peminjaman Ruang Rapat" description="Pilih ruang rapat aktif, periksa fasilitas dan status jadwal, lalu ajukan peminjaman." countLabel="Ruang tersedia" count={rooms.data?.length ?? 0} isLoading={rooms.isLoading} isError={rooms.isError} emptyLabel="ruang rapat" onRetry={() => rooms.refetch()}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{rooms.data?.map((room) => <RoomCard key={room.id} room={room} availability={availability.data?.rooms.find((entry) => entry.resourceId === room.id)} availabilityLoading={availability.isLoading} canBook={canBook} showStatus={showStatus} onBook={setSelectedRoom} />)}</div>
    </CatalogPageShell>
    {canBook && <BookingModal resource={selectedRoom ? { type: "ROOM", room: selectedRoom } : null} onClose={() => setSelectedRoom(null)} onSuccess={() => setShowSuccess(true)} />}
    {showSuccess && <SuccessToast message="Pengajuan ruang rapat berhasil dikirim. Status awal: Menunggu Pemeriksaan PJ." onClose={() => setShowSuccess(false)} />}
  </>;
}
