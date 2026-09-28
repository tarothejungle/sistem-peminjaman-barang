import { Ban, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { SuccessToast } from "../../../components/common/SuccessToast";
import { MENU_OPTIONS, useDisabledMenus, useUpdateDisabledMenus, type MenuKey } from "../../disabled-menus/api/useDisabledMenus";
import { getAdminErrorMessage } from "./adminPage.utils";
import { TableSkeleton } from "./ManageRoomsPage";

export function ManageDisabledMenusPage() {
  const settings = useDisabledMenus();
  const update = useUpdateDisabledMenus();
  const [selected, setSelected] = useState<MenuKey[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setSelected(settings.data.disabledMenuKeys);
  }, [settings.data]);

  const toggle = (key: MenuKey, disabled: boolean) => {
    setSelected((current) => disabled ? [...current, key] : current.filter((item) => item !== key));
  };

  const save = async () => {
    try {
      const result = await update.mutateAsync(selected);
      setSelected(result.disabledMenuKeys);
      setFeedback("Pengaturan menu berhasil disimpan.");
    } catch {
      return;
    }
  };

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-7 text-ink shadow-2xl backdrop-blur-xl sm:px-8">
      <div className="relative flex items-start gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-solid text-onaccent shadow-lg shadow-accent-glow"><Ban size={22} /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Pengaturan Sistem</p>
          <h2 className="mt-1 text-2xl font-bold">Disable Menu</h2>
          <p className="mt-1 text-sm text-ink-3">Menu yang dinonaktifkan tetap terlihat. Saat dibuka, halaman menampilkan pesan pengembangan. Dashboard dan halaman ini selalu tersedia.</p>
        </div>
      </div>
    </section>

    {settings.isLoading && <TableSkeleton />}
    {settings.isError && <p className="rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger">Pengaturan menu gagal dimuat. Muat ulang halaman.</p>}

    {settings.data && <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl">
      <div className="divide-y divide-line">
        {MENU_OPTIONS.map((menu) => {
          const disabled = selected.includes(menu.key);
          return <label key={menu.key} className="flex cursor-pointer items-center justify-between gap-4 p-5 transition hover:bg-hover">
            <span><span className="block text-sm font-bold text-ink">{menu.label}</span><span className="mt-1 block text-xs text-ink-3">{menu.path}</span></span>
            <span className="flex items-center gap-3 text-sm font-semibold text-ink-2"><span>{disabled ? "Nonaktif" : "Aktif"}</span><input type="checkbox" checked={disabled} onChange={(event) => toggle(menu.key, event.target.checked)} className="size-4" /></span>
          </label>;
        })}
      </div>
      <div className="flex justify-end border-t border-line p-5"><button type="button" onClick={save} disabled={update.isPending} className="inline-flex items-center gap-2 rounded-xl bg-accent-solid px-5 py-2.5 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover disabled:opacity-50"><Save size={17} />{update.isPending ? "Menyimpan..." : "Simpan pengaturan"}</button></div>
    </section>}

    {update.error && <p className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{getAdminErrorMessage(update.error)}</p>}
    {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
  </div>;
}
