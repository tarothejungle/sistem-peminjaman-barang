import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiErrorMessage } from "../../../lib/apiError";
import { useChangePasswordMutation } from "../api/useAuthMutations";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi").max(72),
  newPassword: z.string().min(12, "Password baru minimal 12 karakter").max(72),
  confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi").max(72),
}).refine(({ currentPassword, newPassword }) => currentPassword !== newPassword, {
  message: "Password baru harus berbeda dari password saat ini",
  path: ["newPassword"],
}).refine(({ newPassword, confirmPassword }) => newPassword === confirmPassword, {
  message: "Konfirmasi password tidak sesuai",
  path: ["confirmPassword"],
});

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ChangePasswordModal({ onClose, onSuccess }: ChangePasswordModalProps) {
  const mutation = useChangePasswordMutation();
  const { register, handleSubmit, formState: { errors } } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const submit = handleSubmit(async ({ currentPassword, newPassword, confirmPassword }) => {
    try {
      const message = await mutation.mutateAsync({
        currentPassword,
        newPassword,
        newPassword_confirmation: confirmPassword,
      });
      onSuccess(message);
      onClose();
    } catch {
      // Mutation error renders inside modal.
    }
  });

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-overlay px-4 py-6 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="w-full max-w-md rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><KeyRound size={20} /></div>
          <div className="flex-1"><h2 id="change-password-title" className="font-bold text-ink">Ganti password</h2><p className="mt-1 text-sm text-ink-3">Gunakan password baru minimal 12 karakter.</p></div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Tutup modal"><X size={19} className="text-ink-3 transition hover:text-ink" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <PasswordField label="Password saat ini" error={errors.currentPassword?.message} register={register("currentPassword")} />
          <PasswordField label="Password baru" error={errors.newPassword?.message} register={register("newPassword")} />
          <PasswordField label="Konfirmasi password baru" error={errors.confirmPassword?.message} register={register("confirmPassword")} />
          {mutation.isError && <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{getErrorMessage(mutation.error)}</div>}
          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button>
            <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50">{mutation.isPending ? "Menyimpan..." : "Simpan password"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordField({ label, error, register }: { label: string; error?: string; register: ReturnType<ReturnType<typeof useForm<ChangePasswordForm>>["register"]> }) {
  return <label className="block text-sm font-semibold text-ink-2">{label}<input type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring" {...register} />{error && <span className="mt-1.5 block text-sm font-normal text-danger">{error}</span>}</label>;
}

function getErrorMessage(error: unknown): string {
  return apiErrorMessage(error) ?? "Password gagal diubah.";
}
