import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../../../store/authStore";
import { isAdministratorRole } from "../../../types";
import { useMaintenanceStatus } from "../api/useMaintenance";
import { MaintenanceScreen } from "./MaintenanceScreen";

/**
 * Sign-in has to stay reachable, otherwise nobody could reopen the site.
 * `maintenance-login` is the administrator door: it skips the redirect that a
 * leftover borrower session would otherwise trigger on `/login`.
 */
const PUBLIC_PATHS = ["/login", "/maintenance-login", "/forgot-password", "/reset-password", "/session-expired"];

function SessionSplash() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6" aria-label="Memuat sesi pengguna">
      <div className="w-full max-w-sm space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-raised-strong" />
        <div className="h-10 animate-pulse rounded-lg bg-raised-strong" />
      </div>
    </main>
  );
}

/**
 * Replaces the whole application with the maintenance notice while the switch
 * is on. Administrators keep working, and the auth pages stay open so one can
 * sign in to switch it back off.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const status = useMaintenanceStatus();

  if (status.data?.isEnabled) {
    const isPublicRoute = PUBLIC_PATHS.some((path) => location.pathname.startsWith(path));
    if (!isPublicRoute && !isAdministratorRole(user?.role)) {
      // The role is unknown until the session probe finishes; showing the notice
      // first would hide the app from an administrator mid-refresh.
      if (!isInitialized) return <SessionSplash />;
      return <MaintenanceScreen message={status.data.message} estimatedEndAt={status.data.estimatedEndAt} />;
    }
  }

  return <>{children}</>;
}