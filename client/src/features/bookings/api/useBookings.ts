import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, Booking, BookingStatus, Role } from "../../../types";

export type RoomBookingSlot = "MORNING" | "AFTERNOON" | "FULL_DAY";

export const bookingQueryKeys = {
  all: ["bookings"] as const,
  mine: ["bookings", "mine"] as const,
  list: (status?: BookingStatus) => ["bookings", "list", status ?? "ALL"] as const,
  availability: (input: BookingAvailabilityInput | null) => ["bookings", "availability", input] as const,
  availabilitySummary: ["bookings", "availability-summary"] as const,
  pendingCount: ["bookings", "pending-count"] as const,
};

export function usePendingBookingCount(enabled = true) {
  return useQuery({
    queryKey: bookingQueryKeys.pendingCount,
    queryFn: async (): Promise<number> => {
      const response = await api.get<ApiResponse<{ count: number }>>("/bookings/pending-count");
      return response.data.data.count;
    },
    enabled,
    refetchInterval: enabled ? 3_000 : false,
    refetchOnWindowFocus: true,
  });
}

interface BookingBaseInput {
  purpose: string;
}

export interface CreateRoomBookingInput extends BookingBaseInput {
  resourceType: "ROOM";
  roomId: string;
  startDate: string;
  endDate: string;
  roomSlot: RoomBookingSlot;
  document?: File;
}

export interface CreateItemBookingInput extends BookingBaseInput {
  resourceType: "ITEM";
  startTime: string;
  endTime: string;
  items: Array<{
    itemId: string;
    quantity: number;
  }>;
}

export type CreateBookingInput = CreateRoomBookingInput | CreateItemBookingInput;

export type BookingAvailabilityInput =
  | { resourceType: "ROOM"; roomId: string; startDate: string; endDate: string; roomSlot: RoomBookingSlot; bookingId?: string }
  | { resourceType: "ITEM"; itemId: string; quantity: number; startTime: string; endTime: string; bookingId?: string };

export interface BookingAvailability {
  available: boolean;
  remainingStock: number | null;
  message: string;
}

export interface RoomAvailabilitySummary {
  resourceId: string;
  state: "IN_USE" | "RESERVED" | "AWAITING_CONFIRMATION";
  startTime: string;
  endTime: string;
}

export interface ItemAvailabilitySummary {
  resourceId: string;
  reservedNow: number;
  awaitingConfirmation: number;
  nextStartTime: string | null;
  nextEndTime: string | null;
  nextReservedQuantity: number;
}

export interface BookingAvailabilitySummary {
  rooms: RoomAvailabilitySummary[];
  items: ItemAvailabilitySummary[];
  checkedAt: string;
}

export function useBookingAvailabilitySummary(enabled = true) {
  return useQuery({
    queryKey: bookingQueryKeys.availabilitySummary,
    queryFn: async (): Promise<BookingAvailabilitySummary> => {
      const response = await api.get<ApiResponse<BookingAvailabilitySummary>>("/bookings/availability-summary");
      return response.data.data;
    },
    enabled,
    refetchInterval: enabled ? 3_000 : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useBookingAvailability(input: BookingAvailabilityInput | null) {
  return useQuery({
    queryKey: bookingQueryKeys.availability(input),
    queryFn: async (): Promise<BookingAvailability> => {
      const response = await api.get<ApiResponse<BookingAvailability>>("/bookings/availability", { params: input });
      return response.data.data;
    },
    enabled: input !== null,
    refetchInterval: input ? 3_000 : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBookingInput): Promise<Booking> => {
      if (input.resourceType === "ROOM") {
        const formData = new FormData();
        formData.append("resourceType", input.resourceType);
        formData.append("roomId", input.roomId);
        formData.append("startDate", input.startDate);
        formData.append("endDate", input.endDate);
        formData.append("roomSlot", input.roomSlot);
        formData.append("purpose", input.purpose);
        if (input.document) formData.append("document", input.document);
        const response = await api.post<ApiResponse<Booking>>("/bookings", formData);
        return response.data.data;
      }
      const response = await api.post<ApiResponse<Booking>>("/bookings", input);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all });
    },
  });
}

function roomBookingFormData(input: CreateRoomBookingInput): FormData {
  const formData = new FormData();
  formData.append("resourceType", input.resourceType);
  formData.append("roomId", input.roomId);
  formData.append("startDate", input.startDate);
  formData.append("endDate", input.endDate);
  formData.append("roomSlot", input.roomSlot);
  formData.append("purpose", input.purpose);
  if (input.document) formData.append("document", input.document);
  return formData;
}

export function useUpdatePendingBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, input }: { bookingId: string; input: CreateBookingInput }): Promise<Booking> => {
      const body = input.resourceType === "ROOM" ? roomBookingFormData(input) : input;
      const response = input.resourceType === "ROOM"
        ? await api.post<ApiResponse<Booking>>(`/bookings/${bookingId}`, body)
        : await api.put<ApiResponse<Booking>>(`/bookings/${bookingId}`, body);
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all }),
  });
}

export function useDeletePendingBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string): Promise<void> => {
      await api.delete(`/bookings/${bookingId}`);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all }),
  });
}

export function useConfirmBookingFinished() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string): Promise<Booking> => {
      const response = await api.patch<ApiResponse<Booking>>(`/bookings/${bookingId}/confirm-finished`);
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all }),
  });
}

export function useMyBookings() {
  return useQuery({
    queryKey: bookingQueryKeys.mine,
    queryFn: async (): Promise<Booking[]> => {
      const response = await api.get<ApiResponse<Booking[]>>("/bookings/my");
      return response.data.data;
    },
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  });
}

export function useAllBookings(status?: BookingStatus) {
  return useQuery({
    queryKey: bookingQueryKeys.list(status),
    queryFn: async (): Promise<Booking[]> => {
      const response = await api.get<ApiResponse<Booking[]>>("/bookings", {
        params: status ? { status } : undefined,
      });
      return response.data.data;
    },
  });
}

export interface UpdateBookingStatusInput {
  bookingId: string;
  status: BookingStatus;
  rejectionReason?: string | null;
  alternativeStartTime?: string | null;
  alternativeEndTime?: string | null;
  approvalNotes?: string | null;
  inspectionNotes?: string | null;
  actorRole?: Role;
}

function getStatusUpdateEndpoint(bookingId: string, status: BookingStatus, actorRole?: Role): string {
  if (status === "PREPARING") return `/bookings/${bookingId}/pj-review`;
  if (status === "PENDING_KABAG_APPROVAL") return `/bookings/${bookingId}/pj-confirm`;
  if (status === "REJECTED" && actorRole === "PJ_RUANGAN") return `/bookings/${bookingId}/pj-review`;
  if (status === "APPROVED" || status === "REJECTED" || status === "ALTERNATIVE_OFFERED") return `/bookings/${bookingId}/kabag-approve`;
  if (status === "COMPLETED") return `/bookings/${bookingId}/pj-inspect`;
  return `/bookings/${bookingId}/status`;
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, actorRole, ...input }: UpdateBookingStatusInput): Promise<Booking> => {
      const response = await api.patch<ApiResponse<Booking>>(getStatusUpdateEndpoint(bookingId, input.status, actorRole), input);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookingQueryKeys.all });
    },
  });
}
