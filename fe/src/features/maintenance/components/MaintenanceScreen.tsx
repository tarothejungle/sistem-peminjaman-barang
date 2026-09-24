import { Wrench } from "lucide-react";
import { Link } from "react-router-dom";

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" });

/** Shown in place of the application while maintenance mode is on. */
export function MaintenanceScreen({ message, estimatedEndAt }: { message: string; estimatedEndAt: string | null }) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-5 py-10 text-ink">
      <section className="w-full max-w-lg rounded-3xl border border-line bg-panel p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warn-soft text-warn"><Wrench size={26} aria-hidden="true" /></div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Website sedang dalam perbaikan</h1>
        <p className="mt-3 text-sm leading-6 text-ink-2">{message}</p>
        {estimatedEndAt && <p className="mt-4 rounded-xl border border-line bg-inset-soft px-4 py-3 text-sm font-semibold text-accent">Perkiraan selesai: {dateTimeFormat.format(new Date(estimatedEndAt))} WIB</p>}
        <p className="mt-6 border-t border-line pt-5 text-xs leading-5 text-ink-4">Terima kasih atas pengertiannya. Halaman ini akan tersedia kembali begitu perbaikan selesai.</p>
        <Link to="/maintenance-login" className="mt-4 inline-block text-xs font-bold text-accent transition hover:text-accent-hover">Masuk sebagai administrator</Link>
      </section>
    </main>
  );
}