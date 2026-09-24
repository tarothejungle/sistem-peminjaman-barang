import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse } from "../../../types";

export interface DisplayBooking {
  workUnit: string;
  startTime: string;
  endTime: string;
  purpose: string;
}

export interface DisplayRoom {
  id: string;
  name: string;
  location: string;
  capacity: number;
  state: "AVAILABLE" | "IN_USE";
  currentBooking: DisplayBooking | null;
  nextBooking: DisplayBooking | null;
  todayBookings: DisplayBooking[];
}

export interface RoomDisplayData {
  checkedAt: string;
  timezone: string;
  summary: {
    total: number;
    available: number;
    inUse: number;
    scheduled: number;
  };
  rooms: DisplayRoom[];
}

export function useRoomDisplay() {
  return useQuery<RoomDisplayData>({
    queryKey: ["room-display"],
    queryFn: async (): Promise<RoomDisplayData> => {
      const response = await api.get<ApiResponse<RoomDisplayData>>("/display/rooms");
      return response.data.data;
    },
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    /*
     * Smart TV kiosk: never let the query sit in the "paused" state. The default
     * "online" mode gates fetching on onlineManager, which flips to offline on any
     * `offline` window event — some webOS builds emit one spuriously on wake or when
     * the wired link renegotiates, and never emit the matching `online`. A paused
     * query reports fetchStatus "paused" with status "pending", which is neither
     * isLoading nor isError, so the page could only render the "belum tersedia"
     * message with no way back. "always" fetches regardless and lets a real network
     * failure surface as an error the 5s interval retries out of.
     */
    networkMode: "always",
  });
}
