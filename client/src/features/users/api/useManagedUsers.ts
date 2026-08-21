import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, User } from "../../../types";

export type ManagedUserResource = "department-heads" | "room-managers" | "users";

const managedUserKeys = {
  list: (resource: ManagedUserResource) => ["managed-users", resource] as const,
};

export interface ManagedUserInput {
  fullName: string;
  email: string;
  password?: string;
}

export function useManagedUsers(resource: ManagedUserResource) {
  return useQuery({
    queryKey: managedUserKeys.list(resource),
    queryFn: async (): Promise<User[]> => {
      const response = await api.get<ApiResponse<User[]>>(`/${resource}`);
      return response.data.data;
    },
  });
}

export function useCreateManagedUser(resource: ManagedUserResource) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManagedUserInput): Promise<User> => {
      const response = await api.post<ApiResponse<User>>(`/${resource}`, input);
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: managedUserKeys.list(resource) }),
  });
}

export function useUpdateManagedUser(resource: ManagedUserResource) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ...input }: ManagedUserInput & { userId: string }): Promise<User> => {
      const response = await api.put<ApiResponse<User>>(`/${resource}/${userId}`, input);
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: managedUserKeys.list(resource) }),
  });
}

export function useDeleteManagedUser(resource: ManagedUserResource) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      await api.delete(`/${resource}/${userId}`);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: managedUserKeys.list(resource) }),
  });
}
