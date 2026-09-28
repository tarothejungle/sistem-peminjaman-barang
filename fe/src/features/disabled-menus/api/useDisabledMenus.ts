import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse } from "../../../types";

export const MENU_OPTIONS = [
  { key: "room-booking", label: "Peminjaman Ruang Rapat", path: "/peminjaman-ruang-rapat" },
  { key: "vehicle-booking", label: "Peminjaman Kendaraan", path: "/peminjaman-barang" },
  { key: "booking-status", label: "Status Peminjaman", path: "/my-bookings" },
  { key: "approvals", label: "Persetujuan Peminjaman", path: "/admin/approvals" },
  { key: "room-cancellations", label: "Pembatalan Ruang Rapat", path: "/admin/room-booking-cancellations" },
  { key: "reports", label: "Laporan Peminjaman", path: "/admin/reports" },
  { key: "department-heads", label: "Data Kabag & Kasubag", path: "/admin/department-heads" },
  { key: "room-managers", label: "Data PJ Ruangan", path: "/admin/room-managers" },
  { key: "users", label: "Data User", path: "/admin/users" },
  { key: "room-booking-settings", label: "Pengaturan Jam Ruangan", path: "/admin/room-booking-settings" },
  { key: "rooms", label: "Kelola Ruangan", path: "/admin/rooms" },
  { key: "vehicles", label: "Kelola Kendaraan", path: "/admin/items" },
  { key: "attention-messages", label: "Informasi & Perhatian", path: "/admin/attention-messages" },
  { key: "maintenance", label: "Mode Maintenance", path: "/admin/maintenance" },
] as const;

export type MenuKey = (typeof MENU_OPTIONS)[number]["key"];

interface DisabledMenuSettings {
  disabledMenuKeys: MenuKey[];
}

const queryKey = ["disabled-menus"] as const;

export function useDisabledMenus() {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<DisabledMenuSettings> => {
      const response = await api.get<ApiResponse<DisabledMenuSettings>>("/disabled-menus");
      return response.data.data;
    },
  });
}

export function useUpdateDisabledMenus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (disabledMenuKeys: MenuKey[]): Promise<DisabledMenuSettings> => {
      const response = await api.put<ApiResponse<DisabledMenuSettings>>("/disabled-menus", { disabledMenuKeys });
      return response.data.data;
    },
    onSuccess: async (data) => queryClient.setQueryData(queryKey, data),
  });
}

export function menuKeyForPath(pathname: string): MenuKey | null {
  return MENU_OPTIONS.find((menu) => pathname.startsWith(menu.path))?.key ?? null;
}
