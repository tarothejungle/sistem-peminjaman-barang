import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, KeyRound, LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useResetPasswordMutation, verifyResetToken } from "../api/useAuthMutations";
import { AuthCard, authInputClass, authSubmitClass } from "../components/AuthCard";
import { getAuthErrorMessage } from "./auth.utils";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Password minimal 12 karakter")
      .max(72, "Password maksimal 72 karakter"),
    passwordConfirmation: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Konfirmasi password tidak sama",
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token] = useState(() => {
    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

    return params.get("token") ?? "";
  });
  const resetPassword = useResetPasswordMutation();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) return;

    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [token]);

  const tokenCheck = useQuery({
    queryKey: ["auth", "reset-token"],
    queryFn: () => verifyResetToken(token),
    enabled: token.length > 0,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", passwordConfirmation: "" },
  });

  useEffect(() => {
    if (!resetPassword.isSuccess) return;
    const timer = window.setTimeout(() => {
      navigate("/login", { replace: true, state: { passwordResetSuccess: true } });
    }, 2_000);
    return () => window.clearTimeout(timer);
  }, [navigate, resetPassword.isSuccess]);

  const submit = handleSubmit(async (form) => {
    try {
      await resetPassword.mutateAsync({
        token,
        password: form.password,
        password_confirmation: form.passwordConfirmation,
      });
    } catch {
      // Mutation state renders the API error.
    }
  });

  const backToLogin = (
    <Link
      to="/login"
      className="inline-flex items-center gap-2 font-medium text-accent transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Kembali ke halaman login
    </Link>
  );

  const requestNewLink = (
    <Link
      to="/forgot-password"
      className="inline-flex items-center gap-2 font-medium text-accent transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
    >
      Minta tautan reset baru
    </Link>
  );

  if (token === "" || tokenCheck.data === false) {
    return (
      <AuthCard
        title="Tautan Tidak Valid"
        subtitle="Tautan reset password sudah kedaluwarsa, sudah digunakan, atau tidak lengkap."
        footer={
          <span className="flex flex-col items-center gap-3">
            {requestNewLink}
            {backToLogin}
          </span>
        }
      >
        <div role="alert" className="rounded-xl border border-warn-line bg-warn-soft p-5 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-warn" aria-hidden="true" />
          <p className="mt-4 text-sm leading-6 text-warn">
            Setiap tautan reset hanya berlaku 60 menit dan dapat digunakan satu kali. Silakan ajukan permintaan baru.
          </p>
        </div>
      </AuthCard>
    );
  }

  if (tokenCheck.isLoading) {
    return (
      <AuthCard title="Memeriksa Tautan" subtitle="Mohon tunggu, kami sedang memverifikasi tautan reset password Anda.">
        <div className="flex items-center justify-center gap-3 rounded-xl border border-line bg-inset-soft p-6 text-sm text-ink-3">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Memverifikasi tautan...
        </div>
      </AuthCard>
    );
  }

  if (tokenCheck.isError) {
    return (
      <AuthCard
        title="Verifikasi Gagal"
        subtitle="Tautan tidak dapat diverifikasi saat ini."
        footer={
          <span className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => tokenCheck.refetch()}
              className="font-medium text-accent transition-colors hover:text-accent"
            >
              Coba verifikasi lagi
            </button>
            {backToLogin}
          </span>
        }
      >
        <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {getAuthErrorMessage(tokenCheck.error)}
        </div>
      </AuthCard>
    );
  }

  if (resetPassword.isSuccess) {
    return (
      <AuthCard title="Password Diperbarui" subtitle="Semua sesi login lama telah diakhiri untuk keamanan akun Anda." footer={backToLogin}>
        <div role="status" className="rounded-xl border border-ok-line bg-ok-soft p-5 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-ok" aria-hidden="true" />
          <p className="mt-4 text-sm leading-6 text-ok">{resetPassword.data}</p>
          <p className="mt-2 text-xs text-ok">Anda akan diarahkan ke halaman login...</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Buat Password Baru"
      subtitle="Masukkan password baru untuk akun Anda. Minimal 12 karakter."
      footer={backToLogin}
    >
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate aria-busy={resetPassword.isPending}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink-2">
            Password baru
          </label>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-4"
              aria-hidden="true"
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={`${authInputClass} pr-14`}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              placeholder="Minimal 12 karakter"
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="passwordConfirmation" className="text-sm font-medium text-ink-2">
            Ulangi password baru
          </label>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-4"
              aria-hidden="true"
            />
            <input
              id="passwordConfirmation"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={authInputClass}
              aria-invalid={Boolean(errors.passwordConfirmation)}
              aria-describedby={errors.passwordConfirmation ? "password-confirmation-error" : undefined}
              placeholder="Ulangi password baru"
              {...register("passwordConfirmation")}
            />
          </div>
          {errors.passwordConfirmation && (
            <p id="password-confirmation-error" className="text-xs text-danger" role="alert">
              {errors.passwordConfirmation.message}
            </p>
          )}
        </div>

        {resetPassword.isError && (
          <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-2.5 text-sm text-danger">
            {getAuthErrorMessage(resetPassword.error)}
          </div>
        )}

        <button type="submit" disabled={resetPassword.isPending} className={authSubmitClass}>
          {resetPassword.isPending && <LoaderCircle className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />}
          <span>{resetPassword.isPending ? "Menyimpan password..." : "Simpan Password Baru"}</span>
        </button>
      </form>
    </AuthCard>
  );
}
