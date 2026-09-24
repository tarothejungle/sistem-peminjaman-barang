import { useMutation } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import type { ApiResponse, User } from "../../../types";

export interface UpdateProfileInput {
  fullName: string;
  email: string;
  phoneNumber: string;
}

export function useUpdateProfile() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<User> => {
      const response = await api.patch<ApiResponse<User>>("/profile", input);
      return response.data.data;
    },
    onSuccess: setUser,
  });
}

export function useUploadProfilePhoto() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({
    mutationFn: async (image: File): Promise<User> => {
      const formData = new FormData();
      formData.append("image", image);
      const response = await api.post<ApiResponse<User>>("/profile/photo", formData);
      return response.data.data;
    },
    onSuccess: setUser,
  });
}

export function useDeleteProfilePhoto() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({
    mutationFn: async (): Promise<User> => {
      const response = await api.delete<ApiResponse<User>>("/profile/photo");
      return response.data.data;
    },
    onSuccess: setUser,
  });
}
