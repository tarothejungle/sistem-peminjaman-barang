import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle, Mail, MailCheck, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useForgotPasswordMutation } from "../api/useAuthMutations";
import { AuthCard, authInputClass, authSubmitClass } from "../components/AuthCard";
import { getAuthErrorMessage } from "./auth.utils";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Masukkan alamat email yang valid").max(255),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const submit = handleSubmit(async (form) => {
    try {
      await forgotPassword.mutateAsync(form.email);
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

  if (forgotPassword.isSuccess) {
    return (
      <AuthCard
        title="Periksa Email Anda"
        subtitle="Tautan reset password telah dikirim jika email tersebut terdaftar di sistem."
        footer={backToLogin}
        showThemeSwitcher={false}
      >
        <div role="status" className="rounded-xl border border-ok-line bg-ok-soft p-5 text-center">
          <MailCheck className="mx-auto h-9 w-9 text-ok" aria-hidden="true" />
          <p className="mt-4 text-sm leading-6 text-ok">{forgotPassword.data}</p>
        </div>
        <p className="mt-5 text-xs leading-6 text-ink-4">
          Tautan hanya berlaku selama 60 menit dan dapat digunakan satu kali. Jika email tidak muncul, periksa folder
          spam atau hubungi KABAG UMUM.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Lupa Password"
      subtitle="Masukkan email yang terdaftar pada akun Anda. Kami akan mengirimkan tautan untuk membuat password baru."
      footer={backToLogin}
      showThemeSwitcher={false}
    >
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate aria-busy={forgotPassword.isPending}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-ink-2">
            Email terdaftar
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-4"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className={authInputClass}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              placeholder="nama@instansi.go.id"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p id="email-error" className="text-xs text-danger" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {forgotPassword.isError && (
          <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-2.5 text-sm text-danger">
            {getAuthErrorMessage(forgotPassword.error)}
          </div>
        )}

        <button type="submit" disabled={forgotPassword.isPending} className={authSubmitClass}>
          {forgotPassword.isPending ? (
            <LoaderCircle className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
          <span>{forgotPassword.isPending ? "Mengirim tautan..." : "Kirim Tautan Reset"}</span>
        </button>
      </form>
    </AuthCard>
  );
}
