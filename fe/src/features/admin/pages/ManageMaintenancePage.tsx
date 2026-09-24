import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Power, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { useMaintenanceStatus, useUpdateMaintenance } from "../../maintenance/api/useMaintenance";
import { getAdminErrorMessage } from "./adminPage.utils";
import { inputClass, TableSkeleton } from "./ManageRoomsPage";

const schema = z
  .object({
    isEnabled: z.boolean(),
    message: z.string().trim().max(2000).optional(),
    estimatedEndAt: z.string().optional(),
  })
  .superRefine((form, context) => {
    if (!form.isEnabled) return;

    if (!form.estimatedEndAt) {
      context.addIssue({ code: "custom", path: ["estimatedEndAt"], message: "Perkiraan selesai wajib diisi" });
      return;
    }

    const deadline = new Date(form.estimatedEndAt).getTime();
    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      context.addIssue({ code: "custom", path: ["estimatedEndAt"], message: "Perkiraan selesai harus tanggal dan jam yang akan datang" });
    }
  });
type Form = z.infer<typeof schema>;

/** The form works in local wall-clock time; the API wants an explicit offset. */
function toLocalInput(value: string | Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Offered when the switch goes on: 30 minutes from now, rounded to a 5-minute mark. */
function defaultWindow(): string {
  const date = new Date(Date.now() + 30 * 60_000);
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5);
  return toLocalInput(date);
}

function isFutureWindow(value: string): boolean {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

/** Explicit lists: the native time field follows the browser locale, this one is always 24-hour. */
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" });

export function ManageMaintenancePage() {
  const status = useMaintenanceStatus();
  const update = useUpdateMaintenance();
  const [feedback, setFeedback] = useState<string | null>(null);
  const { register, reset, watch, setValue, handleSubmit, formState: { errors, isDirty } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { isEnabled: false, message: "", estimatedEndAt: "" },
  });
  const isEnabled = watch("isEnabled");
  const estimatedEndAt = watch("estimatedEndAt") ?? "";
  const [estimateDate = "", estimateClock = ""] = estimatedEndAt.split("T");
  const [estimateHour = "", estimateMinute = ""] = estimateClock.split(":");

  // The status is polled, so it may only re-seed the form while nothing has been
  // typed yet; otherwise a background refresh would wipe half-finished edits.
  useEffect(() => {
    if (!status.data || isDirty) return;
    reset({
      isEnabled: status.data.isEnabled,
      message: status.data.message,
      estimatedEndAt: toLocalInput(status.data.estimatedEndAt),
    });
  }, [isDirty, reset, status.data]);

  const setEstimate = (day: string, hour: string, minute: string) => {
    if (!day && !hour && !minute) {
      setValue("estimatedEndAt", "", { shouldValidate: true });
      return;
    }

    // Picking only a clock time means "today", so the two halves always combine.
    const nextDay = day || toLocalInput(new Date()).slice(0, 10);
    setValue("estimatedEndAt", `${nextDay}T${hour || "00"}:${minute || "00"}`, { shouldValidate: true });
  };

  const toggleEnabled = (enabled: boolean) => {
    setValue("isEnabled", enabled);
    // The deadline is what reopens the site, so never leave it empty or stale.
    if (enabled && !isFutureWindow(estimatedEndAt)) setValue("estimatedEndAt", defaultWindow(), { shouldValidate: true });
  };

  const submit = handleSubmit(async (form) => {
    try {
      await update.mutateAsync({
        isEnabled: form.isEnabled,
        message: form.message ?? "",
        estimatedEndAt: form.estimatedEndAt ? new Date(form.estimatedEndAt).toISOString() : null,
      });
      // Saving aligns the form with the server, so the polled status may re-seed
      // it again later — e.g. when the deadline passes and the site reopens.
      reset(form);
      setFeedback(form.isEnabled ? "Mode maintenance diaktifkan. Website terbuka kembali otomatis setelah perkiraan selesai." : "Mode maintenance dimatikan. Website dapat diakses kembali.");
    } catch {
      // Mutation error renders below the form.
    }
  });

  const preview = Number.isFinite(new Date(estimatedEndAt).getTime()) ? dateTimeFormat.format(new Date(estimatedEndAt)) : null;
  const activeDeadline = status.data?.isEnabled && status.data.estimatedEndAt ? dateTimeFormat.format(new Date(status.data.estimatedEndAt)) : null;

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-7 text-ink shadow-2xl backdrop-blur-xl sm:px-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-warn-soft blur-[100px]" />
      <div className="relative flex items-start gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-solid text-onaccent shadow-lg shadow-accent-glow"><Wrench size={22} /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Pengaturan Sistem</p>
          <h2 className="mt-1 text-2xl font-bold">Mode Maintenance</h2>
          <p className="mt-1 text-sm text-ink-3">Saat diaktifkan, seluruh halaman ditutup dan pengguna hanya melihat informasi perbaikan sampai waktu perkiraan selesai. Administrator tetap dapat masuk.</p>
        </div>
      </div>
    </section>

    {status.isLoading && <TableSkeleton />}
    {status.isError && <p className="rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger">Status maintenance gagal dimuat. Muat ulang halaman.</p>}

    {status.data && <>
      <section className={`flex items-start gap-3 rounded-2xl border p-5 text-sm ${status.data.isEnabled ? "border-warn-line bg-warn-soft text-warn" : "border-ok-line bg-ok-soft text-ok"}`}>
        <Power size={20} aria-hidden="true" />
        <div>
          <p className="font-bold">{status.data.isEnabled ? "Website sedang ditutup" : "Website dapat diakses"}</p>
          <p className="mt-1">{status.data.isEnabled ? "Pengguna selain administrator tidak dapat membuka aplikasi." : "Tidak ada penutupan yang aktif saat ini."}{activeDeadline && ` Website terbuka kembali otomatis pada ${activeDeadline}.`}{status.data.updatedAt && ` Terakhir diubah ${dateTimeFormat.format(new Date(status.data.updatedAt))}.`}</p>
        </div>
      </section>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-panel p-6 shadow-2xl backdrop-blur-xl">
        <label className="flex items-start gap-3 rounded-xl border border-line bg-inset-soft p-4">
          <input type="checkbox" className="mt-0.5 size-4" checked={isEnabled} onChange={(event) => toggleEnabled(event.target.checked)} />
          <span className="text-sm text-ink-2"><span className="block font-bold text-ink">Aktifkan mode maintenance</span><span className="mt-1 block">Website ditutup untuk seluruh role kecuali administrator. Pastikan tidak ada peminjaman yang sedang berjalan.</span></span>
        </label>

        {isEnabled && <div className="flex items-start gap-3 rounded-xl border border-warn-line bg-warn-soft p-4 text-sm text-warn"><AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><p>Setelah disimpan, pengguna yang sedang membuka aplikasi akan dialihkan ke halaman perbaikan dalam waktu kurang dari satu menit. Begitu waktu perkiraan selesai terlewat, website terbuka kembali dengan sendirinya &mdash; tanpa perlu dimatikan manual.</p></div>}

        <label className="block text-sm font-semibold text-ink-2">Pesan untuk pengguna<span className="ml-2 text-xs font-normal text-ink-4">Kosongkan untuk memakai pesan bawaan</span><textarea rows={5} placeholder="Contoh: Website sedang dalam perbaikan terjadwal. Kami mohon maaf atas ketidaknyamanannya, silakan coba beberapa saat lagi." className={`${inputClass} resize-y`} {...register("message")} /></label>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink-2">Perkiraan selesai<span className="ml-2 text-xs font-normal text-ink-4">Wajib diisi &middot; format 24 jam (WIB)</span></p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-ink-3">Tanggal<input type="date" lang="id-ID" className={inputClass} value={estimateDate} onChange={(event) => setEstimate(event.target.value, estimateHour, estimateMinute)} /></label>
            <label className="block text-xs font-semibold text-ink-3">Jam (24 jam)<select className={inputClass} value={estimateHour} onChange={(event) => setEstimate(estimateDate, event.target.value, estimateMinute)}>{estimateHour === "" && <option value="">Pilih jam</option>}{HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}</select></label>
            <label className="block text-xs font-semibold text-ink-3">Menit<select className={inputClass} value={estimateMinute} onChange={(event) => setEstimate(estimateDate, estimateHour, event.target.value)}>{estimateMinute === "" && <option value="">Pilih menit</option>}{MINUTES.map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select></label>
          </div>
          {errors.estimatedEndAt && <p role="alert" className="text-xs text-danger">{errors.estimatedEndAt.message}</p>}
          {preview && !errors.estimatedEndAt && <p className="text-xs leading-5 text-ink-3">Maintenance berakhir <span className="font-bold text-ink-2">{preview} WIB</span>. Setelah jam tersebut website terbuka kembali dengan sendirinya.</p>}
        </div>

        {update.error && <p className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(update.error)}</p>}

        <div className="flex justify-end border-t border-line pt-4"><button type="submit" disabled={update.isPending} className="rounded-xl bg-accent-solid px-5 py-2.5 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50">{update.isPending ? "Menyimpan..." : "Simpan pengaturan"}</button></div>
      </form>
    </>}

    {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
  </div>;
}