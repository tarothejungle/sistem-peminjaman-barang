import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Building2, Eye, Pencil, Plus, RefreshCw, SearchX, Trash2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
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
  const [previewRoom, setPreviewRoom] = useState<Room | null>(null);
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
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-line bg-inset-soft text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-5 py-4">Foto</th><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Kapasitas</th><th className="px-5 py-4">Lokasi</th><th className="px-5 py-4">Fasilitas</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead>
              <tbody className="divide-y divide-line">
                {roomsQuery.data.map((room) => (
                  <tr key={room.id} className="hover:bg-hover">
                     <td className="px-5 py-4">{room.imageUrl ? <button type="button" aria-label={`Lihat foto ${room.name}`} onClick={() => setPreviewRoom(room)} className="group relative grid h-12 w-16 cursor-zoom-in place-items-center overflow-hidden rounded-lg bg-raised-strong text-ink-4 outline-none ring-accent transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"><ResourceImage url={room.imageUrl} alt={`Foto ${room.name}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-105 group-focus-visible:scale-105" fallback={<Building2 size={20} />} /><span className="absolute inset-0 grid place-items-center bg-overlay text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><Eye size={20} aria-hidden="true" /></span></button> : <div className="grid h-12 w-16 place-items-center overflow-hidden rounded-lg bg-raised-strong text-ink-4"><Building2 size={20} aria-hidden="true" /></div>}</td><td className="px-5 py-4 font-bold text-ink">{room.name}</td>
                    <td className="px-5 py-4 text-ink-3">{room.capacity} orang</td>
                    <td className="px-5 py-4 text-ink-3">{room.location}</td>
                    <td className="max-w-xs px-5 py-4"><div className="flex flex-wrap gap-1">{room.facilities.length ? room.facilities.map((facility) => <span key={facility} className="rounded border border-line bg-raised px-2 py-1 text-xs text-ink-2">{facility}</span>) : <span className="text-ink-4">—</span>}</div></td>
                    <td className="px-5 py-4"><span className="rounded-full border border-ok-line bg-ok-soft px-2.5 py-1 text-xs font-bold text-ok">Aktif</span></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(room)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-2 transition hover:bg-hover hover:text-ink"><Pencil size={14} /> Edit</button><button type="button" onClick={() => { deactivateRoom.reset(); setConfirmRoom(room); }} className="inline-flex items-center gap-1.5 rounded-lg bg-danger-solid px-3 py-2 text-xs font-bold text-onaccent transition hover:bg-danger-hover"><Trash2 size={14} /> Nonaktifkan</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <RoomFormModal key={editingRoom?.id ?? "create"} room={editingRoom} onClose={() => setShowForm(false)} onSaved={(message) => { setShowForm(false); setFeedback(message); }} />}
      {previewRoom && <RoomImagePreview room={previewRoom} onClose={() => setPreviewRoom(null)} />}
      {confirmRoom && <ConfirmDialog title="Nonaktifkan ruangan?" description={`${confirmRoom.name} akan hilang dari katalog aktif.`} confirmLabel="Nonaktifkan" isPending={deactivateRoom.isPending} error={deactivateRoom.error} onClose={() => setConfirmRoom(null)} onConfirm={handleDeactivate} />}
      {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}

function RoomImagePreview({ room, onClose }: { room: Room; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-overlay px-4 py-6 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="room-image-preview-title" className="w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade">
        <div className="flex items-center border-b border-line px-5 py-4">
          <h2 id="room-image-preview-title" className="flex-1 text-lg font-bold text-ink">Foto {room.name}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup preview foto" className="grid size-10 place-items-center rounded-full text-ink-3 transition hover:bg-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><X size={20} /></button>
        </div>
        <div className="grid max-h-[80vh] min-h-64 place-items-center overflow-auto bg-inset p-4 sm:p-6">
          <ResourceImage url={room.imageUrl} alt={`Foto ${room.name} ukuran penuh`} className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-xl" fallback={<div className="grid min-h-64 place-items-center text-ink-4"><Building2 size={52} /></div>} />
        </div>
      </div>
    </div>,
    document.body,
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

export const inputClass = "mt-2 w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring";

export function AdminHeader({ icon, title, description, onAdd, addLabel }: { icon: React.ReactNode; title: string; description: string; onAdd: () => void; addLabel: string }) { return <section className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-line bg-panel px-6 py-7 text-ink shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:px-8"><div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent-soft blur-[100px]" /><div className="relative flex items-start gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-solid text-onaccent shadow-lg shadow-accent-glow">{icon}</div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Master Data</p><h2 className="mt-1 text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-ink-3">{description}</p></div></div><button type="button" onClick={onAdd} className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-accent-solid px-4 py-2.5 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover"><Plus size={17} /> {addLabel}</button></section>; }
export function TableSkeleton() { return <div className="space-y-2 rounded-2xl border border-line bg-panel p-5">{["one", "two", "three", "four"].map((key) => <div key={key} className="h-14 animate-pulse rounded-xl bg-raised-soft" />)}</div>; }
export function LoadError({ onRetry }: { onRetry: () => void }) { return <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-danger-line bg-panel backdrop-blur-xl"><AlertCircle size={32} className="text-danger" /><p className="mt-3 font-bold text-ink">Data gagal dimuat</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-accent-hover"><RefreshCw size={15} /> Muat ulang</button></div>; }
export function EmptyState({ label }: { label: string }) { return <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-panel-soft"><SearchX size={38} className="text-ink-4" /><p className="mt-4 font-bold text-ink-2">{label}</p></div>; }
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-ink-2">{label}{hint && <span className="ml-2 text-xs font-normal text-ink-4">{hint}</span>}{children}{error && <span className="mt-1 block text-sm font-normal text-danger">{error}</span>}</label>; }
function FormDialog({ title, isPending, error, onClose, onSubmit, children }: { title: string; isPending: boolean; error: Error | null; onClose: () => void; onSubmit: React.FormEventHandler<HTMLFormElement>; children: React.ReactNode }) { return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-overlay px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl"><div className="flex items-center border-b border-line p-5"><h2 className="flex-1 text-lg font-bold text-ink">{title}</h2><button type="button" onClick={onClose} disabled={isPending} aria-label="Tutup modal" className="text-ink-3 transition hover:text-ink"><X size={19} /></button></div><form onSubmit={onSubmit} className="space-y-4 p-5">{children}{error && <div className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{getAdminErrorMessage(error)}</div>}<div className="flex justify-end gap-3 border-t border-line pt-4"><button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="submit" disabled={isPending} className="rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50">{isPending ? "Menyimpan..." : "Simpan"}</button></div></form></div></div>; }
function ConfirmDialog({ title, description, confirmLabel, isPending, error, onClose, onConfirm }: { title: string; description: string; confirmLabel: string; isPending: boolean; error: Error | null; onClose: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-[70] grid place-items-center bg-overlay px-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-line bg-panel-strong p-5 shadow-2xl shadow-shade backdrop-blur-xl"><h2 className="font-bold text-ink">{title}</h2><p className="mt-2 text-sm text-ink-3">{description}</p>{error && <p className="mt-3 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(error)}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="button" onClick={onConfirm} disabled={isPending} className="rounded-lg bg-danger-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-danger-hover">{isPending ? "Memproses..." : confirmLabel}</button></div></div></div>; }
