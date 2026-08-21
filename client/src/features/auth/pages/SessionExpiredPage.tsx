import { Clock3, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "../../../components/common/BrandLogo";

export function SessionExpiredPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-5 py-10">
      <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />
      <section className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl shadow-slate-950/50 sm:p-10">
        <div className="mx-auto flex w-fit items-center gap-3">
          <BrandLogo className="h-11 w-11 shadow-lg shadow-blue-950/40" />
          <p className="text-left text-sm font-bold leading-5 text-white">Sistem Peminjaman<br />Barang & Ruang Rapat</p>
        </div>

        <div className="mx-auto mt-9 grid h-16 w-16 place-items-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-300/20">
          <Clock3 size={30} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Sesi berakhir</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Waktu login Anda telah habis</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-300">
          Sesi login berakhir karena tidak ada aktivitas. Silakan masuk kembali untuk melanjutkan penggunaan sistem.
        </p>

        <Link
          to="/login"
          replace
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          <LogIn size={18} aria-hidden="true" />
          Login kembali
        </Link>
      </section>
    </main>
  );
}
