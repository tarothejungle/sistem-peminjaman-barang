import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { AlertCircle, Boxes, Building2, CalendarDays, CheckCircle2, Clock3, FileText, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { Booking, Item, Room } from "../../../types";
import { useRoomBookingSettings } from "../../settings/api/useRoomBookingSettings";
import { type BookingAvailabilityInput, type CreateBookingInput, type RoomBookingSlot, useBookingAvailability, useCreateBooking, useUpdatePendingBooking } from "../api/useBookings";

export type BookingResource = { type: "ROOM"; room: Room } | { type: "ITEM"; item: Item };

interface Props { resource: BookingResource | null; booking?: Booking | null; onClose: () => void; onSuccess: () => void; }

const schema = z.object({
  resourceType: z.enum(["ROOM", "ITEM"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  roomSlot: z.enum(["MORNING", "AFTERNOON", "FULL_DAY"]),
  document: z.instanceof(FileList).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  purpose: z.string().trim().min(3, "Keperluan minimal 3 karakter").max(1000),
}).superRefine((data, context) => {
  if (!data.startDate) context.addIssue({ code: "custom", path: ["startDate"], message: "Tanggal mulai wajib dipilih" });
  if (!data.endDate) context.addIssue({ code: "custom", path: ["endDate"], message: "Tanggal selesai wajib dipilih" });
  if (data.startDate && data.endDate && data.startDate > data.endDate) context.addIssue({ code: "custom", path: ["endDate"], message: "Tanggal selesai tidak boleh lebih awal" });
  if (data.resourceType === "ITEM" && data.quantity === undefined) context.addIssue({ code: "custom", path: ["quantity"], message: "Jumlah unit wajib diisi" });
  if (data.resourceType === "ROOM" && data.startDate && data.endDate && data.endDate > data.startDate) {
    if (data.roomSlot !== "FULL_DAY") context.addIssue({ code: "custom", path: ["roomSlot"], message: "Peminjaman lintas hari wajib memakai kategori sehari penuh" });
  }
  const file = data.document?.[0];
  if (file && file.type !== "application/pdf") context.addIssue({ code: "custom", path: ["document"], message: "File harus berformat PDF" });
  if (file && file.size > 10 * 1024 * 1024) context.addIssue({ code: "custom", path: ["document"], message: "Ukuran PDF maksimal 10 MB" });
});

type Form = z.infer<typeof schema>;

function localDateTime(date: string, time: string): Date { return new Date(`${date}T${time}:00`); }
function todayValue(): string { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function jakartaPart(value: string, part: "date" | "time"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return part === "date" ? `${get("year")}-${get("month")}-${get("day")}` : `${get("hour")}:${get("minute")}`;
}
function bookingSlot(booking: Booking): RoomBookingSlot {
  const start = jakartaPart(booking.startTime, "time");
  const end = jakartaPart(booking.endTime, "time");
  if (start === "08:00" && end === "12:00") return "MORNING";
  if (start === "13:00" && end === "16:00") return "AFTERNOON";
  return "FULL_DAY";
}

export function BookingModal({ resource, booking = null, onClose, onSuccess }: Props) {
  const create = useCreateBooking();
  const update = useUpdatePendingBooking();
  const settings = useRoomBookingSettings();
  const today = todayValue();
  const { control, register, reset, setError, setValue, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { resourceType: "ROOM", startDate: today, endDate: today, roomSlot: "MORNING", quantity: 1, purpose: "" },
  });
  const watched = useWatch({ control });
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

  useEffect(() => {
    if (!resource) return;
    reset(booking ? {
      resourceType: resource.type,
      startDate: jakartaPart(booking.startTime, "date"),
      endDate: jakartaPart(booking.endTime, "date"),
      roomSlot: bookingSlot(booking),
      quantity: booking.bookingItems?.[0]?.quantity ?? 1,
      purpose: booking.purpose,
    } : { resourceType: resource.type, startDate: today, endDate: today, roomSlot: "MORNING", quantity: 1, purpose: "" });
  }, [booking, resource, reset, today]);

  useEffect(() => {
    if (!resource) return;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => event.key === "Escape" && !create.isPending && !update.isPending && onClose();
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", escape); };
  }, [create.isPending, onClose, resource, update.isPending]);

  if (!resource) return null;
  const isRoom = resource.type === "ROOM";
  const mutation = booking ? update : create;
  const serverMessage = axios.isAxiosError<{ error?: { message?: string } }>(mutation.error) ? mutation.error.response?.data.error?.message : undefined;
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
        input = { resourceType: "ROOM", roomId: resource.room.id, startDate: form.startDate ?? "", endDate: form.endDate ?? "", roomSlot: form.roomSlot, document: form.document?.[0], purpose: form.purpose };
      } else {
        if ((form.quantity ?? 0) > resource.item.totalStock) { setError("quantity", { message: `Maksimal ${resource.item.totalStock} unit` }); return; }
        const now = new Date(); const start = localDateTime(form.startDate ?? "", "00:00"); const end = localDateTime(form.endDate ?? "", "23:59");
        input = { resourceType: "ITEM", items: [{ itemId: resource.item.id, quantity: form.quantity ?? 1 }], startTime: (start < now ? now : start).toISOString(), endTime: end.toISOString(), purpose: form.purpose };
      }
      if (booking) await update.mutateAsync({ bookingId: booking.id, input });
      else await create.mutateAsync(input);
      onSuccess(); onClose();
    } catch { /* Mutation state renders feedback. */ }
  });

  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/65 px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
    <div className="flex items-start gap-4 border-b border-slate-200 bg-slate-50 p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white">{isRoom ? <Building2 size={21} /> : <Boxes size={21} />}</div><div className="flex-1"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">{booking ? "Edit pengajuan" : "Pengajuan peminjaman"}</p><h2 className="mt-1 text-xl font-bold">{isRoom ? resource.room.name : resource.item.name}</h2></div><button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Tutup modal"><X size={20} /></button></div>
    <form onSubmit={submit} className="space-y-5 p-5" noValidate>
      <input type="hidden" {...register("resourceType")} />
      <div className="grid gap-4 sm:grid-cols-2"><Field label={isRoom ? "Tanggal mulai" : "Tanggal pinjam"} error={errors.startDate?.message} icon={<CalendarDays size={16} />}><input type="date" min={today} className={inputClass} {...register("startDate")} /></Field><Field label={isRoom ? "Tanggal selesai" : "Tanggal kembali"} error={errors.endDate?.message} icon={<CalendarDays size={16} />}><input type="date" min={watched.startDate || today} className={inputClass} {...register("endDate")} /></Field></div>
      {isRoom ? <>
        <Field label="Kategori jam" error={errors.roomSlot?.message} icon={<Clock3 size={16} />}><div className="mt-2 grid gap-2 sm:grid-cols-3">{roomSlotOptions(settings.data).map((slot) => <RoomSlotButton key={slot.value} slot={slot.value} label={slot.label} time={slot.time} selected={watched.roomSlot === slot.value} disabled={multiDay && slot.value !== "FULL_DAY"} onSelect={() => setValue("roomSlot", slot.value, { shouldDirty: true, shouldValidate: true })} />)}</div><input type="hidden" {...register("roomSlot")} /></Field>
        {multiDay && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Peminjaman lintas hari memakai kategori sehari penuh.</p><p className="mt-1">Surat resmi unit kerja wajib menjadi bukti dan bahan pertimbangan persetujuan.</p></div>}
        {multiDay && <Field label={booking?.documentOriginalName ? "Ganti surat resmi (opsional, PDF maksimal 10 MB)" : "Surat resmi (PDF, maksimal 10 MB)"} error={errors.document?.message} icon={<FileText size={16} />}><input type="file" accept="application/pdf,.pdf" className={inputClass} {...register("document")} />{booking?.documentOriginalName && <span className="mt-1 block text-xs font-normal text-slate-500">File saat ini: {booking.documentOriginalName}</span>}</Field>}
      </> : <Field label={`Jumlah unit (maks. ${resource.item.totalStock})`} error={errors.quantity?.message}><input type="number" min={1} max={resource.item.totalStock} className={inputClass} {...register("quantity")} /></Field>}
      <Field label="Keperluan" error={errors.purpose?.message}><textarea rows={4} className={`${inputClass} resize-none`} {...register("purpose")} /></Field>
      {availabilityInput && <div className={`flex gap-3 rounded-xl border p-4 text-sm ${availability.isFetching ? "border-slate-200 bg-slate-50" : availability.data?.available ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{availability.isFetching ? <LoaderCircle size={18} className="animate-spin" /> : availability.data?.available ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<p className="font-bold">{availability.isFetching ? "Memeriksa ketersediaan..." : availability.data?.message}</p></div>}
      {mutation.isError && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{serverMessage ?? "Pengajuan gagal disimpan."}</div>}
      <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Batal</button><button type="submit" disabled={mutation.isPending || settings.isLoading && isRoom || availability.data?.available !== true} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{mutation.isPending ? "Menyimpan..." : booking ? "Simpan perubahan" : "Kirim pengajuan"}</button></div>
    </form>
  </div></div>;
}

function roomSlotOptions(settings: ReturnType<typeof useRoomBookingSettings>["data"]): Array<{ value: RoomBookingSlot; label: string; time: string }> {
  const time = (value: string | undefined, fallback: string) => value?.slice(0, 5) ?? fallback;
  return [
    { value: "MORNING", label: "Pagi", time: `${time(settings?.morningStartTime, "08:00")} - ${time(settings?.morningEndTime, "12:00")}` },
    { value: "AFTERNOON", label: "Siang", time: `${time(settings?.afternoonStartTime, "13:00")} - ${time(settings?.afternoonEndTime, "16:00")}` },
    { value: "FULL_DAY", label: "Sehari penuh", time: `${time(settings?.startTime, "08:00")} - ${time(settings?.endTime, "16:00")}` },
  ];
}

function RoomSlotButton({ slot, label, time, selected, disabled, onSelect }: { slot: RoomBookingSlot; label: string; time: string; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect} className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300"}`}><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs">{time} WIB</span><span className="sr-only">{slot}</span></button>;
}

const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
function Field({ label, error, icon, children }: { label: string; error?: string; icon?: React.ReactNode; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-slate-700"><span className="flex items-center gap-2">{icon}{label}</span>{children}{error && <span className="mt-1 block font-normal text-rose-600">{error}</span>}</label>; }
