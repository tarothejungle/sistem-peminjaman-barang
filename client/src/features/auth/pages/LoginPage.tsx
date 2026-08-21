import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuthStore } from "../../../store/authStore";
import { BrandLogo } from "../../../components/common/BrandLogo";
import { useLoginMutation } from "../api/useAuthMutations";
import { getAuthErrorMessage } from "./auth.utils";

const loginSchema = z.object({
  email: z.string().trim().email("Masukkan alamat email yang valid").max(255),
  password: z.string().min(1, "Password wajib diisi").max(72),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginLocationState {
  from?: {
    pathname?: string;
  };
  logoutSuccess?: boolean;
  sessionExpired?: boolean;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const loginMutation = useLoginMutation();
  const locationState = location.state as LoginLocationState | null;
  const [showLogoutSuccess, setShowLogoutSuccess] = useState(Boolean(locationState?.logoutSuccess));
  useEffect(() => {
    if (!showLogoutSuccess) return;
    const timer = window.setTimeout(() => { setShowLogoutSuccess(false); navigate(location.pathname, { replace: true, state: null }); }, 3_000);
    return () => window.clearTimeout(timer);
  }, [location.pathname, navigate, showLogoutSuccess]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = handleSubmit(async (input) => {
    navigate(location.pathname, { replace: true, state: null });
    try {
      const result = await loginMutation.mutateAsync(input);
      setAuth(result.user, result.accessToken, result.inactivityTimeoutSeconds, result.activityHeartbeatSeconds);

      navigate(locationState?.from?.pathname ?? "/dashboard", { replace: true, state: { loginSuccess: true } });
    } catch {
      // Mutation state renders API error feedback.
    }
  });

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-slate-900 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-slate-700 p-12 text-white lg:flex">
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <BrandLogo className="h-11 w-11 shadow-lg shadow-blue-950/40" />
          <div>
            <p className="font-bold tracking-wide">Sistem Peminjaman Barang & Ruang Rapat</p>
            <p className="text-xs text-slate-400">Satu Sistem Untuk Semua</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-400">Ruang kerja bersama</p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.08] tracking-tight">platform digitalisasi peminjaman barang & ruang rapat.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">Sistem ini hadir untuk mempermudah proses pengajuan peminjaman barang & ruang rapat secara mandiri.</p>
        </div>
        <p className="relative text-xs text-slate-500">Sistem Peminjaman Barang & Ruang Rapat</p>
      </section>

      <section className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandLogo className="h-10 w-10" />
            <p className="font-bold tracking-wide text-slate-900">Sistem Peminjaman Barang & Ruang Rapat</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Selamat datang</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Masuk ke akun Anda</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Gunakan akun terdaftar untuk masuk ke dalam sistem.</p>

          {showLogoutSuccess && (
            <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Logout berhasil. Sampai jumpa kembali.
            </div>
          )}

          {locationState?.sessionExpired && (
            <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Sesi tidak valid atau telah berakhir. Silakan masuk kembali.
            </div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleLogin} noValidate>
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-slate-700">Email</label>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-3 top-3 text-slate-400" size={19} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
              </div>
              {errors.email && <p className="mt-1.5 text-sm text-rose-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative mt-2">
                <KeyRound className="pointer-events-none absolute left-3 top-3 text-slate-400" size={19} aria-hidden="true" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
              </div>
              {errors.password && <p className="mt-1.5 text-sm text-rose-600">{errors.password.message}</p>}
            </div>

            {loginMutation.isError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {getAuthErrorMessage(loginMutation.error)}
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginMutation.isPending ? "Memeriksa akun..." : "Masuk"}
              {!loginMutation.isPending && <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>

          {/* <p className="mt-7 text-center text-sm text-slate-600">Akun pengguna dibuat dan dikelola oleh KABAG UMUM.</p> */}
        </div>
      </section>
    </main>
  );
}
