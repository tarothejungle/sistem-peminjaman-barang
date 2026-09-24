import { Clock3, LogIn, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { getRoleLabel } from "../../../utils/roleLabel";
import { useLoginActivities } from "../api/useLoginActivities";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function LoginActivityPanel() {
  const [page, setPage] = useState(1);
  const query = useLoginActivities(page);
  const data = query.data;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 border-b border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-accent"><LogIn size={17} /><span className="text-xs font-bold uppercase tracking-[0.22em]">Aktivitas Login</span></div>
          <h2 className="mt-2 text-xl font-extrabold text-ink">Aktivitas user dalam 24 jam terakhir</h2>
          <p className="mt-1 text-sm text-ink-3">Data diperbarui otomatis setiap 30 detik dan dihapus setelah berumur 24 jam.</p>
        </div>
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink-2 transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} /> Perbarui
        </button>
      </div>

      <div className="grid gap-3 p-6 sm:grid-cols-3">
        <SummaryCard icon={LogIn} label="Total login" value={data?.summary.loginCount ?? 0} />
        <SummaryCard icon={Users} label="User unik" value={data?.summary.uniqueUserCount ?? 0} />
        <SummaryCard icon={Clock3} label="Sesi aktif" value={data?.summary.activeSessionCount ?? 0} />
      </div>

      <div className="overflow-x-auto border-t border-line">
        <table className="min-w-full divide-y divide-line text-left text-sm">
          <thead className="bg-inset-soft text-[11px] uppercase tracking-wider text-ink-4">
            <tr><th className="px-6 py-3 font-bold">User</th><th className="px-6 py-3 font-bold">Role</th><th className="px-6 py-3 font-bold">Waktu login</th><th className="px-6 py-3 font-bold">Aktivitas terakhir</th><th className="px-6 py-3 font-bold">Status sesi</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {query.isLoading && <TableMessage message="Memuat aktivitas login..." />}
            {query.isError && <TableMessage message="Aktivitas login gagal dimuat." />}
            {!query.isLoading && !query.isError && data?.activities.length === 0 && <TableMessage message="Belum ada aktivitas login dalam 24 jam terakhir." />}
            {data?.activities.map((activity) => (
              <tr key={activity.id} className="text-ink-2 transition hover:bg-hover">
                <td className="px-6 py-4"><p className="font-bold text-ink">{activity.user.fullName}</p><p className="mt-1 text-xs text-ink-4">@{activity.user.username}</p></td>
                <td className="whitespace-nowrap px-6 py-4">{getRoleLabel(activity.user.role)}</td>
                <td className="whitespace-nowrap px-6 py-4">{formatDateTime(activity.loggedInAt)}</td>
                <td className="whitespace-nowrap px-6 py-4">{formatDateTime(activity.lastActivityAt)}</td>
                <td className="whitespace-nowrap px-6 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${activity.status === "ACTIVE" ? "border-ok-line bg-ok-soft text-ok" : "border-line-strong bg-raised-strong text-ink-3"}`}>{activity.status === "ACTIVE" ? "Aktif" : "Berakhir"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pagination.lastPage > 1 && (
        <div className="flex items-center justify-between border-t border-line px-6 py-4 text-xs text-ink-3">
          <span>Halaman {data.pagination.currentPage} dari {data.pagination.lastPage} ({data.pagination.total} aktivitas)</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-line px-3 py-2 font-bold transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>
            <button type="button" disabled={page >= data.pagination.lastPage} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line px-3 py-2 font-bold transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof LogIn; label: string; value: number }) {
  return <div className="rounded-xl border border-accent-line bg-inset-soft p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent"><Icon size={15} />{label}</div><p className="mt-3 text-2xl font-black text-ink">{value}</p></div>;
}

function TableMessage({ message }: { message: string }) {
  return <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-ink-4">{message}</td></tr>;
}

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "-";
}
