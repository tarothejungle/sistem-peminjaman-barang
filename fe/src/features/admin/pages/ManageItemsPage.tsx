import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Item } from "../../../types";
import { ResourceImage } from "../../../components/common/ResourceImage";
import { useCreateItem, useItems, useUpdateItem } from "../../items/api/useItems";
import { getAdminErrorMessage } from "./adminPage.utils";
import { AdminHeader, EmptyState, inputClass, LoadError, TableSkeleton } from "./ManageRoomsPage";
import { SuccessToast } from "../../../components/common/SuccessToast";

const itemFormSchema = z.object({
  name: z.string().trim().min(1, "Nama kendaraan wajib diisi").max(100),
  category: z.string().trim().min(1, "Kategori wajib diisi").max(50),
  totalStock: z.coerce.number().int().nonnegative("Stok tidak boleh negatif"),
  plateNumber: z.string().trim().max(20, "Plat nomor maksimal 20 karakter").optional(),
  image: z.instanceof(FileList).optional(),
}).superRefine((data, context) => {
  const file = data.image?.[0];
  if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) context.addIssue({ code: "custom", path: ["image"], message: "Foto harus JPEG, PNG, atau WebP" });
  if (file && file.size > 5 * 1024 * 1024) context.addIssue({ code: "custom", path: ["image"], message: "Ukuran foto maksimal 5 MB" });
});
type ItemForm = z.infer<typeof itemFormSchema>;

export function ManageItemsPage() {
  const itemsQuery = useItems();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  return <div className="space-y-6">
    <AdminHeader icon={<Boxes size={23} />} title="Kelola Kendaraan" description="Atur inventaris, kategori, dan jumlah stok." addLabel="Tambah kendaraan" onAdd={() => { setEditingItem(null); setShowForm(true); }} />
    {itemsQuery.isLoading && <TableSkeleton />}
    {itemsQuery.isError && <LoadError onRetry={() => itemsQuery.refetch()} />}
    {itemsQuery.data?.length === 0 && <EmptyState label="Belum ada kendaraan aktif" />}
    {itemsQuery.data && itemsQuery.data.length > 0 && <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl"><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="border-b border-line bg-inset-soft text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-5 py-4">Foto</th><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Kategori</th><th className="px-5 py-4">Plat Nomor</th><th className="px-5 py-4">Total Stok</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-line">{itemsQuery.data.map((item) => <tr key={item.id} className="hover:bg-hover"><td className="px-5 py-4"><div className="grid h-12 w-16 place-items-center overflow-hidden rounded-lg bg-raised-strong text-ink-4"><ResourceImage url={item.imageUrl} alt={`Foto ${item.name}`} className="h-full w-full object-cover" fallback={<Boxes size={20} />} /></div></td><td className="px-5 py-4 font-bold text-ink">{item.name}</td><td className="px-5 py-4 text-ink-3">{item.category}</td><td className="px-5 py-4 text-ink-3">{item.plateNumber ?? "-"}</td><td className="px-5 py-4"><span className="rounded-lg border border-accent-line bg-accent-soft px-2.5 py-1 text-sm font-bold text-accent">{item.totalStock} unit</span></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => { setEditingItem(item); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-2 transition hover:bg-hover hover:text-ink"><Pencil size={14} /> Edit</button></td></tr>)}</tbody></table></div></div>}
    {showForm && <ItemFormModal key={editingItem?.id ?? "create"} item={editingItem} onClose={() => setShowForm(false)} onSaved={(message) => { setShowForm(false); setFeedback(message); }} />}
    {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
  </div>;
}

function ItemFormModal({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: (message: string) => void }) {
  const createItem = useCreateItem(); const updateItem = useUpdateItem(); const mutation = item ? updateItem : createItem;
  const { register, handleSubmit, formState: { errors } } = useForm<ItemForm>({ resolver: zodResolver(itemFormSchema), defaultValues: { name: item?.name ?? "", category: item?.category ?? "", totalStock: item?.totalStock ?? 0, plateNumber: item?.plateNumber ?? "" } });
  const submit = handleSubmit(async (form) => { const input = { name: form.name, category: form.category, totalStock: form.totalStock, plateNumber: form.plateNumber ?? "", image: form.image?.[0] }; try { if (item) await updateItem.mutateAsync({ itemId: item.id, ...input }); else await createItem.mutateAsync(input); onSaved(item ? "Kendaraan berhasil diperbarui." : "Kendaraan berhasil ditambahkan."); } catch { /* Mutation feedback renders in modal. */ } });
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-overlay px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl"><div className="flex items-center border-b border-line p-5"><h2 className="flex-1 text-lg font-bold text-ink">{item ? "Edit kendaraan" : "Tambah kendaraan"}</h2><button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Tutup modal" className="text-ink-3 transition hover:text-ink">×</button></div><form onSubmit={submit} className="space-y-4 p-5"><label className="block text-sm font-semibold text-ink-2">Nama kendaraan<input className={inputClass} {...register("name")} />{errors.name && <span className="mt-1 block font-normal text-danger">{errors.name.message}</span>}</label><label className="block text-sm font-semibold text-ink-2">Plat nomor<span className="ml-2 text-xs font-normal text-ink-4">Opsional, untuk kendaraan</span><input type="text" placeholder="Contoh: B 1234 XYZ" className={inputClass} {...register("plateNumber")} />{errors.plateNumber && <span className="mt-1 block font-normal text-danger">{errors.plateNumber.message}</span>}</label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-ink-2">Kategori<input className={inputClass} {...register("category")} />{errors.category && <span className="mt-1 block font-normal text-danger">{errors.category.message}</span>}</label><label className="block text-sm font-semibold text-ink-2">Total stok<input type="number" min={0} className={inputClass} {...register("totalStock")} />{errors.totalStock && <span className="mt-1 block font-normal text-danger">{errors.totalStock.message}</span>}</label></div><label className="block text-sm font-semibold text-ink-2">{item?.imageUrl ? "Ganti foto kendaraan" : "Foto kendaraan"}<span className="ml-2 text-xs font-normal text-ink-4">JPEG, PNG, atau WebP maks. 5 MB</span><input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className={inputClass} {...register("image")} />{errors.image && <span className="mt-1 block font-normal text-danger">{errors.image.message}</span>}</label>{mutation.error && <div className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(mutation.error)}</div>}<div className="flex justify-end gap-3 border-t border-line pt-4"><button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="submit" disabled={mutation.isPending} className="rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50">{mutation.isPending ? "Menyimpan..." : "Simpan"}</button></div></form></div></div>;
}
