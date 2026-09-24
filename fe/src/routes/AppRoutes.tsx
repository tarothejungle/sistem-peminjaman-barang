import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../components/common/ProtectedRoute";
import { MaintenanceGate } from "../features/maintenance/components/MaintenanceGate";
import { useAuthStore } from "../store/authStore";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { SessionExpiredPage } from "../features/auth/pages/SessionExpiredPage";
import { ADMINISTRATOR_ROLES, RESOURCE_MANAGER_ROLES, Role } from "../types";

const MainLayout = lazy(() => import("../components/layout/MainLayout").then((module) => ({ default: module.MainLayout })));
const DashboardPage = lazy(() => import("../features/dashboard/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const MyBookingsPage = lazy(() => import("../features/bookings/pages/MyBookingsPage").then((module) => ({ default: module.MyBookingsPage })));
const ForgotPasswordPage = lazy(() => import("../features/auth/pages/ForgotPasswordPage").then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("../features/auth/pages/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage })));
const AdminApprovalPage = lazy(() => import("../features/admin/pages/AdminApprovalPage").then((module) => ({ default: module.AdminApprovalPage })));
const ManageItemsPage = lazy(() => import("../features/admin/pages/ManageItemsPage").then((module) => ({ default: module.ManageItemsPage })));
const ManageRoomsPage = lazy(() => import("../features/admin/pages/ManageRoomsPage").then((module) => ({ default: module.ManageRoomsPage })));
const ManageRoomManagersPage = lazy(() => import("../features/admin/pages/ManageUsersPage").then((module) => ({ default: module.ManageRoomManagersPage })));
const ManageDepartmentHeadsPage = lazy(() => import("../features/admin/pages/ManageUsersPage").then((module) => ({ default: module.ManageDepartmentHeadsPage })));
const ManageUsersPage = lazy(() => import("../features/admin/pages/ManageUsersPage").then((module) => ({ default: module.ManageUsersPage })));
const RoomBookingSettingsPage = lazy(() => import("../features/admin/pages/RoomBookingSettingsPage").then((module) => ({ default: module.RoomBookingSettingsPage })));
const ManageAttentionMessagesPage = lazy(() => import("../features/admin/pages/ManageAttentionMessagesPage").then((module) => ({ default: module.ManageAttentionMessagesPage })));
const ManageMaintenancePage = lazy(() => import("../features/admin/pages/ManageMaintenancePage").then((module) => ({ default: module.ManageMaintenancePage })));
const RoomDisplayPage = lazy(() => import("../features/display/pages/RoomDisplayPage").then((module) => ({ default: module.RoomDisplayPage })));
const RoomCatalogPage = lazy(() => import("../features/catalog/pages/RoomCatalogPage").then((module) => ({ default: module.RoomCatalogPage })));
const ItemCatalogPage = lazy(() => import("../features/catalog/pages/ItemCatalogPage").then((module) => ({ default: module.ItemCatalogPage })));
const BookingReportPage = lazy(() => import("../features/reports/pages/BookingReportPage").then((module) => ({ default: module.BookingReportPage })));
const RoomBookingCancellationPage = lazy(() => import("../features/cancellations/pages/RoomBookingCancellationPage").then((module) => ({ default: module.RoomBookingCancellationPage })));

/** Roles that may open the approval queue and booking overview. KABAG_UMUM is monitoring-only; acting on a request still needs KASUBAG_UMUM. */
const OVERSIGHT_ROLES = [Role.KABAG_UMUM, Role.KASUBAG_UMUM, Role.PJ_RUANGAN] as const;
const ALL_ROLES = [Role.PEMOHON, Role.PJ_RUANGAN, Role.KABAG_UMUM, Role.KASUBAG_UMUM] as const;

function AdminPageFallback() {
  return <div className="h-64 animate-pulse rounded-2xl bg-raised-soft" aria-label="Memuat halaman" />;
}

function AuthPageFallback() {
  return <div className="min-h-screen bg-surface" aria-label="Memuat halaman" />;
}

export function AppRoutes() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  // The single session bootstrap for the whole app: the maintenance gate and the
  // route guards read the same state, and the rotating refresh token is spent
  // exactly once per page load.
  useEffect(() => {
    if (!isInitialized) void checkAuth();
  }, [checkAuth, isInitialized]);

  return (
    <BrowserRouter>
      <MaintenanceGate>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* The administrator door that stays open while maintenance mode is on. */}
        <Route path="/maintenance-login" element={<LoginPage mode="maintenance" />} />
        <Route path="/session-expired" element={<SessionExpiredPage />} />
        <Route path="/forgot-password" element={<Suspense fallback={<AuthPageFallback />}><ForgotPasswordPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<AuthPageFallback />}><ResetPasswordPage /></Suspense>} />
        <Route path="/smart-tv" element={<Suspense fallback={<div className="min-h-screen bg-surface" aria-label="Memuat dashboard Smart TV" />}><RoomDisplayPage /></Suspense>} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Suspense fallback={<AuthPageFallback />}><MainLayout /></Suspense>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute allowedRoles={[...ALL_ROLES]} />}>
              <Route path="/dashboard" element={<Suspense fallback={<AdminPageFallback />}><DashboardPage /></Suspense>} />
              <Route path="/peminjaman-ruang-rapat" element={<Suspense fallback={<AdminPageFallback />}><RoomCatalogPage /></Suspense>} />
              <Route path="/peminjaman-barang" element={<Suspense fallback={<AdminPageFallback />}><ItemCatalogPage /></Suspense>} />
              <Route path="/my-bookings" element={<Suspense fallback={<AdminPageFallback />}><MyBookingsPage /></Suspense>} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[...OVERSIGHT_ROLES]} />}>
              <Route path="/admin/approvals" element={<Suspense fallback={<AdminPageFallback />}><AdminApprovalPage /></Suspense>} />
              <Route path="/admin/reports" element={<Suspense fallback={<AdminPageFallback />}><BookingReportPage /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={[Role.PJ_RUANGAN, Role.KASUBAG_UMUM]} />}>
              <Route path="/admin/room-booking-cancellations" element={<Suspense fallback={<AdminPageFallback />}><RoomBookingCancellationPage /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={[...RESOURCE_MANAGER_ROLES]} />}>
              <Route path="/admin/rooms" element={<Suspense fallback={<AdminPageFallback />}><ManageRoomsPage /></Suspense>} />
              <Route path="/admin/items" element={<Suspense fallback={<AdminPageFallback />}><ManageItemsPage /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={[...ADMINISTRATOR_ROLES]} />}>
              <Route path="/admin/room-managers" element={<Suspense fallback={<AdminPageFallback />}><ManageRoomManagersPage /></Suspense>} />
              <Route path="/admin/department-heads" element={<Suspense fallback={<AdminPageFallback />}><ManageDepartmentHeadsPage /></Suspense>} />
              <Route path="/admin/users" element={<Suspense fallback={<AdminPageFallback />}><ManageUsersPage /></Suspense>} />
              <Route path="/admin/room-booking-settings" element={<Suspense fallback={<AdminPageFallback />}><RoomBookingSettingsPage /></Suspense>} />
              <Route path="/admin/attention-messages" element={<Suspense fallback={<AdminPageFallback />}><ManageAttentionMessagesPage /></Suspense>} />
              <Route path="/admin/maintenance" element={<Suspense fallback={<AdminPageFallback />}><ManageMaintenancePage /></Suspense>} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </MaintenanceGate>
    </BrowserRouter>
  );
}
