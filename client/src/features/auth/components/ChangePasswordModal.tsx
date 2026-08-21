import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { KeyRound, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useChangePasswordMutation } from "../api/useAuthMutations";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi").max(72),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter").max(72),
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
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-700"><KeyRound size={20} /></div>
          <div className="flex-1"><h2 id="change-password-title" className="font-bold text-slate-900">Ganti password</h2><p className="mt-1 text-sm text-slate-500">Gunakan password baru minimal 8 karakter.</p></div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Tutup modal"><X size={19} className="text-slate-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <PasswordField label="Password saat ini" error={errors.currentPassword?.message} register={register("currentPassword")} />
          <PasswordField label="Password baru" error={errors.newPassword?.message} register={register("newPassword")} />
          <PasswordField label="Konfirmasi password baru" error={errors.confirmPassword?.message} register={register("confirmPassword")} />
          {mutation.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{getErrorMessage(mutation.error)}</div>}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Batal</button>
            <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{mutation.isPending ? "Menyimpan..." : "Simpan password"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordField({ label, error, register }: { label: string; error?: string; register: ReturnType<ReturnType<typeof useForm<ChangePasswordForm>>["register"]> }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<input type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" {...register} />{error && <span className="mt-1.5 block text-sm font-normal text-rose-600">{error}</span>}</label>;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) return error.response?.data.error?.message ?? "Password gagal diubah.";
  return "Password gagal diubah.";
}
