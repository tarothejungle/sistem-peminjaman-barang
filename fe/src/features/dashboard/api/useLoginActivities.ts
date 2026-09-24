import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, LoginActivityDashboard } from "../../../types";

export function useLoginActivities(page: number, enabled = true) {
  return useQuery({
    queryKey: ["login-activities", page],
    queryFn: async (): Promise<LoginActivityDashboard> => {
      const response = await api.get<ApiResponse<LoginActivityDashboard>>("/login-activities", {
        params: { page, perPage: 10 },
      });
      return response.data.data;
    },
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
}
