import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CalendarClock, Check, ClipboardCheck, Clock3, DoorOpen, Flag, Pencil, SearchCheck, Trash2, X, XCircle } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { apiErrorMessage } from "../../../lib/apiError";
import { jakartaDateKey, todayInJakarta } from "../../../lib/datetime";
import { BookingStatus, Role, canApproveBookings, type Booking } from "../../../types";
import { useRooms } from "../../rooms/api/useRooms";
import { useRoomBookingSettings } from "../../settings/api/useRoomBookingSettings";
import { useConfirmBookingFinished, useDeletePendingBooking, useRelocateBooking, useUpdateBookingStatus } from "../api/useBookings";
import { getBookingResourceName } from "../bookingDisplay";
import { matchRoomSlot } from "../roomSlots";
import { RoomSlotPicker } from "./RoomSlotPicker";

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

const alternativeSchema = z.object({
  alternativeRoomId: z.string().uuid("Ruang rapat alternatif wajib dipilih"),
  alternativeDate: z.string().min(1, "Tanggal alternatif wajib dipilih"),
  alternativeRoomSlot: z.enum(["MORNING", "AFTERNOON", "FULL_DAY"]),
});

type NotesForm = z.infer<typeof notesSchema>;
type AlternativeForm = z.infer<typeof alternativeSchema>;

export function BookingActions({ booking, role, onSuccess, onEdit, currentTime = Date.now() }: BookingActionsProps) {
  const mutation = useUpdateBookingStatus();
  const relocate = useRelocateBooking();
  const remove = useDeletePendingBooking();
  const confirmFinished = useConfirmBookingFinished();
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  /** The loan window opens at the start time and closes at the (possibly relocated) end time. */
  const loanStarted = new Date(booking.alternativeStartTime ?? booking.startTime).getTime() <= currentTime;
  const loanEnded = bookingHasEnded(booking, currentTime);
  /**
   * A request that still waits for the KASUBAG decision can be relocated as part of
   * that approval, so the offer stays until the schedule itself has passed.
   */
  const canOfferAlternativeWhilePending = isMainMeetingRoom(booking) && !loanEnded;
  const canOfferAlternative = canOfferAlternativeWhilePending;
  const canConfirmFinished = (booking.status === BookingStatus.APPROVED || booking.status === BookingStatus.IN_USE)
    && (booking.resourceType === "ROOM" ? loanEnded : loanStarted);

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

  if (role === Role.PEMOHON && canConfirmFinished) {
    actions = <ActionButton label="Konfirmasi Selesai Menggunakan" icon={Flag} tone="blue" disabled={confirmFinished.isPending} onClick={async () => { try { await confirmFinished.mutateAsync(booking.id); onSuccess?.("Peminjaman dikonfirmasi selesai."); } catch { /* Mutation error renders beside actions. */ } }} />;
  }

  if (role === Role.PJ_RUANGAN && booking.status === BookingStatus.PENDING_PJ_REVIEW) {
    actions = <div className="flex flex-wrap justify-end gap-2"><ActionButton label="Setujui & Mulai Persiapan" icon={DoorOpen} tone="emerald" disabled={mutation.isPending} onClick={() => updateStatus(BookingStatus.PREPARING, "Pengajuan disetujui PJ. Persiapan dimulai.")} /><ActionButton label="Tolak" icon={X} tone="rose" disabled={mutation.isPending} onClick={() => open("REJECT")} /></div>;
  }

  if (canApproveBookings(role) && booking.status === BookingStatus.PENDING_KABAG_APPROVAL) {
    actions = (
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton label="Setujui" icon={Check} tone="emerald" disabled={mutation.isPending} onClick={() => updateStatus(BookingStatus.APPROVED, "Peminjaman berhasil disetujui.")} />
        <ActionButton label="Tolak" icon={X} tone="rose" disabled={mutation.isPending} onClick={() => open("REJECT")} />
        {canOfferAlternativeWhilePending && <ActionButton label="Beri Alternatif Ruangan" icon={CalendarClock} tone="amber" disabled={mutation.isPending} onClick={() => open("ALTERNATIVE")} />}
      </div>
    );
  }

  if ((canApproveBookings(role) || role === Role.PJ_RUANGAN) && booking.status === BookingStatus.APPROVED && canOfferAlternative) {
    actions = <ActionButton label="Beri Alternatif Ruangan" icon={CalendarClock} tone="amber" disabled={relocate.isPending} onClick={() => open("ALTERNATIVE")} />;
  }

  if (role === Role.PJ_RUANGAN && booking.status === BookingStatus.PREPARING) {
    actions = <ActionButton label="Persiapan Selesai, Teruskan ke Kasubag" icon={ClipboardCheck} tone="blue" disabled={mutation.isPending} onClick={() => updateStatus(BookingStatus.PENDING_KABAG_APPROVAL, "Persiapan selesai. Pengajuan diteruskan ke Kasubag Umum.")} />;
  }

  if (role === Role.PJ_RUANGAN && booking.status === BookingStatus.FINISHED_PENDING_INSPECTION) {
    actions = <ActionButton label="Periksa Kondisi Akhir Ruangan" icon={SearchCheck} tone="purple" disabled={mutation.isPending} onClick={() => open("INSPECTION")} />;
  }

  if (!actions) return null;

  return (
    <>
      <div className="space-y-2">
        {actions}
        {(mutation.isError || relocate.isError || remove.isError || confirmFinished.isError) && <p role="alert" className="max-w-xs text-right text-xs text-danger">{getMutationError(mutation.error ?? relocate.error ?? remove.error ?? confirmFinished.error)}</p>}
      </div>
      <NotesModal
        booking={booking}
        mode={openModal}
        isPending={mutation.isPending || relocate.isPending}
        error={mutation.error ?? relocate.error}
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
          await relocate.mutateAsync({
            bookingId: booking.id,
            alternativeRoomId: values.alternativeRoomId,
            alternativeDate: values.alternativeDate,
            alternativeRoomSlot: values.alternativeRoomSlot,
          });
          setOpenModal(null);
          onSuccess?.("Lokasi dan jadwal peminjaman berhasil diperbarui.");
        }}
      />
      {showDeleteConfirm && <DeleteBookingDialog booking={booking} isPending={remove.isPending} error={remove.error} onClose={() => setShowDeleteConfirm(false)} onConfirm={async () => { try { await remove.mutateAsync(booking.id); setShowDeleteConfirm(false); onSuccess?.("Pengajuan berhasil dihapus."); } catch { /* Mutation error renders in dialog. */ } }} />}
    </>
  );
}

function DeleteBookingDialog({ booking, isPending, error, onClose, onConfirm }: { booking: Booking; isPending: boolean; error: Error | null; onClose: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-overlay px-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-booking-title" className="w-full max-w-sm rounded-2xl border border-line bg-panel-strong p-5 text-left shadow-2xl shadow-shade backdrop-blur-xl"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger"><AlertTriangle size={20} /></div><div><h2 id="delete-booking-title" className="font-bold text-ink">Hapus pengajuan?</h2><p className="mt-1 text-sm leading-6 text-ink-3"><span className="font-semibold text-ink-2">{getBookingResourceName(booking)}</span> akan dihapus permanen dari riwayat pengajuan.</p></div></div>{error && <p role="alert" className="mt-4 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getMutationError(error)}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="button" onClick={onConfirm} disabled={isPending} className="rounded-lg bg-danger-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-danger-hover disabled:opacity-50">{isPending ? "Menghapus..." : "Ya, hapus"}</button></div></div></div>;
}

interface ActionButtonProps {
  label: string;
  icon: typeof Check;
  tone: "blue" | "emerald" | "rose" | "amber" | "purple";
  disabled: boolean;
  onClick: () => void;
}

const toneClasses = {
  blue: "bg-accent-solid hover:bg-accent-hover",
  emerald: "bg-ok-solid hover:bg-ok-hover",
  rose: "bg-danger-solid hover:bg-danger-hover",
  amber: "bg-warn-solid hover:bg-warn-hover",
  purple: "bg-alt-solid hover:bg-alt-hover",
} as const;

function ActionButton({ label, icon: Icon, tone, disabled, onClick }: ActionButtonProps) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-onaccent transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses[tone]}`}><Icon size={14} aria-hidden="true" />{label}</button>;
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
    <ModalFrame title={title} subtitle={getBookingResourceName(booking)} isPending={isPending} onClose={onClose} icon={isInspection ? SearchCheck : XCircle} iconClass={isInspection ? "bg-alt-soft text-alt" : "bg-danger-soft text-danger"}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className="block text-sm font-semibold text-ink-2">{fieldLabel}<textarea rows={4} className="mt-2 w-full resize-none rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring" placeholder={isInspection ? "Catat kebersihan, kerusakan, atau kendaraan tertinggal..." : "Jelaskan alasan penolakan..."} {...register("notes")} /></label>
        {errors.notes && <p className="text-sm text-danger">{errors.notes.message}</p>}
        {error && <ModalError error={error} />}
        <ModalFooter isPending={isPending} onClose={onClose} submitLabel={isInspection ? "Selesaikan inspeksi" : "Tolak peminjaman"} pendingLabel="Memproses..." tone={isInspection ? "purple" : "rose"} />
      </form>
    </ModalFrame>
  );
}

function AlternativeModal({ booking, isPending, error, onClose, onAlternative }: NotesModalProps) {
  const rooms = useRooms();
  const settings = useRoomBookingSettings();
  /** A multi-day request keeps its span, and a span longer than a day is full-day only. */
  const lockedSlot = isMultiDay(booking) ? "FULL_DAY" : undefined;
  const { control, register, setValue, handleSubmit, formState: { errors } } = useForm<AlternativeForm>({
    resolver: zodResolver(alternativeSchema),
    defaultValues: { alternativeRoomId: "", alternativeDate: "", alternativeRoomSlot: lockedSlot ?? matchRoomSlot(booking.startTime, booking.endTime, settings.data) },
  });
  const selectedSlot = useWatch({ control, name: "alternativeRoomSlot" });
  const submit = handleSubmit(async (values) => {
    try {
      await onAlternative(values);
    } catch {
      // Mutation error renders inside modal.
    }
  });

  return (
    <ModalFrame title="Beri Alternatif Ruangan" subtitle={getBookingResourceName(booking)} isPending={isPending} onClose={onClose} icon={CalendarClock} iconClass="bg-warn-soft text-warn">
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className="block text-sm font-semibold text-ink-2">Nama Ruang Rapat<select className="mt-2 w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring" disabled={rooms.isLoading || rooms.isError} {...register("alternativeRoomId")}><option value="" className="bg-surface-strong">{rooms.isLoading ? "Memuat ruangan..." : "Pilih ruang rapat"}</option>{rooms.data?.filter((room) => room.id !== booking.roomId).map((room) => <option key={room.id} value={room.id} className="bg-surface-strong">{room.name}</option>)}</select>{errors.alternativeRoomId && <span className="mt-1 block text-xs font-normal text-danger">{errors.alternativeRoomId.message}</span>}{rooms.isError && <span className="mt-1 block text-xs font-normal text-danger">Daftar ruang rapat gagal dimuat.</span>}</label>
        <label className="block text-sm font-semibold text-ink-2">Tanggal<input type="date" min={todayInJakarta()} className="mt-2 w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring" {...register("alternativeDate")} />{errors.alternativeDate && <span className="mt-1 block text-xs font-normal text-danger">{errors.alternativeDate.message}</span>}</label>
        <div className="block text-sm font-semibold text-ink-2">
          <span className="flex items-center gap-2"><Clock3 size={16} aria-hidden="true" />Kategori jam</span>
          <RoomSlotPicker settings={settings.data} value={selectedSlot} lockedTo={lockedSlot} onSelect={(slot) => setValue("alternativeRoomSlot", slot, { shouldDirty: true, shouldValidate: true })} />
          <input type="hidden" {...register("alternativeRoomSlot")} />
          {errors.alternativeRoomSlot && <span className="mt-1 block text-xs font-normal text-danger">{errors.alternativeRoomSlot.message}</span>}
        </div>
        <p className="rounded-xl border border-line bg-inset-soft p-3 text-xs leading-5 text-ink-3">{lockedSlot ? "Peminjaman lintas hari memakai kategori sehari penuh dan mempertahankan jumlah hari pengajuan awal." : "Kategori jam mengikuti sesi yang terdaftar pada Pengaturan Jam Ruangan."}</p>
        {error && <ModalError error={error} />}
        <ModalFooter isPending={isPending || rooms.isLoading || rooms.isError || settings.isLoading} onClose={onClose} submitLabel="Kirim alternatif" pendingLabel="Mengirim..." tone="amber" />
      </form>
    </ModalFrame>
  );
}

function ModalFrame({ title, subtitle, isPending, onClose, icon: Icon, iconClass, children }: { title: string; subtitle: string; isPending: boolean; onClose: () => void; icon: typeof Check; iconClass: string; children: React.ReactNode }) {
  return createPortal(<div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-overlay px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="booking-action-title" className="w-full max-w-lg rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl"><div className="flex items-start gap-3 border-b border-line p-5"><div className={`grid h-10 w-10 place-items-center rounded-xl ${iconClass}`}><Icon size={20} /></div><div className="flex-1"><h2 id="booking-action-title" className="font-bold text-ink">{title}</h2><p className="mt-1 text-sm text-ink-3">{subtitle}</p></div><button type="button" onClick={onClose} disabled={isPending} aria-label="Tutup modal"><X size={19} className="text-ink-3 transition hover:text-ink" /></button></div>{children}</div></div>, document.body);
}

function ModalFooter({ isPending, onClose, submitLabel, pendingLabel, tone }: { isPending: boolean; onClose: () => void; submitLabel: string; pendingLabel: string; tone: "rose" | "purple" | "amber" }) {
  return <div className="flex justify-end gap-3 border-t border-line pt-4"><button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="submit" disabled={isPending} className={`rounded-lg px-4 py-2 text-sm font-bold text-onaccent disabled:opacity-50 ${toneClasses[tone]}`}>{isPending ? pendingLabel : submitLabel}</button></div>;
}

function ModalError({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{getMutationError(error)}</div>;
}

function getMutationError(error: unknown): string {
  return apiErrorMessage(error) ?? "Perubahan status gagal diproses.";
}

function isMainMeetingRoom(booking: Booking): boolean {
  return booking.room?.name.trim().toLocaleLowerCase("id-ID") === "ruang rapat utama";
}

function bookingHasEnded(booking: Booking, currentTime: number): boolean {
  return new Date(booking.alternativeEndTime ?? booking.endTime).getTime() <= currentTime;
}

/**
 * A relocated booking keeps the day span of the original request, so the lock
 * mirrors the server: a span longer than one day is full-day only.
 */
function isMultiDay(booking: Booking): boolean {
  return jakartaDateKey(booking.startTime) !== jakartaDateKey(booking.endTime);
}
