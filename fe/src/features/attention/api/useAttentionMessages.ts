import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, Role } from "../../../types";

/** "ALL" addresses every role; otherwise one of the Role values. */
export const ATTENTION_AUDIENCE_ALL = "ALL";
export type AttentionAudience = Role | typeof ATTENTION_AUDIENCE_ALL;

/** Where a notice is allowed to appear. */
export const ATTENTION_PLACEMENTS = ["AFTER_LOGIN", "BEFORE_LOGIN"] as const;
export type AttentionPlacement = (typeof ATTENTION_PLACEMENTS)[number];

export interface AttentionMessage {
  id: string;
  title: string;
  message: string;
  audienceRole: AttentionAudience;
  isActive: boolean;
  placement: AttentionPlacement;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttentionMessageInput {
  title: string;
  message: string;
  audienceRole: AttentionAudience;
  isActive?: boolean;
  placement?: AttentionPlacement;
  sortOrder?: number;
}

export const attentionQueryKeys = {
  feed: ["attention-messages", "feed"] as const,
  publicFeed: ["attention-messages", "public-feed"] as const,
  manage: ["attention-messages", "manage"] as const,
};

/**
 * Notices placed before login. Read on the sign-in page, which is why the
 * endpoint stays reachable while maintenance mode is on.
 */
export function usePublicAttentionFeed(enabled = true) {
  return useQuery({
    queryKey: attentionQueryKeys.publicFeed,
    queryFn: async (): Promise<AttentionMessage[]> => {
      const response = await api.get<ApiResponse<AttentionMessage[]>>("/attention-messages/public");
      return response.data.data;
    },
    enabled,
    staleTime: 0,
  });
}
/** Notices addressed to the signed-in role; read once the user logs in. */
export function useAttentionFeed(enabled = true) {
  return useQuery({
    queryKey: attentionQueryKeys.feed,
    queryFn: async (): Promise<AttentionMessage[]> => {
      const response = await api.get<ApiResponse<AttentionMessage[]>>("/attention-messages");
      return response.data.data;
    },
    enabled,
    staleTime: 0,
  });
}

export function useManagedAttentionMessages() {
  return useQuery({
    queryKey: attentionQueryKeys.manage,
    queryFn: async (): Promise<AttentionMessage[]> => {
      const response = await api.get<ApiResponse<AttentionMessage[]>>("/attention-messages/manage");
      return response.data.data;
    },
  });
}

async function invalidateAttention(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: attentionQueryKeys.feed }),
    queryClient.invalidateQueries({ queryKey: attentionQueryKeys.publicFeed }),
    queryClient.invalidateQueries({ queryKey: attentionQueryKeys.manage }),
  ]);
}

export function useCreateAttentionMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AttentionMessageInput): Promise<AttentionMessage> => {
      const response = await api.post<ApiResponse<AttentionMessage>>("/attention-messages/manage", input);
      return response.data.data;
    },
    onSuccess: async () => invalidateAttention(queryClient),
  });
}

export function useUpdateAttentionMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AttentionMessageInput> & { id: string }): Promise<AttentionMessage> => {
      const response = await api.put<ApiResponse<AttentionMessage>>(`/attention-messages/manage/${id}`, input);
      return response.data.data;
    },
    onSuccess: async () => invalidateAttention(queryClient),
  });
}

export function useDeleteAttentionMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/attention-messages/manage/${id}`);
    },
    onSuccess: async () => invalidateAttention(queryClient),
  });
}