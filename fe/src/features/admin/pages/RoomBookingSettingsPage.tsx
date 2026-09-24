import { zodResolver } from "@hookform/resolvers/zod";
import { Clock3, Moon, Sun, Sunrise } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRoomBookingSettings, useUpdateRoomBookingSettings } from "../../settings/api/useRoomBookingSettings";
import { getAdminErrorMessage } from "./adminPage.utils";
import { SuccessToast } from "../../../components/common/SuccessToast";

const schema = z.object({
  morningStartTime: z.string().min(1, "Jam mulai wajib diisi"),
  morningEndTime: z.string().min(1, "Jam selesai wajib diisi"),
  afternoonStartTime: z.string().min(1, "Jam mulai wajib diisi"),
  afternoonEndTime: z.string().min(1, "Jam selesai wajib diisi"),
}).superRefine((data, context) => {
  if (data.morningStartTime >= data.morningEndTime) context.addIssue({ code: "custom", path: ["morningEndTime"], message: "Jam selesai harus setelah jam mulai" });
  if (data.afternoonStartTime >= data.afternoonEndTime) context.addIssue({ code: "custom", path: ["afternoonEndTime"], message: "Jam selesai harus setelah jam mulai" });
  if (data.morningEndTime > data.afternoonStartTime) context.addIssue({ code: "custom", path: ["afternoonStartTime"], message: "Sesi siang tidak boleh tumpang tindih sesi pagi" });
});

type Form = z.infer<typeof schema>;

const defaults: Form = { morningStartTime: "08:00", morningEndTime: "12:00", afternoonStartTime: "13:00", afternoonEndTime: "16:00" };
const inputClass = "mt-2 w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring";

export function RoomBookingSettingsPage() {
  const settings = useRoomBookingSettings();
  const update = useUpdateRoomBookingSettings();
  const [feedback, setFeedback] = useState<string | null>(null);
  const { register, reset, watch, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: defaults });
  const values = watch();

  useEffect(() => {
    if (!settings.data) return;
    reset({
      morningStartTime: settings.data.morningStartTime.slice(0, 5),
      morningEndTime: settings.data.morningEndTime.slice(0, 5),
      afternoonStartTime: settings.data.afternoonStartTime.slice(0, 5),
      afternoonEndTime: settings.data.afternoonEndTime.slice(0, 5),
    });
  }, [reset, settings.data]);

  const submit = handleSubmit(async (input) => {
    try {
      await update.mutateAsync({ ...input, fullDayStartTime: input.morningStartTime, fullDayEndTime: input.afternoonEndTime });
      setFeedback("Kategori jam peminjaman ruang berhasil diperbarui.");
    } catch {
      // Mutation error renders below form.
    }
  });

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-7 text-ink shadow-2xl backdrop-blur-xl sm:px-8"><div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent-soft blur-[100px]" /><div className="relative flex items-start gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-solid text-onaccent shadow-lg shadow-accent-glow"><Clock3 size={22} /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Pengaturan KABAG UMUM</p><h2 className="mt-1 text-2xl font-bold">Kategori Jam Peminjaman Ruangan</h2><p className="mt-1 text-sm text-ink-3">Atur sesi pagi dan siang. Kategori sehari penuh mengikuti awal sesi pagi sampai akhir sesi siang.</p></div></div></section>
    <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-2xl border border-line bg-panel p-6 shadow-2xl backdrop-blur-xl">
      <TimeRange title="Sesi pagi" description="Kategori 1" icon={<Sunrise size={20} />} startError={errors.morningStartTime?.message} endError={errors.morningEndTime?.message} startInput={<input type="time" className={inputClass} {...register("morningStartTime")} />} endInput={<input type="time" className={inputClass} {...register("morningEndTime")} />} />
      <TimeRange title="Sesi siang" description="Kategori 2" icon={<Sun size={20} />} startError={errors.afternoonStartTime?.message} endError={errors.afternoonEndTime?.message} startInput={<input type="time" className={inputClass} {...register("afternoonStartTime")} />} endInput={<input type="time" className={inputClass} {...register("afternoonEndTime")} />} />
      <div className="rounded-xl border border-accent-line bg-accent-soft p-4"><div className="flex items-center gap-2 font-bold text-accent"><Moon size={20} />Sehari penuh <span className="font-normal text-accent">Kategori 3</span></div><p className="mt-2 text-lg font-bold text-ink">{values.morningStartTime || "--:--"} - {values.afternoonEndTime || "--:--"} WIB</p><p className="mt-1 text-sm text-accent">Kategori wajib untuk peminjaman lebih dari satu hari.</p></div>
      <p className="rounded-xl border border-line bg-inset px-4 py-3 text-sm text-ink-2">Zona waktu: Asia/Jakarta. Booking lama tidak berubah saat pengaturan diperbarui.</p>
      {update.error && <p className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(update.error)}</p>}
      <button type="submit" disabled={settings.isLoading || update.isPending} className="rounded-xl bg-accent-solid px-5 py-2.5 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50">{update.isPending ? "Menyimpan..." : "Simpan pengaturan"}</button>
    </form>
    {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
  </div>;
}

function TimeRange({ title, description, icon, startInput, endInput, startError, endError }: { title: string; description: string; icon: React.ReactNode; startInput: React.ReactNode; endInput: React.ReactNode; startError?: string; endError?: string }) {
  return <section className="rounded-xl border border-line bg-inset-soft p-4"><div className="flex items-center gap-2 font-bold text-ink">{icon}{title}<span className="font-normal text-ink-3">{description}</span></div><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-ink-2">Jam mulai{startInput}{startError && <span className="mt-1 block font-normal text-danger">{startError}</span>}</label><label className="text-sm font-semibold text-ink-2">Jam selesai{endInput}{endError && <span className="mt-1 block font-normal text-danger">{endError}</span>}</label></div></section>;
}
