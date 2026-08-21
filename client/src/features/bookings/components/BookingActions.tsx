import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { AlertTriangle, CalendarClock, Check, ClipboardCheck, DoorOpen, Flag, Pencil, SearchCheck, Trash2, X, XCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BookingStatus, Role, type Booking } from "../../../types";
import { useConfirmBookingFinished, useDeletePendingBooking, useUpdateBookingStatus } from "../api/useBookings";
import { getBookingResourceName } from "../bookingDisplay";

interface BookingActionsProps {
  booking: Booking;
  role: Role;
  onSuccess?: (message: string) => void;
  onEdit?: (booking: Booking) => void;
  currentTime?: number;
}

type OpenModal = "REJECT" | "ALTERNATIVE" | "INSPECTION" | null;

const notesSchema = z.object({
  notes: z.string().trim().min(3, "Catatan minimal 3 karakter").max(1000),
});

const alternativeSchema = notesSchema.extend({
  alternativeStartTime: z.string().min(1, "Waktu mulai wajib diisi"),
  alternativeEndTime: z.string().min(1, "Waktu selesai wajib diisi"),
}).refine(({ alternativeStartTime, alternativeEndTime }) => new Date(alternativeStartTime) < new Date(alternativeEndTime), {
  message: "Waktu selesai harus setelah waktu mulai",
  path: ["alternativeEndTime"],
});

type NotesForm = z.infer<typeof notesSchema>;
type AlternativeForm = z.infer<typeof alternativeSchema>;

export function BookingActions({ booking, role, onSuccess, onEdit, currentTime = Date.now() }: BookingActionsProps) {
  const mutation = useUpdateBookingStatus();
  const remove = useDeletePendingBooking();
  const confirmFinished = useConfirmBookingFinished();
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateStatus = async (status: BookingStatus, message: string) => {
    try {
      await mutation.mutateAsync({ bookingId: booking.id, status });
      onSuccess?.(message);
    } catch {
      // Mutation error renders beside actions.
    }
  };

  const open = (modal: Exclude<OpenModal, null>) => {
    mutation.reset();
    setOpenModal(modal);
  };

  let actions: React.ReactNode = null;

  if (role === Role.PEMOHON && booking.status === BookingStatus.PENDING_PJ_REVIEW) {
    actions = <div className="flex flex-wrap justify-end gap-2"><ActionButton label="Edit" icon={Pencil} tone="blue" disabled={remove.isPending} onClick={() => onEdit?.(booking)} /><ActionButton label="Hapus" icon={Trash2} tone="rose" disabled={remove.isPending} onClick={() => { remove.reset(); setShowDeleteConfirm(true); }} /></div>;
  }

  if (role === Role.PEMOHON && booking.status === BookingStatus.APPROVED && new Date(booking.endTime).getTime() <= currentTime) {
    actions = <ActionButton label="Konfirmasi Selesai Menggunakan" icon={Flag} tone="blue" disabled={confirmFinished.isPending} onClick={async () => { try { await confirmFinished.mutateAsync(booking.id); onSuccess?.("Peminjaman dikonfirmasi selesai."); } catch { /* Mutation error renders beside actions. */ } }} />;
  }

  if (role === Role.PJ_RUANGAN && booking.status === BookingStatus.PENDING_PJ_REVIEW) {
    actions = <div className="flex flex-wrap justify-end gap-2"><ActionButton label="Setujui & Mulai Persiapan" icon={DoorOpen} tone="emerald" disabled={mutation.isPending} onClick={() => updateStatus(BookingStatus.PREPARING, "Pengajuan disetujui PJ. Persiapan dimulai.")} /><ActionButton label="Tolak" icon={X} tone="rose" disabled={mutation.isPending} onClick={() => open("REJECT")} /></div>;
  }

  if (role === Role.KABAG_UMUM && booking.status === BookingStatus.PENDING_KABAG_APPROVAL) {
    actions = (
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton label="Setujui" icon={Check} tone="emerald" disabled={mutation.isPending} onClick={() => updateStatus(BookingStatus.APPROVED, "Peminjaman berhasil disetujui.")} />
        <ActionButton label="Tolak" icon={X} tone="rose" disabled={mutation.isPending} onClick={() => open("REJECT")} />
        <ActionButton label="Beri Alternatif" icon={CalendarClock} tone="amber" disabled={mutation.isPending} onClick={() => open("ALTERNATIVE")} />
      </div>
    );
  }

  if (role === Role.PJ_RUANGAN && booking.status === BookingStatus.PREPARING) {
    actions = <ActionButton label="Persiapan Selesai, Teruskan ke Kabag" icon={ClipboardCheck} tone="blue" disabled={mutation.isPending} onClick={() => updateStatus(BookingStatus.PENDING_KABAG_APPROVAL, "Persiapan selesai. Pengajuan diteruskan ke Kabag Umum.")} />;
  }

  if (role === Role.PJ_RUANGAN && booking.status === BookingStatus.FINISHED_PENDING_INSPECTION) {
    actions = <ActionButton label="Periksa Kondisi Akhir Ruangan" icon={SearchCheck} tone="purple" disabled={mutation.isPending} onClick={() => open("INSPECTION")} />;
  }

  if (!actions) return null;

  return (
    <>
      <div className="space-y-2">
        {actions}
        {(mutation.isError || remove.isError || confirmFinished.isError) && <p role="alert" className="max-w-xs text-right text-xs text-rose-600">{getMutationError(mutation.error ?? remove.error ?? confirmFinished.error)}</p>}
      </div>
      <NotesModal
        booking={booking}
        mode={openModal}
        isPending={mutation.isPending}
        error={mutation.error}
        onClose={() => setOpenModal(null)}
        onReject={async (notes) => {
          await mutation.mutateAsync({ bookingId: booking.id, status: BookingStatus.REJECTED, rejectionReason: notes, actorRole: role });
          setOpenModal(null);
          onSuccess?.("Peminjaman berhasil ditolak.");
        }}
        onInspect={async (notes) => {
          await mutation.mutateAsync({ bookingId: booking.id, status: BookingStatus.COMPLETED, inspectionNotes: notes });
          setOpenModal(null);
          onSuccess?.("Inspeksi selesai dan peminjaman ditutup.");
        }}
        onAlternative={async (values) => {
          await mutation.mutateAsync({
            bookingId: booking.id,
            status: BookingStatus.ALTERNATIVE_OFFERED,
            alternativeStartTime: new Date(values.alternativeStartTime).toISOString(),
            alternativeEndTime: new Date(values.alternativeEndTime).toISOString(),
            approvalNotes: values.notes,
          });
          setOpenModal(null);
          onSuccess?.("Alternatif jadwal berhasil dikirim.");
        }}
      />
      {showDeleteConfirm && <DeleteBookingDialog booking={booking} isPending={remove.isPending} error={remove.error} onClose={() => setShowDeleteConfirm(false)} onConfirm={async () => { try { await remove.mutateAsync(booking.id); setShowDeleteConfirm(false); onSuccess?.("Pengajuan berhasil dihapus."); } catch { /* Mutation error renders in dialog. */ } }} />}
    </>
  );
}

function DeleteBookingDialog({ booking, isPending, error, onClose, onConfirm }: { booking: Booking; isPending: boolean; error: Error | null; onClose: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 px-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-booking-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700"><AlertTriangle size={20} /></div><div><h2 id="delete-booking-title" className="font-bold text-slate-900">Hapus pengajuan?</h2><p className="mt-1 text-sm leading-6 text-slate-500"><span className="font-semibold text-slate-700">{getBookingResourceName(booking)}</span> akan dihapus permanen dari riwayat pengajuan.</p></div></div>{error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{getMutationError(error)}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Batal</button><button type="button" onClick={onConfirm} disabled={isPending} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">{isPending ? "Menghapus..." : "Ya, hapus"}</button></div></div></div>;
}

interface ActionButtonProps {
  label: string;
  icon: typeof Check;
  tone: "blue" | "emerald" | "rose" | "amber" | "purple";
  disabled: boolean;
  onClick: () => void;
}

const toneClasses = {
  blue: "bg-blue-600 hover:bg-blue-700",
  emerald: "bg-emerald-600 hover:bg-emerald-700",
  rose: "bg-rose-600 hover:bg-rose-700",
  amber: "bg-amber-500 hover:bg-amber-600",
  purple: "bg-purple-600 hover:bg-purple-700",
} as const;

function ActionButton({ label, icon: Icon, tone, disabled, onClick }: ActionButtonProps) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses[tone]}`}><Icon size={14} aria-hidden="true" />{label}</button>;
}

interface NotesModalProps {
  booking: Booking;
  mode: OpenModal;
  isPending: boolean;
  error: Error | null;
  onClose: () => void;
  onReject: (notes: string) => Promise<void>;
  onInspect: (notes: string) => Promise<void>;
  onAlternative: (values: AlternativeForm) => Promise<void>;
}

function NotesModal(props: NotesModalProps) {
  if (!props.mode) return null;
  return props.mode === "ALTERNATIVE" ? <AlternativeModal {...props} /> : <TextNotesModal {...props} mode={props.mode} />;
}

function TextNotesModal({ booking, mode, isPending, error, onClose, onReject, onInspect }: NotesModalProps & { mode: "REJECT" | "INSPECTION" }) {
  const { register, handleSubmit, formState: { errors } } = useForm<NotesForm>({ resolver: zodResolver(notesSchema), defaultValues: { notes: "" } });
  const isInspection = mode === "INSPECTION";
  const title = isInspection ? "Pemeriksaan kondisi akhir" : "Tolak peminjaman";
  const fieldLabel = isInspection ? "Catatan kondisi ruangan" : "Alasan penolakan";

  const submit = handleSubmit(async ({ notes }) => {
    try {
      await (isInspection ? onInspect(notes) : onReject(notes));
    } catch {
      // Mutation error renders inside modal.
    }
  });

  return (
    <ModalFrame title={title} subtitle={getBookingResourceName(booking)} isPending={isPending} onClose={onClose} icon={isInspection ? SearchCheck : XCircle} iconClass={isInspection ? "bg-purple-100 text-purple-700" : "bg-rose-100 text-rose-700"}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className="block text-sm font-semibold text-slate-700">{fieldLabel}<textarea rows={4} className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder={isInspection ? "Catat kebersihan, kerusakan, atau barang tertinggal..." : "Jelaskan alasan penolakan..."} {...register("notes")} /></label>
        {errors.notes && <p className="text-sm text-rose-600">{errors.notes.message}</p>}
        {error && <ModalError error={error} />}
        <ModalFooter isPending={isPending} onClose={onClose} submitLabel={isInspection ? "Selesaikan inspeksi" : "Tolak peminjaman"} pendingLabel="Memproses..." tone={isInspection ? "purple" : "rose"} />
      </form>
    </ModalFrame>
  );
}

function AlternativeModal({ booking, isPending, error, onClose, onAlternative }: NotesModalProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<AlternativeForm>({ resolver: zodResolver(alternativeSchema), defaultValues: { alternativeStartTime: "", alternativeEndTime: "", notes: "" } });
  const submit = handleSubmit(async (values) => {
    try {
      await onAlternative(values);
    } catch {
      // Mutation error renders inside modal.
    }
  });

  return (
    <ModalFrame title="Tawarkan jadwal alternatif" subtitle={getBookingResourceName(booking)} isPending={isPending} onClose={onClose} icon={CalendarClock} iconClass="bg-amber-100 text-amber-700">
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Mulai<input type="datetime-local" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" {...register("alternativeStartTime")} />{errors.alternativeStartTime && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.alternativeStartTime.message}</span>}</label>
          <label className="block text-sm font-semibold text-slate-700">Selesai<input type="datetime-local" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" {...register("alternativeEndTime")} />{errors.alternativeEndTime && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.alternativeEndTime.message}</span>}</label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Catatan<textarea rows={3} className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Jelaskan alasan atau detail alternatif..." {...register("notes")} /></label>
        {errors.notes && <p className="text-sm text-rose-600">{errors.notes.message}</p>}
        {error && <ModalError error={error} />}
        <ModalFooter isPending={isPending} onClose={onClose} submitLabel="Kirim alternatif" pendingLabel="Mengirim..." tone="amber" />
      </form>
    </ModalFrame>
  );
}

function ModalFrame({ title, subtitle, isPending, onClose, icon: Icon, iconClass, children }: { title: string; subtitle: string; isPending: boolean; onClose: () => void; icon: typeof Check; iconClass: string; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/65 px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="booking-action-title" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-start gap-3 border-b border-slate-200 p-5"><div className={`grid h-10 w-10 place-items-center rounded-xl ${iconClass}`}><Icon size={20} /></div><div className="flex-1"><h2 id="booking-action-title" className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} disabled={isPending} aria-label="Tutup modal"><X size={19} className="text-slate-400" /></button></div>{children}</div></div>;
}

function ModalFooter({ isPending, onClose, submitLabel, pendingLabel, tone }: { isPending: boolean; onClose: () => void; submitLabel: string; pendingLabel: string; tone: "rose" | "purple" | "amber" }) {
  return <div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Batal</button><button type="submit" disabled={isPending} className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${toneClasses[tone]}`}>{isPending ? pendingLabel : submitLabel}</button></div>;
}

function ModalError({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{getMutationError(error)}</div>;
}

function getMutationError(error: unknown): string {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) return error.response?.data.error?.message ?? "Perubahan status gagal diproses.";
  return "Perubahan status gagal diproses.";
}
