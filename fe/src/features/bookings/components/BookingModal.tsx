import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Boxes, Building2, CalendarDays, CheckCircle2, Clock3, FileText, LoaderCircle, Phone, UserRound, X } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { apiErrorMessage } from "../../../lib/apiError";
import { tomorrowInJakarta } from "../../../lib/datetime";
import { PHONE_PATTERN } from "../../../lib/validation";
import type { Booking, Item, Room } from "../../../types";
import { useAuthStore } from "../../../store/authStore";
import { useRoomBookingSettings } from "../../settings/api/useRoomBookingSettings";
import { type BookingAvailabilityInput, type CreateBookingInput, useBookingAvailability, useCreateBooking, useUpdatePendingBooking } from "../api/useBookings";
import { matchRoomSlot } from "../roomSlots";
import { RoomSlotPicker } from "./RoomSlotPicker";

export type BookingResource = { type: "ROOM"; room: Room } | { type: "ITEM"; item: Item };

interface Props { resource: BookingResource | null; booking?: Booking | null; onClose: () => void; onSuccess: () => void; }

const schema = z.object({
  resourceType: z.enum(["ROOM", "ITEM"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  roomSlot: z.enum(["MORNING", "AFTERNOON", "FULL_DAY"]),
  document: z.instanceof(FileList).optional(),
  suratTugas: z.instanceof(FileList).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  responsibleName: z.string().trim().min(3, "Nama penanggungjawab minimal 3 karakter").max(100),
  phoneNumber: z.string().trim().regex(PHONE_PATTERN, "No. telepon tidak valid").max(20),
  workUnit: z.string().trim().max(150).optional(),
  purpose: z.string().trim().min(3, "Keperluan minimal 3 karakter").max(1000),
}).superRefine((data, context) => {
  if (!data.startDate) context.addIssue({ code: "custom", path: ["startDate"], message: "Tanggal mulai wajib dipilih" });
  if (!data.endDate) context.addIssue({ code: "custom", path: ["endDate"], message: "Tanggal selesai wajib dipilih" });
  if (data.startDate && data.endDate && data.startDate > data.endDate) context.addIssue({ code: "custom", path: ["endDate"], message: "Tanggal selesai tidak boleh lebih awal" });
  if (data.resourceType === "ITEM" && data.quantity === undefined) context.addIssue({ code: "custom", path: ["quantity"], message: "Jumlah unit wajib diisi" });
  if (data.resourceType === "ROOM" && (!data.workUnit || data.workUnit.length < 2)) context.addIssue({ code: "custom", path: ["workUnit"], message: "Unit kerja wajib diisi" });
  if (data.resourceType === "ROOM" && data.startDate && data.endDate && data.endDate > data.startDate) {
    if (data.roomSlot !== "FULL_DAY") context.addIssue({ code: "custom", path: ["roomSlot"], message: "Peminjaman lintas hari wajib memakai kategori sehari penuh" });
  }
  const file = data.document?.[0];
  if (file && file.type !== "application/pdf") context.addIssue({ code: "custom", path: ["document"], message: "File harus berformat PDF" });
  if (file && file.size > 10 * 1024 * 1024) context.addIssue({ code: "custom", path: ["document"], message: "Ukuran PDF maksimal 10 MB" });
  const suratTugas = data.suratTugas?.[0];
  if (suratTugas && suratTugas.type !== "application/pdf") context.addIssue({ code: "custom", path: ["suratTugas"], message: "Surat Tugas harus berformat PDF" });
  if (suratTugas && suratTugas.size > 10 * 1024 * 1024) context.addIssue({ code: "custom", path: ["suratTugas"], message: "Ukuran PDF maksimal 10 MB" });
});

type Form = z.infer<typeof schema>;

function localDateTime(date: string, time: string): Date { return new Date(`${date}T${time}:00`); }
function jakartaPart(value: string, part: "date" | "time"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return part === "date" ? `${get("year")}-${get("month")}-${get("day")}` : `${get("hour")}:${get("minute")}`;
}

export function BookingModal({ resource, booking = null, onClose, onSuccess }: Props) {
  const create = useCreateBooking();
  const user = useAuthStore((state) => state.user);
  const update = useUpdatePendingBooking();
  const settings = useRoomBookingSettings();
  const [earliestDate] = useState(tomorrowInJakarta);
  const { control, register, reset, setError, setValue, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { resourceType: "ROOM", startDate: earliestDate, endDate: earliestDate, roomSlot: "MORNING", quantity: 1, responsibleName: "", phoneNumber: "", workUnit: "", purpose: "" },
  });
  const watched = useWatch({ control });
  const resourceId = resource?.type === "ROOM" ? resource.room.id : resource?.item.id;
  const multiDay = resource?.type === "ROOM" && Boolean(watched.startDate && watched.endDate && watched.endDate > watched.startDate);

  useEffect(() => {
    if (multiDay && watched.roomSlot !== "FULL_DAY") setValue("roomSlot", "FULL_DAY", { shouldValidate: true });
  }, [multiDay, setValue, watched.roomSlot]);

  const availabilityInput = useMemo<BookingAvailabilityInput | null>(() => {
    if (!resource || !watched.startDate || !watched.endDate || watched.startDate > watched.endDate) return null;
    if (resource.type === "ROOM") {
      if (!watched.roomSlot || multiDay && watched.roomSlot !== "FULL_DAY") return null;
      return { resourceType: "ROOM", roomId: resource.room.id, startDate: watched.startDate, endDate: watched.endDate, roomSlot: watched.roomSlot, bookingId: booking?.id };
    }
    if (!watched.quantity || watched.quantity < 1) return null;
    const now = new Date(); const start = localDateTime(watched.startDate, "00:00"); const end = localDateTime(watched.endDate, "23:59");
    if (end <= now) return null;
    return { resourceType: "ITEM", itemId: resource.item.id, quantity: watched.quantity, startTime: (start < now ? now : start).toISOString(), endTime: end.toISOString(), bookingId: booking?.id };
  }, [booking?.id, multiDay, resource, watched.endDate, watched.quantity, watched.roomSlot, watched.startDate]);
  const availability = useBookingAvailability(availabilityInput);

  const initializeForm = useEffectEvent(() => {
    if (!resource) return;
    reset(booking ? {
      resourceType: resource.type,
      startDate: jakartaPart(booking.startTime, "date"),
      endDate: jakartaPart(booking.endTime, "date"),
      roomSlot: matchRoomSlot(booking.startTime, booking.endTime, settings.data),
      quantity: booking.bookingItems?.[0]?.quantity ?? 1,
      responsibleName: booking.responsibleName,
      phoneNumber: booking.phoneNumber,
      workUnit: booking.workUnit ?? "",
      purpose: booking.purpose,
    } : { resourceType: resource.type, startDate: earliestDate, endDate: earliestDate, roomSlot: "MORNING", quantity: 1, responsibleName: user?.fullName ?? "", phoneNumber: user?.phoneNumber ?? "", workUnit: "", purpose: "" });
  });

  useEffect(() => {
    initializeForm();
  }, [booking?.id, resourceId, resource?.type]);

  useEffect(() => {
    if (!resource) return;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => event.key === "Escape" && !create.isPending && !update.isPending && onClose();
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", escape); };
  }, [create.isPending, onClose, resource, update.isPending]);

  if (!resource) return null;
  const isRoom = resource.type === "ROOM";
  const isVehicle = resource.type === "ITEM" && Boolean(resource.item.plateNumber);
  const mutation = booking ? update : create;
  const serverMessage = apiErrorMessage(mutation.error);
  const submit = handleSubmit(async (form) => {
    if (!availabilityInput) return;
    const latest = await availability.refetch();
    if (!latest.data?.available) return;
    try {
      let input: CreateBookingInput;
      if (resource.type === "ROOM") {
        if (multiDay && !form.document?.[0] && !booking?.documentOriginalName) {
          setError("document", { message: "Surat resmi PDF wajib dilampirkan untuk peminjaman lebih dari satu hari" });
          return;
        }
        input = { resourceType: "ROOM", roomId: resource.room.id, startDate: form.startDate ?? "", endDate: form.endDate ?? "", roomSlot: form.roomSlot, document: form.document?.[0], responsibleName: form.responsibleName, phoneNumber: form.phoneNumber, workUnit: form.workUnit ?? "", purpose: form.purpose };
      } else {
        if ((form.quantity ?? 0) > resource.item.totalStock) { setError("quantity", { message: `Maksimal ${resource.item.totalStock} unit` }); return; }
        const suratTugas = form.suratTugas?.[0];
        if (isVehicle && !suratTugas && !booking?.suratTugasOriginalName) {
          setError("suratTugas", { message: "Surat Tugas PDF wajib dilampirkan untuk peminjaman kendaraan" });
          return;
        }
        const now = new Date(); const start = localDateTime(form.startDate ?? "", "00:00"); const end = localDateTime(form.endDate ?? "", "23:59");
        input = { resourceType: "ITEM", items: [{ itemId: resource.item.id, quantity: form.quantity ?? 1 }], startTime: (start < now ? now : start).toISOString(), endTime: end.toISOString(), responsibleName: form.responsibleName, phoneNumber: form.phoneNumber, purpose: form.purpose, suratTugas };
      }
      if (booking) await update.mutateAsync({ bookingId: booking.id, input });
      else await create.mutateAsync(input);
      onSuccess(); onClose();
    } catch { /* Mutation state renders feedback. */ }
  });

  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-overlay px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl">
    <div className="flex items-start gap-4 border-b border-line bg-inset-soft p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-solid text-onaccent shadow-lg shadow-accent-glow">{isRoom ? <Building2 size={21} /> : <Boxes size={21} />}</div><div className="flex-1"><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{booking ? "Edit pengajuan" : "Pengajuan peminjaman"}</p><h2 className="mt-1 text-xl font-bold text-ink">{isRoom ? resource.room.name : resource.item.name}</h2></div><button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Tutup modal" className="text-ink-3 transition hover:text-ink"><X size={20} /></button></div>
    <form onSubmit={submit} className="space-y-5 p-5" noValidate>
      <input type="hidden" {...register("resourceType")} />
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Nama Penanggungjawab" error={errors.responsibleName?.message} icon={<UserRound size={16} />}><input type="text" autoComplete="name" className={inputClass} {...register("responsibleName")} /></Field><Field label="No. Telepon" error={errors.phoneNumber?.message} icon={<Phone size={16} />}><input type="tel" autoComplete="tel" inputMode="tel" placeholder="Contoh: 081234567890" className={inputClass} {...register("phoneNumber")} /></Field></div>
      {isRoom && <Field label="Unit Kerja" error={errors.workUnit?.message} icon={<Building2 size={16} />}><input type="text" placeholder="Contoh: Bagian Umum" className={inputClass} {...register("workUnit")} /></Field>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label={isRoom ? "Tanggal mulai" : "Tanggal pinjam"} error={errors.startDate?.message} icon={<CalendarDays size={16} />}><input type="date" min={earliestDate} className={inputClass} {...register("startDate")} /></Field><Field label={isRoom ? "Tanggal selesai" : "Tanggal kembali"} error={errors.endDate?.message} icon={<CalendarDays size={16} />}><input type="date" min={watched.startDate || earliestDate} className={inputClass} {...register("endDate")} /></Field></div>
      {isRoom && resource.room.name.trim().toLocaleLowerCase("id-ID") === "ruang rapat utama" && <div className="rounded-xl border border-warn-line bg-warn-soft p-4 text-sm leading-6 text-warn"><p className="font-bold text-warn">Catatan khusus Ruang Rapat Utama</p><p className="mt-1">Notes : diinformasikan kepada peminjam bahwa jadwal peminjaman bersifat menyesuaikan. Peminjam harus menyetujui opsi alokasi ruangan alternatif apabila terjadi penggunaan mendadak/bersamaan oleh Direktur Jenderal.</p></div>}
      {isRoom ? <>
        <Field label="Kategori jam" error={errors.roomSlot?.message} icon={<Clock3 size={16} />}><RoomSlotPicker settings={settings.data} value={watched.roomSlot} lockedTo={multiDay ? "FULL_DAY" : undefined} onSelect={(slot) => setValue("roomSlot", slot, { shouldDirty: true, shouldValidate: true })} /><input type="hidden" {...register("roomSlot")} /></Field>
        {multiDay && <div className="rounded-xl border border-warn-line bg-warn-soft p-4 text-sm text-warn"><p className="font-bold">Peminjaman lintas hari memakai kategori sehari penuh.</p><p className="mt-1 text-warn">Surat resmi unit kerja wajib menjadi bukti dan bahan pertimbangan persetujuan.</p></div>}
        {multiDay && <Field label={booking?.documentOriginalName ? "Ganti surat resmi (opsional, PDF maksimal 10 MB)" : "Surat resmi (PDF, maksimal 10 MB)"} error={errors.document?.message} icon={<FileText size={16} />}><input type="file" accept="application/pdf,.pdf" className={inputClass} {...register("document")} />{booking?.documentOriginalName && <span className="mt-1 block text-xs font-normal text-ink-3">File saat ini: {booking.documentOriginalName}</span>}</Field>}
      </> : <Field label={`Jumlah unit (maks. ${resource.item.totalStock})`} error={errors.quantity?.message}><input type="number" min={1} max={resource.item.totalStock} className={inputClass} {...register("quantity")} /></Field>}
      {!isRoom && <Field label={isVehicle ? "Surat Tugas (PDF, wajib)" : "Surat Tugas (PDF, opsional)"} error={errors.suratTugas?.message} icon={<FileText size={16} />}><input type="file" accept="application/pdf,.pdf" className={inputClass} {...register("suratTugas")} />{isVehicle && !booking?.suratTugasOriginalName && <span className="mt-1 block text-xs font-normal text-ink-3">Peminjaman kendaraan wajib melampirkan Surat Tugas.</span>}{booking?.suratTugasOriginalName && <span className="mt-1 block text-xs font-normal text-ink-3">File saat ini: {booking.suratTugasOriginalName}</span>}</Field>}
      <Field label="Keperluan" error={errors.purpose?.message}><textarea rows={4} className={`${inputClass} resize-none`} {...register("purpose")} /></Field>
      {availabilityInput && <div className={`flex gap-3 rounded-xl border p-4 text-sm ${availability.isFetching ? "border-line bg-inset-soft text-ink-2" : availability.data?.available ? "border-ok-line bg-ok-soft text-ok" : "border-danger-line bg-danger-soft text-danger"}`}>{availability.isFetching ? <LoaderCircle size={18} className="animate-spin" /> : availability.data?.available ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<p className="font-bold">{availability.isFetching ? "Memeriksa ketersediaan..." : availability.data?.message}</p></div>}
      {mutation.isError && <div className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{serverMessage ?? "Pengajuan gagal disimpan."}</div>}
      <div className="flex justify-end gap-3 border-t border-line pt-4"><button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="submit" disabled={mutation.isPending || settings.isLoading && isRoom || availability.data?.available !== true} className="rounded-xl bg-accent-solid px-5 py-2.5 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50">{mutation.isPending ? "Menyimpan..." : booking ? "Simpan perubahan" : "Kirim pengajuan"}</button></div>
    </form>
  </div></div>;
}

const inputClass = "mt-2 w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring";
function Field({ label, error, icon, children }: { label: string; error?: string; icon?: React.ReactNode; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-ink-2"><span className="flex items-center gap-2">{icon}{label}</span>{children}{error && <span className="mt-1 block font-normal text-danger">{error}</span>}</label>; }
