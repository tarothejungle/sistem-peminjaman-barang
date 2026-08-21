import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../components/common/ProtectedRoute";
import { MainLayout } from "../components/layout/MainLayout";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { MyBookingsPage } from "../features/bookings/pages/MyBookingsPage";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { Role } from "../types";

const AdminApprovalPage = lazy(() => import("../features/admin/pages/AdminApprovalPage").then((module) => ({ default: module.AdminApprovalPage })));
const ManageItemsPage = lazy(() => import("../features/admin/pages/ManageItemsPage").then((module) => ({ default: module.ManageItemsPage })));
const ManageRoomsPage = lazy(() => import("../features/admin/pages/ManageRoomsPage").then((module) => ({ default: module.ManageRoomsPage })));
const ManageRoomManagersPage = lazy(() => import("../features/admin/pages/ManageUsersPage").then((module) => ({ default: module.ManageRoomManagersPage })));
const ManageDepartmentHeadsPage = lazy(() => import("../features/admin/pages/ManageUsersPage").then((module) => ({ default: module.ManageDepartmentHeadsPage })));
const ManageUsersPage = lazy(() => import("../features/admin/pages/ManageUsersPage").then((module) => ({ default: module.ManageUsersPage })));
const RoomBookingSettingsPage = lazy(() => import("../features/admin/pages/RoomBookingSettingsPage").then((module) => ({ default: module.RoomBookingSettingsPage })));

function AdminPageFallback() {
  return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" aria-label="Memuat halaman" />;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute allowedRoles={[Role.PEMOHON, Role.PJ_RUANGAN, Role.KABAG_UMUM]} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/my-bookings" element={<MyBookingsPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[Role.KABAG_UMUM, Role.PJ_RUANGAN]} />}>
              <Route path="/admin/approvals" element={<Suspense fallback={<AdminPageFallback />}><AdminApprovalPage /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={[Role.KABAG_UMUM]} />}>
              <Route path="/admin/rooms" element={<Suspense fallback={<AdminPageFallback />}><ManageRoomsPage /></Suspense>} />
              <Route path="/admin/items" element={<Suspense fallback={<AdminPageFallback />}><ManageItemsPage /></Suspense>} />
              <Route path="/admin/room-managers" element={<Suspense fallback={<AdminPageFallback />}><ManageRoomManagersPage /></Suspense>} />
              <Route path="/admin/department-heads" element={<Suspense fallback={<AdminPageFallback />}><ManageDepartmentHeadsPage /></Suspense>} />
              <Route path="/admin/users" element={<Suspense fallback={<AdminPageFallback />}><ManageUsersPage /></Suspense>} />
              <Route path="/admin/room-booking-settings" element={<Suspense fallback={<AdminPageFallback />}><RoomBookingSettingsPage /></Suspense>} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
