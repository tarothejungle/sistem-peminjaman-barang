import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, UserNotification } from "../../../types";

export const notificationKey = ["notifications"] as const;

interface NotificationInbox {
  notifications: UserNotification[];
  unreadCount: number;
}

export function useNotifications() {
  return useQuery({
    queryKey: notificationKey,
    queryFn: async (): Promise<NotificationInbox> => {
      const response = await api.get<ApiResponse<NotificationInbox>>("/notifications");
      return response.data.data;
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: notificationKey }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await api.patch("/notifications/read-all");
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: notificationKey }),
  });
}
