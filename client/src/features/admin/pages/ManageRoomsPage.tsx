import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Building2, Pencil, Plus, RefreshCw, SearchX, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Room } from "../../../types";
import { ResourceImage } from "../../../components/common/ResourceImage";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { useCreateRoom, useDeactivateRoom, useRooms, useUpdateRoom } from "../../rooms/api/useRooms";
import { getAdminErrorMessage } from "./adminPage.utils";

const roomFormSchema = z.object({
  name: z.string().trim().min(1, "Nama ruangan wajib diisi").max(100),
  capacity: z.coerce.number().int().positive("Kapasitas harus lebih dari 0"),
  location: z.string().trim().min(1, "Lokasi wajib diisi").max(100),
  facilities: z.string().max(500),
  image: z.instanceof(FileList).optional(),
}).superRefine((data, context) => {
  const file = data.image?.[0];
  if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) context.addIssue({ code: "custom", path: ["image"], message: "Foto harus JPEG, PNG, atau WebP" });
  if (file && file.size > 5 * 1024 * 1024) context.addIssue({ code: "custom", path: ["image"], message: "Ukuran foto maksimal 5 MB" });
});

type RoomForm = z.infer<typeof roomFormSchema>;

export function ManageRoomsPage() {
  const roomsQuery = useRooms();
  const deactivateRoom = useDeactivateRoom();
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmRoom, setConfirmRoom] = useState<Room | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const openCreate = () => { setEditingRoom(null); setShowForm(true); };
  const openEdit = (room: Room) => { setEditingRoom(room); setShowForm(true); };

  const handleDeactivate = async () => {
    if (!confirmRoom) return;
    try {
      await deactivateRoom.mutateAsync(confirmRoom.id);
      setFeedback(`${confirmRoom.name} berhasil dinonaktifkan.`);
      setConfirmRoom(null);
    } catch {
      // Mutation feedback renders in confirmation dialog.
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader icon={<Building2 size={23} />} title="Kelola Ruangan" description="Atur ruang rapat, kapasitas, lokasi, dan fasilitas." onAdd={openCreate} addLabel="Tambah ruangan" />
      {roomsQuery.isLoading && <TableSkeleton />}
      {roomsQuery.isError && <LoadError onRetry={() => roomsQuery.refetch()} />}
      {roomsQuery.data?.length === 0 && <EmptyState label="Belum ada ruang rapat aktif" />}
      {roomsQuery.data && roomsQuery.data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Foto</th><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Kapasitas</th><th className="px-5 py-4">Lokasi</th><th className="px-5 py-4">Fasilitas</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {roomsQuery.data.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-50/70">
                     <td className="px-5 py-4"><div className="grid h-12 w-16 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-400"><ResourceImage url={room.imageUrl} alt={`Foto ${room.name}`} className="h-full w-full object-cover" fallback={<Building2 size={20} />} /></div></td><td className="px-5 py-4 font-bold text-slate-900">{room.name}</td>
                    <td className="px-5 py-4 text-slate-600">{room.capacity} orang</td>
                    <td className="px-5 py-4 text-slate-600">{room.location}</td>
                    <td className="max-w-xs px-5 py-4"><div className="flex flex-wrap gap-1">{room.facilities.length ? room.facilities.map((facility) => <span key={facility} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{facility}</span>) : <span className="text-slate-400">—</span>}</div></td>
                    <td className="px-5 py-4"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Aktif</span></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(room)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Edit</button><button type="button" onClick={() => { deactivateRoom.reset(); setConfirmRoom(room); }} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"><Trash2 size={14} /> Nonaktifkan</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <RoomFormModal key={editingRoom?.id ?? "create"} room={editingRoom} onClose={() => setShowForm(false)} onSaved={(message) => { setShowForm(false); setFeedback(message); }} />}
      {confirmRoom && <ConfirmDialog title="Nonaktifkan ruangan?" description={`${confirmRoom.name} akan hilang dari katalog aktif.`} confirmLabel="Nonaktifkan" isPending={deactivateRoom.isPending} error={deactivateRoom.error} onClose={() => setConfirmRoom(null)} onConfirm={handleDeactivate} />}
      {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}

function RoomFormModal({ room, onClose, onSaved }: { room: Room | null; onClose: () => void; onSaved: (message: string) => void }) {
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const mutation = room ? updateRoom : createRoom;
  const { register, handleSubmit, formState: { errors } } = useForm<RoomForm>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: { name: room?.name ?? "", capacity: room?.capacity ?? 1, location: room?.location ?? "", facilities: room?.facilities.join(", ") ?? "" },
  });
  const submit = handleSubmit(async (form) => {
    const facilities = [...new Set(form.facilities.split(",").map((value) => value.trim()).filter(Boolean))];
    try {
      if (room) await updateRoom.mutateAsync({ roomId: room.id, name: form.name, capacity: form.capacity, location: form.location, facilities, image: form.image?.[0] });
      else await createRoom.mutateAsync({ name: form.name, capacity: form.capacity, location: form.location, facilities, image: form.image?.[0] });
      onSaved(room ? "Ruangan berhasil diperbarui." : "Ruangan berhasil ditambahkan.");
    } catch {
      // Mutation error renders in modal.
    }
  });
  return <FormDialog title={room ? "Edit ruang rapat" : "Tambah ruang rapat"} isPending={mutation.isPending} error={mutation.error} onClose={onClose} onSubmit={submit}>
    <Field label="Nama ruangan" error={errors.name?.message}><input className={inputClass} {...register("name")} /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Kapasitas" error={errors.capacity?.message}><input type="number" min={1} className={inputClass} {...register("capacity")} /></Field><Field label="Lokasi" error={errors.location?.message}><input className={inputClass} {...register("location")} /></Field></div>
    <Field label="Fasilitas" hint="Pisahkan dengan koma" error={errors.facilities?.message}><input className={inputClass} placeholder="AC, Proyektor, Whiteboard" {...register("facilities")} /></Field>
    <Field label={room?.imageUrl ? "Ganti foto ruangan" : "Foto ruangan"} hint="JPEG, PNG, atau WebP maks. 5 MB" error={errors.image?.message}><input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className={inputClass} {...register("image")} /></Field>
  </FormDialog>;
}

export const inputClass = "mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export function AdminHeader({ icon, title, description, onAdd, addLabel }: { icon: React.ReactNode; title: string; description: string; onAdd: () => void; addLabel: string }) { return <section className="flex flex-col justify-between gap-5 rounded-2xl bg-slate-900 px-6 py-7 text-white sm:flex-row sm:items-center sm:px-8"><div className="flex items-start gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600">{icon}</div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Master Data</p><h2 className="mt-1 text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-300">{description}</p></div></div><button type="button" onClick={onAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold hover:bg-blue-700"><Plus size={17} /> {addLabel}</button></section>; }
export function TableSkeleton() { return <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">{["one", "two", "three", "four"].map((key) => <div key={key} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>; }
export function LoadError({ onRetry }: { onRetry: () => void }) { return <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white"><AlertCircle size={32} className="text-rose-500" /><p className="mt-3 font-bold">Data gagal dimuat</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"><RefreshCw size={15} /> Muat ulang</button></div>; }
export function EmptyState({ label }: { label: string }) { return <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white"><SearchX size={38} className="text-slate-300" /><p className="mt-4 font-bold text-slate-700">{label}</p></div>; }
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-slate-700">{label}{hint && <span className="ml-2 text-xs font-normal text-slate-400">{hint}</span>}{children}{error && <span className="mt-1 block text-sm font-normal text-rose-600">{error}</span>}</label>; }
function FormDialog({ title, isPending, error, onClose, onSubmit, children }: { title: string; isPending: boolean; error: Error | null; onClose: () => void; onSubmit: React.FormEventHandler<HTMLFormElement>; children: React.ReactNode }) { return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/65 px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-center border-b border-slate-200 p-5"><h2 className="flex-1 text-lg font-bold text-slate-900">{title}</h2><button type="button" onClick={onClose} disabled={isPending} aria-label="Tutup modal"><X size={19} /></button></div><form onSubmit={onSubmit} className="space-y-4 p-5">{children}{error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{getAdminErrorMessage(error)}</div>}<div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Batal</button><button type="submit" disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isPending ? "Menyimpan..." : "Simpan"}</button></div></form></div></div>; }
function ConfirmDialog({ title, description, confirmLabel, isPending, error, onClose, onConfirm }: { title: string; description: string; confirmLabel: string; isPending: boolean; error: Error | null; onClose: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 px-4"><div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-500">{description}</p>{error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{getAdminErrorMessage(error)}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Batal</button><button type="button" onClick={onConfirm} disabled={isPending} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white">{isPending ? "Memproses..." : confirmLabel}</button></div></div></div>; }
