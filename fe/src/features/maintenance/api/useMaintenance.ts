import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse } from "../../../types";

export interface MaintenanceStatus {
  isEnabled: boolean;
  message: string;
  estimatedEndAt: string | null;
  updatedAt: string | null;
}

export interface MaintenanceInput {
  isEnabled: boolean;
  message?: string;
  estimatedEndAt?: string | null;
}

export const maintenanceKey = ["maintenance"] as const;

/** Polled so a running session notices the moment the site is closed. */
const MAINTENANCE_POLL_MS = 30_000;

/** ...and again the moment the announced window ends, so nobody waits a full cycle. */
const MAINTENANCE_DEADLINE_POLL_MS = 5_000;

/**
 * The server reopens the site by itself once `estimatedEndAt` passes, so the
 * poll tightens as the deadline approaches instead of waiting a fixed 30 s.
 */
function pollDelay(status: MaintenanceStatus | undefined): number {
  if (!status?.isEnabled || !status.estimatedEndAt) return MAINTENANCE_POLL_MS;

  const remaining = new Date(status.estimatedEndAt).getTime() - Date.now();
  if (!Number.isFinite(remaining)) return MAINTENANCE_POLL_MS;

  return Math.max(MAINTENANCE_DEADLINE_POLL_MS, Math.min(MAINTENANCE_POLL_MS, remaining));
}

export function useMaintenanceStatus(enabled = true) {
  return useQuery({
    queryKey: maintenanceKey,
    queryFn: async (): Promise<MaintenanceStatus> => {
      const response = await api.get<ApiResponse<MaintenanceStatus>>("/maintenance");
      return response.data.data;
    },
    enabled,
    refetchInterval: enabled ? (query) => pollDelay(query.state.data) : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MaintenanceInput): Promise<MaintenanceStatus> => {
      const response = await api.put<ApiResponse<MaintenanceStatus>>("/maintenance", input);
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: maintenanceKey }),
  });
}