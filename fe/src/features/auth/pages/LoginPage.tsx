import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, User as UserIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { BrandLogo } from "../../../components/common/BrandLogo";
import { ThemeSwitcher } from "../../../components/layout/ThemeSwitcher";
import { useAuthStore } from "../../../store/authStore";
import { getAuthConfig, useLoginMutation } from "../api/useAuthMutations";
import { LoginAttentionNotice } from "../../attention/components/LoginAttentionNotice";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { getAuthErrorMessage } from "./auth.utils";

const AnimatedShaderBackground = lazy(() => import("@/components/ui/animated-shader-background"));
const REMEMBERED_USERNAME_KEY = "remembered-login-username";

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username wajib diisi")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[A-Za-z0-9._-]+$/, "Username hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung"),
  password: z.string().min(1, "Password wajib diisi").max(72),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginLocationState {
  from?: {
    pathname?: string;
  };
  logoutSuccess?: boolean;
  sessionExpired?: boolean;
  passwordResetSuccess?: boolean;
}

/**
 * `maintenance` is the administrator door: the site is closed, but an
 * administrator still has to sign in to check things and reopen it. It skips
 * the "already signed in" bounce that `/login` performs.
 */
export function LoginPage({ mode = "standard" }: { mode?: "standard" | "maintenance" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMaintenance = mode === "maintenance";
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const loginMutation = useLoginMutation();
  const locationState = location.state as LoginLocationState | null;
  const rememberedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? "";
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedUsername));
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [showLogoutSuccess, setShowLogoutSuccess] = useState(Boolean(locationState?.logoutSuccess));
  const [showResetSuccess, setShowResetSuccess] = useState(Boolean(locationState?.passwordResetSuccess));
  const authConfig = useQuery({ queryKey: ["auth", "config"], queryFn: getAuthConfig, staleTime: Number.POSITIVE_INFINITY });

  useEffect(() => {
    if (!showLogoutSuccess && !showResetSuccess) return;
    const timer = window.setTimeout(() => {
      setShowLogoutSuccess(false);
      setShowResetSuccess(false);
      navigate(location.pathname, { replace: true, state: null });
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [location.pathname, navigate, showLogoutSuccess, showResetSuccess]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: rememberedUsername, password: "" },
  });

  if (isAuthenticated && !isMaintenance) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = handleSubmit(async (input) => {
    navigate(location.pathname, { replace: true, state: null });
    try {
      const result = await loginMutation.mutateAsync({ ...input, captchaToken: captchaToken || undefined });
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_USERNAME_KEY, input.username);
      } else {
        localStorage.removeItem(REMEMBERED_USERNAME_KEY);
      }
      setAuth(result.user, result.accessToken, result.inactivityTimeoutSeconds, result.activityHeartbeatSeconds);
      navigate(locationState?.from?.pathname ?? "/dashboard", { replace: true });
    } catch {
      if (authConfig.data?.turnstileEnabled) {
        setCaptchaToken("");
        setCaptchaResetKey((key) => key + 1);
      }
      // Mutation state renders API error feedback.
    }
  });

  const submitDisabled =
    loginMutation.isPending ||
    authConfig.isLoading ||
    authConfig.isError ||
    Boolean(authConfig.data?.turnstileEnabled && !captchaToken);

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-login-canvas px-4 py-6 sm:py-10">
      {/* WebGL shader background layer — pointer-events-none so clicks/inputs pass through to the form. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 opacity-80">
        <Suspense fallback={null}>
          <AnimatedShaderBackground />
        </Suspense>
      </div>
      {/* Overlays sit on the shader canvas, which is dark in both themes. */}
      <div aria-hidden="true" className="login-grid login-grid--on-canvas pointer-events-none absolute inset-0 z-0" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-login-canvas-hairline" />

      <section
        aria-labelledby="login-form-heading"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-line border-t-line-strong bg-panel-strong p-6 text-ink shadow-2xl shadow-shade backdrop-blur-xl sm:p-8 md:p-10"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />

        {/* Theme choice sits before the form so it can be made without signing in. */}
        <div className="mb-4 flex justify-end">
          <ThemeSwitcher variant="compact" />
        </div>

        <header className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="mb-5 h-[65px] w-[65px]" />
          <h1 id="login-form-heading" className="text-2xl font-bold text-ink">
            {isMaintenance ? "Masuk sebagai Administrator" : "Masuk ke Portal"}
          </h1>
          <p className="mt-1 max-w-xs text-[9px] font-bold uppercase leading-4 text-accent">
            Sistem Peminjaman Ruang Rapat &amp; Kendaraan
          </p>
          {isMaintenance && (
            <p className="mt-3 max-w-sm rounded-xl border border-warn-line bg-warn-soft px-4 py-2.5 text-xs leading-5 text-ink-2">
              Website sedang dalam perbaikan. Hanya akun administrator yang dapat masuk untuk memeriksa dan mengaktifkan kembali layanan.
            </p>
          )}
        </header>

        {showLogoutSuccess && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-ok-line bg-ok-soft px-4 py-2.5 text-sm text-ok"
          >
            Logout berhasil. Sampai jumpa kembali.
          </div>
        )}

        {showResetSuccess && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-ok-line bg-ok-soft px-4 py-2.5 text-sm text-ok"
          >
            Password berhasil diubah. Silakan masuk dengan password baru Anda.
          </div>
        )}

        {locationState?.sessionExpired && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-2.5 text-sm text-warn"
          >
            Sesi tidak valid atau telah berakhir. Silakan masuk kembali.
          </div>
        )}

        {isMaintenance && isAuthenticated && user && (
          <div role="status" className="mb-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-2.5 text-xs leading-5 text-ink-2">
            Anda masih masuk sebagai <span className="font-bold text-ink">{user.username}</span>. Silakan masuk memakai akun administrator, atau{" "}
            <button type="button" onClick={() => void logout()} className="font-bold text-accent underline transition hover:text-accent-hover">keluar dari sesi ini</button>.
          </div>
        )}

        <LoginAttentionNotice />

        <form className="flex flex-col gap-5" onSubmit={handleLogin} noValidate aria-busy={loginMutation.isPending}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-ink-2">
              Username
            </label>
            <div className="relative">
              <UserIcon
                className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-4"
                aria-hidden="true"
              />
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded-xl border border-line bg-inset px-4 py-3 pl-10 text-ink caret-accent placeholder:text-ink-4 transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong focus:border-accent focus:bg-inset-strong focus:outline-none focus:ring-2 focus:ring-accent-ring"
                aria-invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? "username-error" : undefined}
                placeholder="Masukkan username"
                {...register("username")}
              />
            </div>
            {errors.username && (
              <p id="username-error" className="text-xs text-danger" role="alert">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-ink-2">
              Password
            </label>
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-4"
                aria-hidden="true"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="w-full rounded-xl border border-line bg-inset px-4 py-3 pl-10 pr-14 text-ink caret-accent placeholder:text-ink-4 transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong focus:border-accent focus:bg-inset-strong focus:outline-none focus:ring-2 focus:ring-accent-ring"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                placeholder="Masukkan password"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-ink-4 transition-colors duration-200 hover:bg-hover hover:text-ink-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              >
                {showPassword ? (
                  <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
                ) : (
                  <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-xs text-danger" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <label className="group inline-flex min-h-11 cursor-pointer select-none items-center gap-2 text-xs font-medium text-ink-2">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span
                aria-hidden="true"
                className="grid h-4 w-4 place-items-center rounded border border-line-strong bg-inset transition-[border-color,background-color,box-shadow] duration-200 peer-checked:border-accent peer-checked:bg-accent-solid peer-checked:shadow-[0_0_0_3px_var(--accent-ring)] peer-checked:[&>svg]:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-ring"
              >
                <svg
                  className="h-3 w-3 scale-0 text-onaccent transition-transform duration-150"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path d="M5 10l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Ingat Saya</span>
            </label>
            <Link
              to="/forgot-password"
              className="inline-flex min-h-11 items-center rounded-lg px-1 text-xs font-medium text-accent transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            >
              Lupa Password?
            </Link>
          </div>

          {authConfig.data?.turnstileEnabled && authConfig.data.turnstileSiteKey && (
            <div className="my-1 flex justify-center rounded-xl border border-line bg-inset-soft p-2">
              <TurnstileWidget
                siteKey={authConfig.data.turnstileSiteKey}
                resetKey={captchaResetKey}
                onTokenChange={setCaptchaToken}
              />
            </div>
          )}

          {authConfig.isError && (
            <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-2.5 text-sm text-danger">
              Konfigurasi keamanan gagal dimuat. Muat ulang halaman.
            </div>
          )}

          {loginMutation.isError && (
            <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-2.5 text-sm text-danger">
              {getAuthErrorMessage(loginMutation.error)}
            </div>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-solid px-4 py-3.5 font-semibold text-onaccent shadow-lg shadow-accent-glow transition-[background-color,box-shadow,transform,opacity] duration-200 hover:bg-accent-hover hover:shadow-accent-glow active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100"
          >
            {loginMutation.isPending && <LoaderCircle className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />}
            <span>{loginMutation.isPending ? "Memeriksa akun..." : "Masuk ke Sistem"}</span>
            {!loginMutation.isPending && <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>
        </form>

        <footer className="mt-8 text-center text-[11px] text-ink-4">
          &copy; {new Date().getFullYear()} Sistem Peminjaman Ruang Rapat &amp; Kendaraan
        </footer>
      </section>
    </main>
  );
}
