import { zodResolver } from "@hookform/resolvers/zod";
import { Megaphone, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { ATTENTION_PLACEMENTS, useCreateAttentionMessage, useDeleteAttentionMessage, useManagedAttentionMessages, useUpdateAttentionMessage, type AttentionAudience, type AttentionMessage, type AttentionPlacement } from "../../attention/api/useAttentionMessages";
import { Role } from "../../../types";
import { getRoleLabel } from "../../../utils/roleLabel";
import { getAdminErrorMessage } from "./adminPage.utils";
import { AdminHeader, EmptyState, inputClass, LoadError, TableSkeleton } from "./ManageRoomsPage";

const audienceOptions = [Role.PEMOHON, Role.PJ_RUANGAN, Role.KABAG_UMUM, Role.KASUBAG_UMUM, "ALL"] as const;

const schema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(150),
  message: z.string().trim().min(5, "Isi informasi minimal 5 karakter").max(2000),
  audienceRole: z.enum(audienceOptions),
  isActive: z.boolean(),
  placement: z.enum(ATTENTION_PLACEMENTS),
  sortOrder: z.coerce.number().int().min(0, "Urutan minimal 0").max(999),
});
type Form = z.infer<typeof schema>;

function audienceLabel(audience: AttentionAudience): string {
  return audience === "ALL" ? "Semua role" : getRoleLabel(audience);
}

function placementLabel(placement: AttentionPlacement): string {
  return placement === "BEFORE_LOGIN" ? "Sebelum login" : "Setelah login";
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ManageAttentionMessagesPage() {
  const messagesQuery = useManagedAttentionMessages();
  const [editing, setEditing] = useState<AttentionMessage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<AttentionMessage | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  return <div className="space-y-6">
    <AdminHeader
      icon={<Megaphone size={23} />}
      title="Informasi & Perhatian"
      description="Tulis informasi yang muncul sebagai pop up setelah pengguna berhasil login, atau sebagai pengumuman di halaman masuk."
      addLabel="Tambah informasi"
      onAdd={() => { setEditing(null); setShowForm(true); }}
    />

    {messagesQuery.isLoading && <TableSkeleton />}
    {messagesQuery.isError && <LoadError onRetry={() => messagesQuery.refetch()} />}
    {messagesQuery.data?.length === 0 && <EmptyState label="Belum ada informasi yang dibuat" />}

    {messagesQuery.data && messagesQuery.data.length > 0 && <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
      <thead className="border-b border-line bg-inset-soft text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-5 py-4">Judul</th><th className="px-5 py-4">Isi</th><th className="px-5 py-4">Untuk</th><th className="px-5 py-4">Muncul</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Diperbarui</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead>
      <tbody className="divide-y divide-line">
        {messagesQuery.data.map((message) => <tr key={message.id} className="align-top transition hover:bg-hover">
          <td className="px-5 py-4 font-bold text-ink">{message.title}</td>
          <td className="max-w-md px-5 py-4 text-ink-3"><p className="line-clamp-3 whitespace-pre-line">{message.message}</p></td>
          <td className="px-5 py-4 text-ink-3">{audienceLabel(message.audienceRole)}</td>
          <td className="px-5 py-4 text-ink-3">{placementLabel(message.placement)}</td>
          <td className="px-5 py-4">{message.isActive ? <span className="rounded-lg border border-ok-line bg-ok-soft px-2.5 py-1 text-xs font-bold text-ok">Aktif</span> : <span className="rounded-lg border border-line bg-inset px-2.5 py-1 text-xs font-bold text-ink-3">Nonaktif</span>}</td>
          <td className="px-5 py-4 text-ink-3">{formatUpdatedAt(message.updatedAt)}</td>
          <td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditing(message); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-2 transition hover:bg-hover hover:text-ink"><Pencil size={14} /> Edit</button><button type="button" onClick={() => setDeleting(message)} className="inline-flex items-center gap-1.5 rounded-lg border border-danger-line px-3 py-2 text-xs font-bold text-danger transition hover:bg-danger-soft"><Trash2 size={14} /> Hapus</button></div></td>
        </tr>)}
      </tbody>
    </table></div></div>}

    {showForm && <AttentionFormModal key={editing?.id ?? "create"} message={editing} onClose={() => setShowForm(false)} onSaved={(text) => { setShowForm(false); setFeedback(text); }} />}
    {deleting && <DeleteDialog message={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); setFeedback("Informasi berhasil dihapus."); }} />}
    {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
  </div>;
}

function AttentionFormModal({ message, onClose, onSaved }: { message: AttentionMessage | null; onClose: () => void; onSaved: (feedback: string) => void }) {
  const create = useCreateAttentionMessage();
  const update = useUpdateAttentionMessage();
  const mutation = message ? update : create;
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: message?.title ?? "",
      message: message?.message ?? "",
      audienceRole: message?.audienceRole ?? Role.PEMOHON,
      isActive: message?.isActive ?? true,
      placement: message?.placement ?? "AFTER_LOGIN",
      sortOrder: message?.sortOrder ?? 0,
    },
  });

  const submit = handleSubmit(async (form) => {
    try {
      if (message) await update.mutateAsync({ id: message.id, ...form });
      else await create.mutateAsync(form);
      onSaved(message ? "Informasi berhasil diperbarui." : "Informasi berhasil ditambahkan.");
    } catch {
      // Mutation feedback renders in the modal.
    }
  });

  return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-overlay px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl">
    <div className="border-b border-line p-5"><h2 className="text-lg font-bold text-ink">{message ? "Edit informasi" : "Tambah informasi"}</h2><p className="mt-1 text-sm text-ink-3">Tulis dengan bahasa yang natural, seperti menyapa rekan kerja langsung.</p></div>
    <form onSubmit={submit} className="space-y-4 p-5">
      <label className="block text-sm font-semibold text-ink-2">Judul<input type="text" placeholder="Contoh: Skor Kredibilitas Peminjaman Kendaraan" className={inputClass} {...register("title")} />{errors.title && <span className="mt-1 block font-normal text-danger">{errors.title.message}</span>}</label>
      <label className="block text-sm font-semibold text-ink-2">Isi informasi<span className="ml-2 text-xs font-normal text-ink-4">Pisahkan paragraf dengan enter</span><textarea rows={8} className={`${inputClass} resize-y`} {...register("message")} />{errors.message && <span className="mt-1 block font-normal text-danger">{errors.message.message}</span>}</label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink-2">Ditujukan untuk<select className={inputClass} {...register("audienceRole")}>{audienceOptions.map((audience) => <option key={audience} value={audience}>{audienceLabel(audience)}</option>)}</select>{errors.audienceRole && <span className="mt-1 block font-normal text-danger">{errors.audienceRole.message}</span>}</label>
        <label className="block text-sm font-semibold text-ink-2">Waktu tampil<select className={inputClass} {...register("placement")}><option value="AFTER_LOGIN">Setelah berhasil login (pop up)</option><option value="BEFORE_LOGIN">Sebelum login (di halaman masuk)</option></select>{errors.placement && <span className="mt-1 block font-normal text-danger">{errors.placement.message}</span>}</label>
        <label className="block text-sm font-semibold text-ink-2">Urutan tampil<span className="ml-2 text-xs font-normal text-ink-4">Angka kecil tampil lebih dulu</span><input type="number" min={0} max={999} className={inputClass} {...register("sortOrder")} />{errors.sortOrder && <span className="mt-1 block font-normal text-danger">{errors.sortOrder.message}</span>}</label>
      </div>
      {watch("placement") === "BEFORE_LOGIN" && <p className="rounded-xl border border-line bg-inset-soft px-4 py-3 text-xs leading-5 text-ink-3">Informasi ini tampil di halaman masuk, jadi pilihan &ldquo;Ditujukan untuk&rdquo; diabaikan &mdash; belum ada peran yang bisa dibaca sebelum pengguna masuk.</p>}
      <div className="space-y-3 rounded-xl border border-line bg-inset-soft p-4">
        <label className="flex items-center gap-3 text-sm font-semibold text-ink-2"><input type="checkbox" className="size-4" {...register("isActive")} />Aktifkan informasi ini</label>
        <p className="text-xs leading-5 text-ink-3">Isinya muncul sebagai pop up setelah pengguna login, atau sebagai pengumuman di halaman masuk, sesuai pilihan &ldquo;Waktu tampil&rdquo;.</p>
      </div>
      {mutation.error && <div className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(mutation.error)}</div>}
      <div className="flex justify-end gap-3 border-t border-line pt-4"><button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="submit" disabled={mutation.isPending} className="rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50">{mutation.isPending ? "Menyimpan..." : "Simpan"}</button></div>
    </form>
  </div></div>;
}

function DeleteDialog({ message, onClose, onDeleted }: { message: AttentionMessage; onClose: () => void; onDeleted: () => void }) {
  const remove = useDeleteAttentionMessage();
  const confirm = async () => {
    try {
      await remove.mutateAsync(message.id);
      onDeleted();
    } catch {
      // Mutation feedback renders in the dialog.
    }
  };

  return <div className="fixed inset-0 z-[70] grid place-items-center bg-overlay px-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-line bg-panel-strong p-5 shadow-2xl shadow-shade backdrop-blur-xl">
    <h2 className="font-bold text-ink">Hapus informasi ini?</h2>
    <p className="mt-2 text-sm leading-6 text-ink-3">"{message.title}" tidak akan ditampilkan lagi kepada pengguna.</p>
    {remove.error && <p className="mt-3 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(remove.error)}</p>}
    <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={remove.isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="button" onClick={confirm} disabled={remove.isPending} className="rounded-lg bg-danger-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-danger-hover">{remove.isPending ? "Menghapus..." : "Ya, hapus"}</button></div>
  </div></div>;
}