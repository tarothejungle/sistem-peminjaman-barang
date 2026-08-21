import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { User } from "../../../types";
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
}

interface UserForm {
  fullName: string;
  email: string;
  password: string;
}

export function ManageRoomManagersPage() {
  return <ManagedUsersPage resource="room-managers" singularLabel="PJ Ruangan" title="Data PJ Ruangan" description="Kelola akun petugas penanggung jawab ruangan." icon={<UserCog size={23} />} />;
}

export function ManageDepartmentHeadsPage() {
  return <ManagedUsersPage resource="department-heads" singularLabel="Kabag" title="Data Kabag" description="Kelola akun KABAG UMUM yang memiliki akses administrasi sistem." icon={<ShieldCheck size={23} />} />;
}

export function ManageUsersPage() {
  return <ManagedUsersPage resource="users" singularLabel="User" title="Data User" description="Kelola akun user yang mengajukan peminjaman." icon={<Users size={23} />} />;
}

function ManagedUsersPage({ resource, singularLabel, title, description, icon }: ManagedUsersPageProps) {
  const usersQuery = useManagedUsers(resource);
  const deleteUser = useDeleteManagedUser(resource);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

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
    {usersQuery.data && usersQuery.data.length > 0 && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Dibuat</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{usersQuery.data.map((user) => <tr key={user.id} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-bold text-slate-900">{user.fullName}</td><td className="px-5 py-4 text-slate-600">{user.email}</td><td className="px-5 py-4 text-slate-500">{user.createdAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(user.createdAt)) : "-"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditingUser(user); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Edit</button><button type="button" onClick={() => { deleteUser.reset(); setConfirmUser(user); }} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"><Trash2 size={14} /> Hapus</button></div></td></tr>)}</tbody></table></div></div>}
    {showForm && <UserFormModal key={editingUser?.id ?? "create"} resource={resource} singularLabel={singularLabel} user={editingUser} onClose={() => setShowForm(false)} onSaved={(message) => { setShowForm(false); setFeedback(message); }} />}
    {confirmUser && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 px-4"><div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h2 className="font-bold text-slate-900">Hapus {singularLabel}?</h2><p className="mt-2 text-sm text-slate-500">Akun {confirmUser.fullName} akan kehilangan akses. User dengan riwayat peminjaman tidak dapat dihapus.</p>{deleteUser.error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{getAdminErrorMessage(deleteUser.error)}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setConfirmUser(null)} disabled={deleteUser.isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Batal</button><button type="button" onClick={handleDelete} disabled={deleteUser.isPending} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white">{deleteUser.isPending ? "Menghapus..." : "Hapus"}</button></div></div></div>}
    {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
  </div>;
}

function UserFormModal({ resource, singularLabel, user, onClose, onSaved }: { resource: ManagedUserResource; singularLabel: string; user: User | null; onClose: () => void; onSaved: (message: string) => void }) {
  const schema = z.object({
    fullName: z.string().trim().min(1, "Nama lengkap wajib diisi").max(100),
    email: z.string().trim().email("Format email tidak valid").max(255),
    password: user
      ? z.union([z.literal(""), z.string().min(8, "Password minimal 8 karakter").max(72, "Password maksimal 72 karakter")])
      : z.string().min(8, "Password minimal 8 karakter").max(72, "Password maksimal 72 karakter"),
  });
  const createUser = useCreateManagedUser(resource);
  const updateUser = useUpdateManagedUser(resource);
  const mutation = user ? updateUser : createUser;
  const { register, handleSubmit, formState: { errors } } = useForm<UserForm>({ resolver: zodResolver(schema), defaultValues: { fullName: user?.fullName ?? "", email: user?.email ?? "", password: "" } });
  const submit = handleSubmit(async (form) => {
    const input: ManagedUserInput = { fullName: form.fullName, email: form.email };
    if (form.password) input.password = form.password;
    try {
      if (user) await updateUser.mutateAsync({ userId: user.id, ...input });
      else await createUser.mutateAsync(input);
      onSaved(user ? `${singularLabel} berhasil diperbarui.` : `${singularLabel} berhasil ditambahkan.`);
    } catch {
      // Mutation error renders in modal.
    }
  });
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-center border-b border-slate-200 p-5"><h2 className="flex-1 text-lg font-bold">{user ? `Edit ${singularLabel}` : `Tambah ${singularLabel}`}</h2><button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Tutup modal">×</button></div><form onSubmit={submit} className="space-y-4 p-5"><label className="block text-sm font-semibold">Nama lengkap<input className={inputClass} autoComplete="name" {...register("fullName")} />{errors.fullName && <span className="mt-1 block font-normal text-rose-600">{errors.fullName.message}</span>}</label><label className="block text-sm font-semibold">Email<input type="email" className={inputClass} autoComplete="email" {...register("email")} />{errors.email && <span className="mt-1 block font-normal text-rose-600">{errors.email.message}</span>}</label><label className="block text-sm font-semibold">Password{user && <span className="ml-2 text-xs font-normal text-slate-400">Kosongkan jika tidak diubah</span>}<input type="password" className={inputClass} autoComplete="new-password" {...register("password")} />{errors.password && <span className="mt-1 block font-normal text-rose-600">{errors.password.message}</span>}</label>{mutation.error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{getAdminErrorMessage(mutation.error)}</div>}<div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Batal</button><button type="submit" disabled={mutation.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{mutation.isPending ? "Menyimpan..." : "Simpan"}</button></div></form></div></div>;
}
