import {
  Archive,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  X,
  KeyRound,
  UserCog,
  ShieldCheck,
  Users,
  Clock3,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChangePasswordModal } from "../../features/auth/components/ChangePasswordModal";
import { BrandLogo } from "../common/BrandLogo";
import { useAuthStore } from "../../store/authStore";
import { Role } from "../../types";
import { getRoleLabel } from "../../utils/roleLabel";
import { usePendingBookingCount } from "../../features/bookings/api/useBookings";
import { SuccessToast } from "../common/SuccessToast";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Status Peminjaman", to: "/my-bookings", icon: Archive },
] as const;

const adminNavigation = [
  { label: "Persetujuan", to: "/admin/approvals", icon: ClipboardCheck },
] as const;

const masterDataNavigation = [
  { label: "Data Kabag", to: "/admin/department-heads", icon: ShieldCheck },
  { label: "Data PJ Ruangan", to: "/admin/room-managers", icon: UserCog },
  { label: "Data User", to: "/admin/users", icon: Users },
  { label: "Pengaturan Jam Ruangan", to: "/admin/room-booking-settings", icon: Clock3 },
  { label: "Kelola Ruangan", to: "/admin/rooms", icon: PanelsTopLeft },
  { label: "Kelola Barang", to: "/admin/items", icon: Boxes },
] as const;

function getPageTitle(pathname: string): string {
  const item = [...navigation, ...adminNavigation, ...masterDataNavigation].find(({ to }) => pathname.startsWith(to));
  return item?.label ?? "Sistem Peminjaman";
}

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(() => {
    const state = location.state as { loginSuccess?: boolean } | null;
    return state?.loginSuccess ? "Login berhasil. Selamat datang kembali." : null;
  });
  const canApprove = user?.role === Role.KABAG_UMUM || user?.role === Role.PJ_RUANGAN;
  const isAdmin = user?.role === Role.KABAG_UMUM;
  const pendingCount = usePendingBookingCount(canApprove);

  useEffect(() => { localStorage.setItem("sidebar-collapsed", String(isSidebarCollapsed)); }, [isSidebarCollapsed]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true, state: { logoutSuccess: true } });
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className={`fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white px-4 transition-[left] duration-200 lg:px-8 ${isSidebarCollapsed ? "lg:left-20" : "lg:left-64"}`}>
        <button
          type="button"
          className="mr-3 rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:hidden"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Buka navigasi"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ruang & Inventaris</p>
          <h1 className="truncate text-lg font-semibold text-slate-900">{getPageTitle(location.pathname)}</h1>
        </div>
        <div className="ml-4 flex items-center gap-3 border-l border-slate-200 pl-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-800">{user?.fullName}</p>
            <p className="text-xs text-slate-500">{getRoleLabel(user?.role)}</p>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
            {user?.fullName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
          onClick={closeMenu}
          aria-label="Tutup navigasi"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-100 transition-[width,transform] duration-200 lg:translate-x-0 ${isSidebarCollapsed ? "lg:w-20" : "lg:w-64"} ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-slate-700/70 px-5">
          <BrandLogo className={`h-9 w-9 shadow-lg shadow-blue-950/30 ${isSidebarCollapsed ? "lg:hidden" : ""}`} />
          <div className={`ml-3 min-w-0 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
            <p className="truncate text-sm font-bold tracking-wide text-white">PinjamHub</p>
            <p className="text-[11px] text-slate-400">Setditjen Binwasnaker</p>
          </div>
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={closeMenu}
            aria-label="Tutup navigasi"
          >
            <X size={19} />
          </button>
          <button type="button" onClick={() => setIsSidebarCollapsed((value) => !value)} className={`hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:block ${isSidebarCollapsed ? "mx-auto" : "ml-auto"}`} aria-label={isSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"} title={isSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}>{isSidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Navigasi utama">
          <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Utama</p>
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMenu}
                 title={isSidebarCollapsed ? item.label : undefined}
                 className={({ isActive }) =>
                   `group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isSidebarCollapsed ? "lg:justify-center" : ""} ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                <item.icon size={18} aria-hidden="true" />
                 <span className={`ml-3 flex-1 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                 <ChevronRight size={15} className={`opacity-0 transition-opacity group-hover:opacity-100 ${isSidebarCollapsed ? "lg:hidden" : ""}`} />
              </NavLink>
            ))}
          </div>

          {canApprove && (
            <div className="mt-7">
              <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Pengelolaan</p>
              {adminNavigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isSidebarCollapsed ? "lg:justify-center" : ""} ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`
                  }
                >
                  <item.icon size={18} aria-hidden="true" />
                  <span className={`ml-3 flex-1 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                  {(pendingCount.data ?? 0) > 0 && <span className={`ml-auto grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white ${isSidebarCollapsed ? "lg:absolute lg:right-1 lg:top-1" : ""}`}>{pendingCount.data! > 99 ? "99+" : pendingCount.data}</span>}
                </NavLink>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="mt-7">
              <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Master Data</p>
              <div className="space-y-1">
                {masterDataNavigation.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeMenu}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isSidebarCollapsed ? "lg:justify-center" : ""} ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`
                    }
                  >
                    <item.icon size={18} aria-hidden="true" />
                    <span className={`ml-3 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className={`grid grid-cols-2 gap-2 border-t border-slate-700/70 p-3 ${isSidebarCollapsed ? "lg:grid-cols-1" : ""}`}>
          <button
            type="button"
            className="flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={() => setShowChangePassword(true)}
          >
            <KeyRound size={18} aria-hidden="true" />
             <span className={`ml-2 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Password</span>
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut size={18} aria-hidden="true" />
             <span className={`ml-2 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Keluar</span>
          </button>
        </div>
      </aside>

      <main className={`min-h-screen pt-16 transition-[padding] duration-200 ${isSidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} onSuccess={setFeedback} />}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 px-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="logout-title" className="font-bold text-slate-900">Keluar dari aplikasi?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Sesi Anda akan diakhiri dan halaman login akan ditampilkan.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Batal</button>
              <button type="button" onClick={handleLogout} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">Ya, keluar</button>
            </div>
          </div>
        </div>
      )}

      {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}
