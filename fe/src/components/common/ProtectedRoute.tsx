import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import type { Role } from "../../types";

interface ProtectedRouteProps {
  allowedRoles?: readonly Role[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (!isInitialized) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface px-6">
        <div className="w-full max-w-sm space-y-3" aria-label="Memuat sesi pengguna">
          <div className="h-4 w-24 animate-pulse rounded bg-raised-strong" />
          <div className="h-10 animate-pulse rounded-lg bg-raised-strong" />
          <div className="h-10 animate-pulse rounded-lg bg-raised-strong" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
