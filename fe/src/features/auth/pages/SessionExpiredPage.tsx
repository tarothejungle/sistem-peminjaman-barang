import { Clock3, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "../../../components/common/BrandLogo";

export function SessionExpiredPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-surface px-5 py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-accent-soft blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 right-[-10%] h-72 w-72 rounded-full bg-accent-soft blur-[120px]" />
      <section className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-panel-strong p-6 text-center shadow-2xl shadow-shade backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex w-fit items-center gap-3">
          <BrandLogo className="h-11 w-11" />
          <div className="text-left">
            <p className="text-base font-bold leading-5 text-ink">Sistem Peminjaman Ruang Rapat & Kendaraan</p>
            <p className="text-[10px] uppercase tracking-widest text-accent">Kementerian Ketenagakerjaan</p>
          </div>
        </div>

        <div className="mx-auto mt-9 grid h-16 w-16 place-items-center rounded-2xl bg-warn-soft text-warn ring-1 ring-warn-line">
          <Clock3 size={30} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-warn">Sesi berakhir</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Waktu login Anda telah habis</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink-3">
          Sesi login berakhir karena tidak ada aktivitas. Silakan masuk kembali untuk melanjutkan penggunaan sistem.
        </p>

        <Link
          to="/login"
          replace
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-solid px-5 py-3 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <LogIn size={18} aria-hidden="true" />
          Login kembali
        </Link>
      </section>
    </main>
  );
}
