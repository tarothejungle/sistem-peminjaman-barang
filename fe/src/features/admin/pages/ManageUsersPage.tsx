import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuthStore } from "../../../store/authStore";
import { Role, type User } from "../../../types";
import { getRoleLabel } from "../../../utils/roleLabel";
import {
  type ManagedUserInput,
  type ManagedUserResource,
  useCreateManagedUser,
  useDeleteManagedUser,
  useManagedUsers,
  useUpdateManagedUser,
} from "../../users/api/useManagedUsers";
import { getAdminErrorMessage } from "./adminPage.utils";
import { AdminHeader, EmptyState, inputClass, LoadError, TableSkeleton } from "./ManageRoomsPage";
import { SuccessToast } from "../../../components/common/SuccessToast";

interface ManagedUsersPageProps {
  resource: ManagedUserResource;
  singularLabel: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Renders a role picker and a role column; only the administrator screen uses it. */
  roleOptions?: readonly AdministratorRole[];
}

/** Roles the "Data Kabag & Kasubag" screen is allowed to assign. */
type AdministratorRole = typeof Role.KABAG_UMUM | typeof Role.KASUBAG_UMUM;

interface UserForm {
  fullName: string;
  username: string;
  email: string;
  /** Only present while registering a new account. */
  password?: string;
  role?: AdministratorRole;
}

const usernamePattern = /^[A-Za-z0-9._-]+$/;

export function ManageRoomManagersPage() {
  return <ManagedUsersPage resource="room-managers" singularLabel="PJ Ruangan" title="Data PJ Ruangan" description="Kelola akun petugas penanggung jawab ruangan." icon={<UserCog size={23} />} />;
}

export function ManageDepartmentHeadsPage() {
  return (
    <ManagedUsersPage
      resource="department-heads"
      singularLabel="Kabag/Kasubag"
      title="Data Kabag & Kasubag"
      description="Kelola akun KABAG UMUM dan KASUBAG UMUM yang memiliki akses administrasi sistem."
      icon={<ShieldCheck size={23} />}
      roleOptions={[Role.KABAG_UMUM, Role.KASUBAG_UMUM]}
    />
  );
}

export function ManageUsersPage() {
  return <ManagedUsersPage resource="users" singularLabel="User" title="Data User" description="Kelola akun user yang mengajukan peminjaman." icon={<Users size={23} />} />;
}

function ManagedUsersPage({ resource, singularLabel, title, description, icon, roleOptions }: ManagedUsersPageProps) {
  const currentUser = useAuthStore((state) => state.user);
  const usersQuery = useManagedUsers(resource);
  const deleteUser = useDeleteManagedUser(resource);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const canModifyUser = (user: User) => !(resource === "department-heads" && user.role === Role.KABAG_UMUM && currentUser?.id !== user.id);
  const availableRoleOptions = roleOptions && currentUser?.role === Role.KASUBAG_UMUM && usersQuery.data?.some((user) => user.role === Role.KABAG_UMUM)
    ? roleOptions.filter((role) => role !== Role.KABAG_UMUM)
    : roleOptions;

  const handleDelete = async () => {
    if (!confirmUser) return;
    try {
      await deleteUser.mutateAsync(confirmUser.id);
      setFeedback(`${singularLabel} berhasil dihapus.`);
      setConfirmUser(null);
    } catch {
      // Mutation error renders in confirmation dialog.
    }
  };

  return <div className="space-y-6">
    <AdminHeader icon={icon} title={title} description={description} addLabel={`Tambah ${singularLabel}`} onAdd={() => { setEditingUser(null); setShowForm(true); }} />
    {usersQuery.isLoading && <TableSkeleton />}
    {usersQuery.isError && <LoadError onRetry={() => usersQuery.refetch()} />}
    {usersQuery.data?.length === 0 && <EmptyState label={`Belum ada data ${singularLabel}`} />}
    {usersQuery.data && usersQuery.data.length > 0 && <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-line bg-inset-soft text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Username</th><th className="px-5 py-4">Email</th>{roleOptions && <th className="px-5 py-4">Role</th>}<th className="px-5 py-4">Dibuat</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-line">{usersQuery.data.map((user) => <tr key={user.id} className="hover:bg-hover"><td className="px-5 py-4 font-bold text-ink">{user.fullName}</td><td className="px-5 py-4 font-mono text-xs text-accent">{user.username}</td><td className="px-5 py-4 text-ink-3">{user.email}</td>{roleOptions && <td className="px-5 py-4"><span className="inline-flex rounded-lg border border-accent-line bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">{getRoleLabel(user.role)}</span></td>}<td className="px-5 py-4 text-ink-4">{user.createdAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(user.createdAt)) : "-"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{canModifyUser(user) ? <><button type="button" onClick={() => { setEditingUser(user); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-2 transition hover:bg-hover hover:text-ink"><Pencil size={14} /> Edit</button><button type="button" onClick={() => { deleteUser.reset(); setConfirmUser(user); }} className="inline-flex items-center gap-1.5 rounded-lg bg-danger-solid px-3 py-2 text-xs font-bold text-onaccent transition hover:bg-danger-hover"><Trash2 size={14} /> Hapus</button></> : <span className="text-xs font-semibold text-ink-4">Dikelola oleh Kabag</span>}</div></td></tr>)}</tbody></table></div></div>}
    {showForm && <UserFormModal key={editingUser?.id ?? "create"} resource={resource} singularLabel={singularLabel} user={editingUser} roleOptions={availableRoleOptions} onClose={() => setShowForm(false)} onSaved={(message) => { setShowForm(false); setFeedback(message); }} />}
    {confirmUser && <div className="fixed inset-0 z-[70] grid place-items-center bg-overlay px-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-line bg-panel-strong p-5 shadow-2xl shadow-shade backdrop-blur-xl"><h2 className="font-bold text-ink">Hapus {singularLabel}?</h2><p className="mt-2 text-sm text-ink-3">Akun {confirmUser.fullName} akan kehilangan akses. User dengan riwayat peminjaman tidak dapat dihapus.</p>{deleteUser.error && <p className="mt-3 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(deleteUser.error)}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setConfirmUser(null)} disabled={deleteUser.isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="button" onClick={handleDelete} disabled={deleteUser.isPending} className="rounded-lg bg-danger-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-danger-hover">{deleteUser.isPending ? "Menghapus..." : "Hapus"}</button></div></div></div>}
    {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
  </div>;
}

function UserFormModal({ resource, singularLabel, user, roleOptions, onClose, onSaved }: { resource: ManagedUserResource; singularLabel: string; user: User | null; roleOptions?: readonly AdministratorRole[]; onClose: () => void; onSaved: (message: string) => void }) {
  const isEditing = user !== null;
  const schema = z.object({
    fullName: z.string().trim().min(1, "Nama lengkap wajib diisi").max(100),
    username: z
      .string()
      .trim()
      .min(3, "Username minimal 3 karakter")
      .max(50, "Username maksimal 50 karakter")
      .regex(usernamePattern, "Username hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung"),
    email: z.string().trim().email("Format email tidak valid").max(255),
    password: isEditing
      ? z.string().max(72, "Password maksimal 72 karakter").optional()
      : z.string().min(12, "Password minimal 12 karakter").max(72, "Password maksimal 72 karakter"),
    role: z.enum([Role.KABAG_UMUM, Role.KASUBAG_UMUM]).optional(),
  });
  const createUser = useCreateManagedUser(resource);
  const updateUser = useUpdateManagedUser(resource);
  const mutation = user ? updateUser : createUser;
  const { register, handleSubmit, formState: { errors } } = useForm<UserForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      username: user?.username ?? "",
      email: user?.email ?? "",
      password: isEditing ? undefined : "",
      role: roleOptions ? ((user?.role as AdministratorRole | undefined) ?? roleOptions[0]) : undefined,
    },
  });
  const submit = handleSubmit(async (form) => {
    const input: ManagedUserInput = { fullName: form.fullName, username: form.username.toLowerCase(), email: form.email };
    if (!isEditing && form.password) input.password = form.password;
    if (roleOptions && form.role) input.role = form.role;
    try {
      if (user) await updateUser.mutateAsync({ userId: user.id, ...input });
      else await createUser.mutateAsync(input);
      onSaved(user ? `${singularLabel} berhasil diperbarui.` : `${singularLabel} berhasil ditambahkan.`);
    } catch {
      // Mutation error renders in modal.
    }
  });
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-overlay px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl"><div className="flex items-center border-b border-line p-5"><h2 className="flex-1 text-lg font-bold text-ink">{user ? `Edit ${singularLabel}` : `Tambah ${singularLabel}`}</h2><button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Tutup modal" className="text-ink-3 transition hover:text-ink">&times;</button></div><form onSubmit={submit} className="space-y-4 p-5"><label className="block text-sm font-semibold text-ink-2">Nama lengkap<input className={inputClass} autoComplete="name" {...register("fullName")} />{errors.fullName && <span className="mt-1 block font-normal text-danger">{errors.fullName.message}</span>}</label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-ink-2">Username<span className="ml-2 text-xs font-normal text-ink-4">Dipakai untuk login</span><input className={inputClass} autoComplete="username" autoCapitalize="none" spellCheck={false} {...register("username")} />{errors.username && <span className="mt-1 block font-normal text-danger">{errors.username.message}</span>}</label><label className="block text-sm font-semibold text-ink-2">Email<span className="ml-2 text-xs font-normal text-ink-4">Untuk reset password</span><input type="email" className={inputClass} autoComplete="email" {...register("email")} />{errors.email && <span className="mt-1 block font-normal text-danger">{errors.email.message}</span>}</label></div>{roleOptions && <label className="block text-sm font-semibold text-ink-2">Role<select className={inputClass} {...register("role")}>{roleOptions.map((option) => <option key={option} value={option} className="bg-surface-strong">{getRoleLabel(option)}</option>)}</select>{errors.role && <span className="mt-1 block font-normal text-danger">{errors.role.message}</span>}</label>}{/* Password is only set during registration; an edit never rotates credentials. */}{!isEditing && <label className="block text-sm font-semibold text-ink-2">Password<input type="password" className={inputClass} autoComplete="new-password" {...register("password")} />{errors.password && <span className="mt-1 block font-normal text-danger">{errors.password.message}</span>}</label>}{mutation.error && <div className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(mutation.error)}</div>}<div className="flex justify-end gap-3 border-t border-line pt-4"><button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button><button type="submit" disabled={mutation.isPending} className="rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50">{mutation.isPending ? "Menyimpan..." : "Simpan"}</button></div></form></div></div>;
}
