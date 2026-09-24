import {
  Archive,
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  X,
  UserCog,
  ShieldCheck,
  Users,
  Clock3,
  Wrench,
  Ban,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AttentionDialog } from "../../features/attention/components/AttentionDialog";
import { ChangePasswordModal } from "../../features/auth/components/ChangePasswordModal";
import { ProfileDashboard } from "../../features/profile/components/ProfileDashboard";
import { useAuthStore } from "../../store/authStore";
import { Role, canManageResources, isAdministratorRole } from "../../types";
import { BrandLogo } from "../common/BrandLogo";
import { SuccessToast } from "../common/SuccessToast";
import { InactivitySessionManager } from "../../features/auth/components/InactivitySessionManager";
import { NotificationMenu } from "../../features/notifications/components/NotificationMenu";
import { KabagNotchLayout } from "./KabagNotchLayout";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeSwitcher } from "./ThemeSwitcher";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
] as const;

const submissionNavigation = [
  { label: "Peminjaman Ruang Rapat", to: "/peminjaman-ruang-rapat", icon: PanelsTopLeft },
  { label: "Peminjaman Kendaraan", to: "/peminjaman-barang", icon: Boxes },
  { label: "Status Peminjaman", to: "/my-bookings", icon: Archive },
] as const;

const masterDataNavigation = [
  { label: "Data Kabag & Kasubag", to: "/admin/department-heads", icon: ShieldCheck },
  { label: "Data PJ Ruangan", to: "/admin/room-managers", icon: UserCog },
  { label: "Data User", to: "/admin/users", icon: Users },
  { label: "Pengaturan Jam Ruangan", to: "/admin/room-booking-settings", icon: Clock3 },
] as const;

const pengelolaanNavigation = [
  { label: "Kelola Ruangan", to: "/admin/rooms", icon: PanelsTopLeft },
  { label: "Kelola Kendaraan", to: "/admin/items", icon: Boxes },
] as const;

const systemNavigation = [
  { label: "Informasi & Perhatian", to: "/admin/attention-messages", icon: Megaphone },
  { label: "Mode Maintenance", to: "/admin/maintenance", icon: Wrench },
] as const;

const approvalNavigation = [
  { label: "Persetujuan Peminjaman", to: "/admin/approvals", icon: ClipboardCheck },
  { label: "Pembatalan Ruang Rapat", to: "/admin/room-booking-cancellations", icon: Ban },
  { label: "Laporan Peminjaman", to: "/admin/reports", icon: FileSpreadsheet },
] as const;

function getPageTitle(pathname: string): string {
  const item = [...navigation, ...submissionNavigation, ...masterDataNavigation, ...pengelolaanNavigation, ...approvalNavigation, ...systemNavigation].find(({ to }) => pathname.startsWith(to));
  return item?.label ?? "Sistem Peminjaman Ruang Rapat & Kendaraan";
}

const navItemClass = (isActive: boolean, collapsed: boolean) =>
  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${collapsed ? "lg:justify-center" : ""} ${
    isActive
      ? "border border-accent-line bg-accent-soft font-semibold text-accent"
      : "border border-transparent font-medium text-ink-3 hover:bg-hover hover:text-ink"
  }`;

export function MainLayout() {
  const role = useAuthStore((state) => state.user?.role);

  if (role === Role.KABAG_UMUM) return <KabagNotchLayout />;

  return <SidebarLayout />;
}

function SidebarLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const pendingLoginNotice = useAuthStore((state) => state.pendingLoginNotice);
  const clearLoginNotice = useAuthStore((state) => state.clearLoginNotice);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [showAttention, setShowAttention] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const canApprove = isAdministratorRole(user?.role) || user?.role === Role.PJ_RUANGAN;
  const isAdmin = isAdministratorRole(user?.role);
  const canManage = canManageResources(user?.role);
  const isUser = user?.role === Role.PEMOHON;

  useEffect(() => { localStorage.setItem("sidebar-collapsed", String(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => {
    if (!pendingLoginNotice) return;
    setFeedback("Login berhasil. Selamat datang kembali.");
    setShowAttention(true);
    clearLoginNotice();
  }, [clearLoginNotice, pendingLoginNotice]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true, state: { logoutSuccess: true } });
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <InactivitySessionManager />
      <header className={`fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-line bg-panel px-4 backdrop-blur-xl transition-[left] duration-200 lg:px-8 ${isSidebarCollapsed ? "lg:left-20" : "lg:left-64"}`}>
        <button
          type="button"
          className="mr-3 rounded-lg p-2 text-ink-3 hover:bg-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Buka navigasi"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-4">Ruang &amp; Inventaris</p>
          <h1 className="truncate text-lg font-semibold text-ink">{getPageTitle(location.pathname)}</h1>
        </div>
        <div className="ml-4 flex items-center gap-3">
          <NotificationMenu />
          <div className="hidden h-8 w-px bg-line sm:block" />
          <ProfileMenu onEditProfile={() => setShowProfile(true)} onChangePassword={() => setShowChangePassword(true)} onLogout={() => setShowLogoutConfirm(true)} />
        </div>
      </header>

      {isMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm lg:hidden"
          onClick={closeMenu}
          aria-label="Tutup navigasi"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-line bg-panel-strong text-ink backdrop-blur-xl transition-[width,transform] duration-200 lg:translate-x-0 ${isSidebarCollapsed ? "lg:w-20" : "lg:w-64"} ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
            <BrandLogo
              className={`h-9 w-9 ${isSidebarCollapsed ? "lg:hidden" : ""}`}
            />
            <div className={`ml-3 min-w-0 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-base font-bold tracking-wide text-ink">Sistem Peminjaman Ruang Rapat & Kendaraan</p>
              <p className="text-[10px] text-ink-3">Kementerian Ketenagakerjaan</p>
            </div>
            <button
              type="button"
              className="ml-auto rounded-lg p-2 text-ink-3 hover:bg-hover hover:text-ink lg:hidden"
              onClick={closeMenu}
              aria-label="Tutup navigasi"
            >
              <X size={19} />
            </button>
            <button type="button" onClick={() => setIsSidebarCollapsed((value) => !value)} className={`hidden rounded-lg p-2 text-ink-3 hover:bg-hover hover:text-ink lg:block ${isSidebarCollapsed ? "mx-auto" : "ml-auto"}`} aria-label={isSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"} title={isSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}>{isSidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5" aria-label="Navigasi utama">
            <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-4 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Utama</p>
            <div className="space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) => navItemClass(isActive, isSidebarCollapsed)}
                >
                  <item.icon size={18} aria-hidden="true" className="shrink-0" />
                  <span className={`flex-1 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                </NavLink>
              ))}
            </div>

            {isAdmin && (
              <div className="mt-7">
                <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-4 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Master Data</p>
                <div className="space-y-1">
                  {masterDataNavigation.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeMenu}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={({ isActive }) => navItemClass(isActive, isSidebarCollapsed)}
                    >
                      <item.icon size={18} aria-hidden="true" className="shrink-0" />
                      <span className={`flex-1 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                    </NavLink>
                  ))}
                </div>

                <p className={`mt-5 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-4 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Sistem</p>
                <div className="space-y-1">
                  {systemNavigation.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeMenu}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={({ isActive }) => navItemClass(isActive, isSidebarCollapsed)}
                    >
                      <item.icon size={18} aria-hidden="true" className="shrink-0" />
                      <span className={`flex-1 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            )}

            {canManage && (
              <div className="mt-7">
                <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-4 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Pengelolaan</p>
                <div className="space-y-1">
                  {pengelolaanNavigation.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeMenu}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={({ isActive }) => navItemClass(isActive, isSidebarCollapsed)}
                    >
                      <item.icon size={18} aria-hidden="true" className="shrink-0" />
                      <span className={`flex-1 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            )}

            {(isUser || canApprove) && <div className="mt-7">
              <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-4 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{canApprove ? "Approval & Laporan" : "Pengajuan"}</p>
              <div className="space-y-1">
                {isUser && submissionNavigation.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeMenu}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) => navItemClass(isActive, isSidebarCollapsed)}
                  >
                    <item.icon size={18} aria-hidden="true" className="shrink-0" />
                    <span className={`flex-1 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                  </NavLink>
                ))}
                {canApprove && approvalNavigation.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeMenu}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) => navItemClass(isActive, isSidebarCollapsed)}
                  >
                    <item.icon size={18} aria-hidden="true" className="shrink-0" />
                    <span className={`flex-1 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>}
          </nav>
        </div>

        <div className={`mt-auto shrink-0 border-t border-line p-3 pt-4 ${isSidebarCollapsed ? "lg:px-2" : ""}`}>
          <ThemeSwitcher collapsed={isSidebarCollapsed} />
        </div>
      </aside>

      <main className={`min-h-screen pt-16 transition-[padding] duration-200 ${isSidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {showProfile && (
        <div className="fixed inset-0 z-[65] overflow-y-auto bg-overlay px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => setShowProfile(false)} aria-label="Tutup ubah data" className="grid size-11 place-items-center rounded-full border border-line bg-panel-strong text-ink-2 shadow-xl transition hover:bg-hover hover:text-ink"><X size={19} /></button>
            </div>
            <ProfileDashboard />
          </div>
        </div>
      )}

      {showAttention && <AttentionDialog open={showAttention} onClose={() => setShowAttention(false)} />}

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} onSuccess={setFeedback} />}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-overlay px-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-sm rounded-2xl border border-line bg-panel-strong p-5 shadow-2xl shadow-shade backdrop-blur-xl">
            <h2 id="logout-title" className="font-bold text-ink">Keluar dari aplikasi?</h2>
            <p className="mt-2 text-sm leading-6 text-ink-3">Sesi Anda akan diakhiri dan halaman login akan ditampilkan.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-2 transition hover:bg-hover">Batal</button>
              <button type="button" onClick={handleLogout} className="rounded-lg bg-danger-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-danger-hover">Ya, keluar</button>
            </div>
          </div>
        </div>
      )}

      {feedback && <SuccessToast message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}
