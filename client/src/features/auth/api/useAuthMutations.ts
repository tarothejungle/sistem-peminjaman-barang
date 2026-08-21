import { useMutation } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, User } from "../../../types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  newPassword_confirmation: string;
}

export interface LoginResult {
  accessToken: string;
  inactivityTimeoutSeconds: number;
  activityHeartbeatSeconds: number;
  user: User;
}

interface AccessTokenResult {
  accessToken: string;
  inactivityTimeoutSeconds: number;
  activityHeartbeatSeconds: number;
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: async (input: LoginInput): Promise<LoginResult> => {
      const loginResponse = await api.post<ApiResponse<AccessTokenResult>>("/auth/login", input);
      const accessToken = loginResponse.data.data.accessToken;
      const inactivityTimeoutSeconds = loginResponse.data.data.inactivityTimeoutSeconds;
      const activityHeartbeatSeconds = loginResponse.data.data.activityHeartbeatSeconds;
      const userResponse = await api.get<ApiResponse<User>>("/auth/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        accessToken,
        inactivityTimeoutSeconds,
        activityHeartbeatSeconds,
        user: userResponse.data.data,
      };
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput): Promise<string> => {
      const response = await api.patch<ApiResponse<{ message: string }>>("/auth/password", input);
      return response.data.data.message;
    },
  });
}
