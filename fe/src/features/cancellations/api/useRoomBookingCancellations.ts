import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, Booking, RoomBookingCancellation } from "../../../types";
import { bookingQueryKeys } from "../../bookings/api/useBookings";
import { notificationKey } from "../../notifications/api/useNotifications";

export const cancellationKeys = {
  all: ["room-booking-cancellations"] as const,
  options: ["room-booking-cancellations", "options"] as const,
};

export function useRoomBookingCancellationOptions(enabled: boolean) {
  return useQuery({
    queryKey: cancellationKeys.options,
    queryFn: async (): Promise<Booking[]> => {
      const response = await api.get<ApiResponse<Booking[]>>("/room-booking-cancellations/options");
      return response.data.data;
    },
    enabled,
    refetchInterval: enabled ? 3_000 : false,
  });
}

export function useRoomBookingCancellations() {
  return useQuery({
    queryKey: cancellationKeys.all,
    queryFn: async (): Promise<RoomBookingCancellation[]> => {
      const response = await api.get<ApiResponse<RoomBookingCancellation[]>>("/room-booking-cancellations");
      return response.data.data;
    },
    refetchInterval: 3_000,
  });
}

export function useCancelRoomBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { bookingId: string; reason: string }): Promise<RoomBookingCancellation> => {
      const response = await api.post<ApiResponse<RoomBookingCancellation>>("/room-booking-cancellations", input);
      return response.data.data;
    },
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: cancellationKeys.all }),
      queryClient.invalidateQueries({ queryKey: cancellationKeys.options }),
      queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: bookingQueryKeys.availabilitySummary }),
      queryClient.invalidateQueries({ queryKey: notificationKey }),
    ]),
  });
}
