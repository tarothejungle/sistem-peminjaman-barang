import { FileSpreadsheet, LayoutDashboard, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AttentionDialog } from "../../features/attention/components/AttentionDialog";
import { ChangePasswordModal } from "../../features/auth/components/ChangePasswordModal";
import { InactivitySessionManager } from "../../features/auth/components/InactivitySessionManager";
import { ProfileDashboard } from "../../features/profile/components/ProfileDashboard";
import { useAuthStore } from "../../store/authStore";
import { BrandLogo } from "../common/BrandLogo";
import { SuccessToast } from "../common/SuccessToast";
import { NotchNav, type NotchItemData } from "../ui/adaptive-notch-navigation-bar";
import { ProfileMenu } from "./ProfileMenu";

const kabagNavigation: NotchItemData[] = [
  { id: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "/admin/reports", label: "Laporan", icon: FileSpreadsheet },
];

export function KabagNotchLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const pendingLoginNotice = useAuthStore((state) => state.pendingLoginNotice);
  const clearLoginNotice = useAuthStore((state) => state.clearLoginNotice);
  const [showAttention, setShowAttention] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const activeId = kabagNavigation.find((item) => location.pathname.startsWith(item.id))?.id ?? "/dashboard";

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

  const logo = (
    <div className="flex h-9 items-center gap-2">
      <BrandLogo className="size-8" />
      <span className="hidden max-w-64 truncate text-sm font-bold tracking-wide sm:inline">Sistem Peminjaman Ruang Rapat & Kendaraan</span>
    </div>
  );

  const rightContent = (
    <div className="flex h-9 items-center gap-1">
      <ProfileMenu
        onEditProfile={() => setShowProfile(true)}
        showThemeOption
        showLabel
        onChangePassword={() => setShowChangePassword(true)}
        onLogout={() => setShowLogoutConfirm(true)}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface text-ink">
      <InactivitySessionManager />
      <NotchNav
        items={kabagNavigation}
        activeId={activeId}
        logo={logo}
        rightContent={rightContent}
        compactDropdown={false}
        onActiveChange={navigate}
      >
        <main className="mx-auto min-h-full w-full max-w-[1600px] py-4 sm:py-6 lg:py-8">
          <Outlet />
        </main>
      </NotchNav>

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
          <div role="alertdialog" aria-modal="true" aria-labelledby="kabag-logout-title" className="w-full max-w-sm rounded-2xl border border-line bg-panel-strong p-5 shadow-2xl shadow-shade backdrop-blur-xl">
            <h2 id="kabag-logout-title" className="font-bold text-ink">Keluar dari aplikasi?</h2>
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
