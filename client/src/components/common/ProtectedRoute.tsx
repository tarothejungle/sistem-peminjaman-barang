import { useEffect, useState } from "react";
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
  const [hasHydrated, setHasHydrated] = useState(useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribeStart = useAuthStore.persist.onHydrate(() => setHasHydrated(false));
    const unsubscribeEnd = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));

    setHasHydrated(useAuthStore.persist.hasHydrated());

    return () => {
      unsubscribeStart();
      unsubscribeEnd();
    };
  }, []);

  if (!hasHydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <div className="w-full max-w-sm space-y-3" aria-label="Memuat sesi pengguna">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
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
