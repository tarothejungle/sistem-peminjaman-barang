import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, History } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { apiErrorMessage } from "../../../lib/apiError";
import { useAuthStore } from "../../../store/authStore";
import { Role } from "../../../types";
import { formatBookingSchedule, getBookingResourceName } from "../../bookings/bookingDisplay";
import { useCancelRoomBooking, useRoomBookingCancellationOptions, useRoomBookingCancellations } from "../api/useRoomBookingCancellations";

const schema = z.object({
  bookingId: z.string().uuid("Pilih peminjaman ruang rapat"),
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter").max(1000),
});

type FormValues = z.infer<typeof schema>;

export function RoomBookingCancellationPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canCancel = role === Role.PJ_RUANGAN;
  const options = useRoomBookingCancellationOptions(canCancel);
  const history = useRoomBookingCancellations();
  const cancel = useCancelRoomBooking();
  const [feedback, setFeedback] = useState<string | null>(null);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { bookingId: "", reason: "" } });
  const bookingId = useWatch({ control, name: "bookingId" });
  const selected = useMemo(() => options.data?.find((booking) => booking.id === bookingId), [bookingId, options.data]);
  const submit = handleSubmit(async (values) => {
    try {
      await cancel.mutateAsync(values);
      reset();
      setFeedback("Peminjaman ruang berhasil dibatalkan dan ruang tersedia kembali.");
    } catch {
      // Mutation error renders below form.
    }
  });

  return <div className="space-y-6">
    <section className="rounded-2xl border border-line bg-panel p-6 shadow-2xl"><div className="flex items-start gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger"><Ban size={23} /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-danger">Pembatalan ruang</p><h2 className="mt-2 text-2xl font-bold text-ink">Pembatalan Peminjaman Ruang Rapat</h2><p className="mt-2 text-sm text-ink-3">PJ Ruangan membatalkan sepihak peminjaman yang sudah disetujui. Kasubag menerima notifikasi dan melihat history.</p></div></div></section>

    {canCancel && <section className="rounded-2xl border border-line bg-panel p-5 shadow-2xl sm:p-6"><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold text-ink-2">Nama ruang rapat<select className="mt-2 w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink" {...register("bookingId")}><option value="">Pilih peminjaman aktif</option>{options.data?.map((booking) => <option key={booking.id} value={booking.id}>{getBookingResourceName(booking)} — {formatBookingSchedule(booking)}</option>)}</select>{errors.bookingId && <span className="mt-1 block text-xs text-danger">{errors.bookingId.message}</span>}</label><div className="grid gap-4 md:grid-cols-3"><ReadOnlyField label="Nama unit kerja" value={selected?.workUnit ?? "-"} /><ReadOnlyField label="Nama penanggung jawab" value={selected?.responsibleName ?? "-"} /><ReadOnlyField label="Tanggal peminjaman" value={selected ? formatBookingSchedule(selected) : "-"} /></div><ReadOnlyField label="Keterangan / Keperluan" value={selected?.purpose ?? "-"} /><label className="block text-sm font-semibold text-ink-2">Alasan pembatalan<textarea rows={4} className="mt-2 w-full resize-none rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink" {...register("reason")} />{errors.reason && <span className="mt-1 block text-xs text-danger">{errors.reason.message}</span>}</label>{cancel.error && <p role="alert" className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{apiErrorMessage(cancel.error) ?? "Pembatalan gagal diproses."}</p>}<div className="flex justify-end"><button type="submit" disabled={cancel.isPending || options.isLoading} className="rounded-xl bg-danger-solid px-5 py-2.5 text-sm font-bold text-onaccent disabled:opacity-50">{cancel.isPending ? "Membatalkan..." : "Batalkan Peminjaman"}</button></div></form></section>}

    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"><div className="flex items-center gap-2 border-b border-line px-5 py-4"><History size={18} className="text-accent" /><h3 className="font-bold text-ink">History Pembatalan</h3></div>{history.isLoading && <p className="p-6 text-sm text-ink-3">Memuat history...</p>}{history.isError && <p className="p-6 text-sm text-danger">History pembatalan gagal dimuat.</p>}{history.data?.length === 0 && <p className="p-6 text-sm text-ink-3">Belum ada pembatalan ruang rapat.</p>}{history.data && history.data.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="bg-inset-soft text-xs uppercase text-ink-3"><tr><th className="px-5 py-3">Ruang</th><th className="px-5 py-3">Unit Kerja</th><th className="px-5 py-3">Penanggung Jawab</th><th className="px-5 py-3">Keterangan / Keperluan</th><th className="px-5 py-3">Tanggal Peminjaman</th><th className="px-5 py-3">Dibatalkan Oleh</th><th className="px-5 py-3">Alasan</th></tr></thead><tbody className="divide-y divide-line">{history.data.map((item) => <tr key={item.id}><td className="px-5 py-4 font-bold text-ink">{item.roomName}</td><td className="px-5 py-4 text-ink-3">{item.workUnit}</td><td className="px-5 py-4 text-ink-3">{item.responsibleName}</td><td className="max-w-sm px-5 py-4 text-ink-3">{item.purpose ?? "-"}</td><td className="px-5 py-4 text-ink-3">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.bookingStartTime))}</td><td className="px-5 py-4 text-ink-3">{item.requestedByName}</td><td className="max-w-sm px-5 py-4 text-ink-3">{item.reason}</td></tr>)}</tbody></table></div>}</section>
    {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
  </div>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm font-semibold text-ink-2">{label}</p><p className="mt-2 min-h-11 rounded-xl border border-line bg-inset-soft px-3 py-2.5 text-sm text-ink-3">{value}</p></div>;
}
