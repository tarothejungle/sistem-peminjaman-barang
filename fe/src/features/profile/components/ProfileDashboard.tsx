import { AtSign, Camera, Gauge, Mail, Phone, Save, Trash2, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { ResourceImage } from "../../../components/common/ResourceImage";
import { apiErrorMessage } from "../../../lib/apiError";
import { PHONE_PATTERN } from "../../../lib/validation";
import { useAuthStore } from "../../../store/authStore";
import { Role, isAdministratorRole } from "../../../types";
import { getRoleLabel } from "../../../utils/roleLabel";
import { useDeleteProfilePhoto, useUpdateProfile, useUploadProfilePhoto } from "../api/useProfile";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileDashboard() {
  const user = useAuthStore((state) => state.user);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const update = useUpdateProfile();
  const upload = useUploadProfilePhoto();
  const remove = useDeleteProfilePhoto();
  const isPhotoPending = upload.isPending || remove.isPending;
  const fullNameError = fullName.trim().length < 3 ? "Nama lengkap minimal 3 karakter." : null;
  const emailError = !emailPattern.test(email.trim()) ? "Format email tidak valid." : null;
  const phoneError = !PHONE_PATTERN.test(phoneNumber.trim()) ? "Format nomor telepon tidak valid." : null;

  if (!user) return null;

  const canEditIdentity = isAdministratorRole(user.role);
  const unchanged = (!canEditIdentity || (fullName.trim() === user.fullName && email.trim().toLowerCase() === user.email.toLowerCase())) && phoneNumber.trim() === (user.phoneNumber ?? "");

  const saveProfile = async () => {
    if ((canEditIdentity && (fullNameError || emailError)) || phoneError) return;
    try {
      await update.mutateAsync({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phoneNumber: phoneNumber.trim() });
      setFeedback("Data diri berhasil diperbarui.");
    } catch {
      setFeedback(null);
    }
  };

  const selectPhoto = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setFeedback("Foto harus berupa JPEG, PNG, atau WebP dengan ukuran maksimal 2 MB.");
      return;
    }
    try {
      await upload.mutateAsync(file);
      setFeedback("Foto profil berhasil diperbarui.");
    } catch {
      setFeedback(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deletePhoto = async () => {
    try {
      await remove.mutateAsync();
      setFeedback("Foto profil berhasil dihapus.");
    } catch {
      setFeedback(null);
    }
  };

  const requestError = update.error ?? upload.error ?? remove.error;
  const serverError = apiErrorMessage(requestError);

  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.8fr)]">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-panel p-6 shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-accent-soft to-transparent" />
        <div className="relative flex h-full flex-col items-center text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-accent">Foto profil</p>
          <div className="relative mt-8 size-40 overflow-hidden rounded-full border-4 border-line bg-surface shadow-[0_0_0_1px_var(--line),0_24px_70px_var(--shade)]">
            <ResourceImage key={`${user.profileImageUrl}-${user.updatedAt}`} url={user.profileImageUrl} alt={`Foto profil ${user.fullName}`} className="size-full object-cover" fallback={<div className="grid size-full place-items-center bg-gradient-to-br from-accent-soft to-surface text-accent"><UserRound size={62} strokeWidth={1.4} /></div>} />
          </div>
          <h2 className="mt-5 text-xl font-black text-ink">{user.fullName}</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-ink-4">{getRoleLabel(user.role)}</p>
          {user.role === Role.PEMOHON && <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-3.5 py-1.5 text-accent"><Gauge size={15} aria-hidden="true" /><span className="text-[11px] font-bold uppercase tracking-wide">Skor kredibilitas kendaraan</span><span className="text-sm font-black">{user.creditScore ?? "-"}</span></div>}
          <div className="mt-auto grid w-full gap-3 pt-8">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectPhoto(event.target.files?.[0])} />
            <button type="button" disabled={isPhotoPending} onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-solid px-4 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50"><Camera size={17} />{upload.isPending ? "Mengunggah..." : "Upload Foto"}</button>
            <button type="button" disabled={isPhotoPending || !user.profileImageUrl} onClick={deletePhoto} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-danger-line bg-danger-soft px-4 text-sm font-bold text-danger transition hover:bg-danger-soft disabled:opacity-40"><Trash2 size={17} />{remove.isPending ? "Menghapus..." : "Hapus Foto"}</button>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-line bg-panel p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-accent-soft blur-[100px]" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-accent">Identitas akun</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">Ubah Data Diri</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-3">Perbarui nama lengkap, email, nomor telepon, dan foto profil akun Anda.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {canEditIdentity ? <ProfileField id="profile-full-name" icon={UserRound} label="Nama Lengkap" value={fullName} onChange={setFullName} error={fullNameError} autoComplete="name" /> : <IdentityField icon={UserRound} label="Nama Lengkap" value={user.fullName} />}
            <IdentityField icon={AtSign} label="Username" value={`@${user.username}`} />
            {canEditIdentity ? <ProfileField id="profile-email" icon={Mail} label="Email" value={email} onChange={setEmail} error={emailError} type="email" autoComplete="email" /> : <IdentityField icon={Mail} label="Email" value={user.email} />}
            <ProfileField id="profile-phone" icon={Phone} label="No. Telepon" value={phoneNumber} onChange={setPhoneNumber} error={phoneError} type="tel" autoComplete="tel" />
          </div>

          <div className="mt-6 flex justify-end">
            <button type="button" disabled={update.isPending || Boolean((canEditIdentity && (fullNameError || emailError)) || phoneError) || unchanged} onClick={saveProfile} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-solid px-5 text-sm font-bold text-onaccent transition hover:bg-accent-hover disabled:opacity-40"><Save size={16} />{update.isPending ? "Menyimpan..." : "Simpan Perubahan"}</button>
          </div>

          {(feedback || serverError) && <div role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${serverError ? "border-danger-line bg-danger-soft text-danger" : "border-ok-line bg-ok-soft text-ok"}`}>{serverError ?? feedback}</div>}
        </div>
      </section>
    </div>
  );
}

interface ProfileFieldProps {
  id: string;
  icon: typeof UserRound;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  type?: "text" | "email" | "tel";
  autoComplete: string;
}

function ProfileField({ id, icon: Icon, label, value, onChange, error, type = "text", autoComplete }: ProfileFieldProps) {
  return (
    <div className="rounded-2xl border border-line bg-inset-soft p-4">
      <label htmlFor={id} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-ink-4"><Icon size={15} className="text-accent" />{label}</label>
      <input id={id} type={type} inputMode={type === "tel" ? "tel" : undefined} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="mt-3 min-h-11 w-full rounded-xl border border-line bg-overlay px-4 text-sm font-semibold text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-ring" />
      {error && <p id={`${id}-error`} className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

function IdentityField({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-inset-soft p-4"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-ink-4"><Icon size={15} className="text-accent" />{label}</div><p className="mt-3 break-words text-sm font-bold text-ink sm:text-base">{value}</p></div>;
}
