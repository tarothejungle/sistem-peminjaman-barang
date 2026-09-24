import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse } from "../../../types";

export interface RoomBookingSettings {
  id: number;
  startTime: string;
  endTime: string;
  morningStartTime: string;
  morningEndTime: string;
  afternoonStartTime: string;
  afternoonEndTime: string;
  timezone: string;
}

export interface UpdateRoomBookingSettingsInput {
  morningStartTime: string;
  morningEndTime: string;
  afternoonStartTime: string;
  afternoonEndTime: string;
  fullDayStartTime: string;
  fullDayEndTime: string;
}

const settingsKey = ["room-booking-settings"] as const;

export function useRoomBookingSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async (): Promise<RoomBookingSettings> => {
      const response = await api.get<ApiResponse<RoomBookingSettings>>("/room-booking-settings");
      return response.data.data;
    },
  });
}

export function useUpdateRoomBookingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRoomBookingSettingsInput): Promise<RoomBookingSettings> => {
      const response = await api.put<ApiResponse<RoomBookingSettings>>("/room-booking-settings", input);
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  });
}
