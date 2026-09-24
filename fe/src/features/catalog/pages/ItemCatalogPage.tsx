import { useState } from "react";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { useAuthStore } from "../../../store/authStore";
import { Role, isAdministratorRole, type Item } from "../../../types";
import { useBookingAvailabilitySummary } from "../../bookings/api/useBookings";
import { BookingModal } from "../../bookings/components/BookingModal";
import { ItemCard } from "../../dashboard/components/ItemCard";
import { useItems } from "../../items/api/useItems";
import { CatalogPageShell } from "../components/CatalogPageShell";

export function ItemCatalogPage() {
  const user = useAuthStore((state) => state.user);
  const canBook = user?.role === Role.PEMOHON;
  const showStatus = canBook || isAdministratorRole(user?.role);
  const items = useItems();
  const availability = useBookingAvailabilitySummary(showStatus);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  return <>
    <CatalogPageShell eyebrow="Katalog inventaris" title="Peminjaman Kendaraan" description="Pilih kendaraan aktif, periksa stok dan status pemakaian, lalu ajukan peminjaman." countLabel="Jenis kendaraan" count={items.data?.length ?? 0} isLoading={items.isLoading} isError={items.isError} emptyLabel="kendaraan" onRetry={() => items.refetch()}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{items.data?.map((item) => <ItemCard key={item.id} item={item} availability={availability.data?.items.find((entry) => entry.resourceId === item.id)} availabilityLoading={availability.isLoading} canBook={canBook} showStatus={showStatus} onBook={setSelectedItem} />)}</div>
    </CatalogPageShell>
    {canBook && <BookingModal resource={selectedItem ? { type: "ITEM", item: selectedItem } : null} onClose={() => setSelectedItem(null)} onSuccess={() => setShowSuccess(true)} />}
    {showSuccess && <SuccessToast message="Pengajuan kendaraan berhasil dikirim. Status awal: Menunggu Pemeriksaan PJ." onClose={() => setShowSuccess(false)} />}
  </>;
}
