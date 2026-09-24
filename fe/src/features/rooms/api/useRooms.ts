import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, Room } from "../../../types";

export const roomQueryKeys = {
  all: ["rooms"] as const,
};

export function useRooms(enabled = true) {
  return useQuery({
    queryKey: roomQueryKeys.all,
    queryFn: async (): Promise<Room[]> => {
      const response = await api.get<ApiResponse<Room[]>>("/rooms");
      return response.data.data;
    },
    enabled,
  });
}

export interface RoomInput {
  name: string;
  capacity: number;
  location: string;
  facilities: string[];
  image?: File;
}

function roomFormData(input: RoomInput): FormData {
  const data = new FormData();
  data.append("name", input.name);
  data.append("capacity", String(input.capacity));
  data.append("location", input.location);
  input.facilities.forEach((facility) => data.append("facilities[]", facility));
  if (input.image) data.append("image", input.image);
  return data;
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RoomInput): Promise<Room> => {
      const response = await api.post<ApiResponse<Room>>("/rooms", roomFormData(input));
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: roomQueryKeys.all }),
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, ...input }: RoomInput & { roomId: string }): Promise<Room> => {
      const response = await api.post<ApiResponse<Room>>(`/rooms/${roomId}`, roomFormData(input));
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: roomQueryKeys.all }),
  });
}

export function useDeactivateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string): Promise<Room> => {
      const response = await api.delete<ApiResponse<Room>>(`/rooms/${roomId}`);
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: roomQueryKeys.all }),
  });
}
