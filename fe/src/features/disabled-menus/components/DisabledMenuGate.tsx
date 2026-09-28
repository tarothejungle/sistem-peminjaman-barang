import { Outlet, useLocation } from "react-router-dom";
import { menuKeyForPath, useDisabledMenus } from "../api/useDisabledMenus";

export function DisabledMenuGate() {
  const location = useLocation();
  const settings = useDisabledMenus();
  const menuKey = menuKeyForPath(location.pathname);

  if (settings.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-raised-soft" aria-label="Memuat pengaturan menu" />;
  if (settings.isError) return <div role="alert" className="rounded-2xl border border-danger-line bg-danger-soft p-5 text-sm text-danger">Status menu gagal dimuat. Muat ulang halaman.</div>;
  if (menuKey && settings.data?.disabledMenuKeys.includes(menuKey)) return <div role="status" className="rounded-2xl border border-line bg-panel p-6 text-center font-semibold text-ink">Menu Sedang Dalam Pengembangan</div>;

  return <Outlet />;
}
