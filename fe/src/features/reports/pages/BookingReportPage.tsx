import { AlertCircle, FileSpreadsheet, FileText, Info, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { SuccessToast } from "../../../components/common/SuccessToast";
import type { BookingStatus } from "../../../types";
import { reportStatusOptions } from "../../bookings/bookingStatus";
import { downloadBookingReport, reportErrorMessage, type BookingReportFormat } from "../api/useBookingReport";

const inputClass = "mt-2 w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring";

export function BookingReportPage() {
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, setPending] = useState<BookingReportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const rangeInvalid = Boolean(from && to && to < from);
  const busy = pending !== null;

  const download = async (format: BookingReportFormat) => {
    setPending(format);
    setError(null);
    setFeedback(null);
    try {
      await downloadBookingReport(format, { status, from, to });
      setFeedback(`Laporan peminjaman ${format.toUpperCase()} berhasil diunduh.`);
    } catch (requestError) {
      setError((await reportErrorMessage(requestError)) ?? "Laporan gagal diunduh. Coba lagi.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-7 text-ink shadow-2xl backdrop-blur-xl sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent-soft blur-[100px]" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-solid text-onaccent shadow-lg shadow-accent-glow"><FileSpreadsheet size={24} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Laporan</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Export laporan peminjaman</h2><p className="mt-2 text-sm text-ink-3">Unduh rekap peminjaman kendaraan dan ruangan dalam format Excel atau PDF.</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-ink-2">Status<select value={status} onChange={(event) => setStatus(event.target.value as BookingStatus | "")} className={inputClass}><option value="">Semua status</option>{reportStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="block text-sm font-semibold text-ink-2">Dari tanggal<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className={inputClass} /></label>
          <label className="block text-sm font-semibold text-ink-2">Sampai tanggal<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={inputClass} /></label>
        </div>

        {rangeInvalid && <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger"><AlertCircle size={16} /> Tanggal akhir tidak boleh lebih awal dari tanggal mulai.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-5 text-ink-3"><Info size={15} className="mt-0.5 shrink-0 text-ink-4" /> Kosongkan filter untuk mengekspor seluruh peminjaman.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy || rangeInvalid} onClick={() => download("xlsx")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ok-solid px-4 text-sm font-bold text-onaccent transition hover:bg-ok-hover disabled:opacity-50">{pending === "xlsx" ? <LoaderCircle size={17} className="animate-spin" /> : <FileSpreadsheet size={17} />}{pending === "xlsx" ? "Menyiapkan..." : "Unduh Excel (.xlsx)"}</button>
            <button type="button" disabled={busy || rangeInvalid} onClick={() => download("pdf")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger-solid px-4 text-sm font-bold text-onaccent transition hover:bg-danger-hover disabled:opacity-50">{pending === "pdf" ? <LoaderCircle size={17} className="animate-spin" /> : <FileText size={17} />}{pending === "pdf" ? "Menyiapkan..." : "Unduh PDF (.pdf)"}</button>
          </div>
        </div>
      </section>

      {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}
