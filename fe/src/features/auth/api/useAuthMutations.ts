import { useMutation } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, User } from "../../../types";

export interface LoginInput {
  username: string;
  password: string;
  captchaToken?: string;
}

export interface AuthConfig {
  turnstileEnabled: boolean;
  turnstileSiteKey: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  newPassword_confirmation: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  password_confirmation: string;
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

export async function getAuthConfig(): Promise<AuthConfig> {
  const response = await api.get<ApiResponse<AuthConfig>>("/auth/config");
  return response.data.data;
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput): Promise<string> => {
      const response = await api.patch<ApiResponse<{ message: string }>>("/auth/password", input);
      return response.data.data.message;
    },
  });
}

/**
 * Requests a reset link. The API deliberately responds identically whether or
 * not the email is registered, so the UI must not imply the address exists.
 */
export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (email: string): Promise<string> => {
      const response = await api.post<ApiResponse<{ message: string }>>("/auth/forgot-password", { email });
      return response.data.data.message;
    },
  });
}

export async function verifyResetToken(token: string): Promise<boolean> {
  const response = await api.post<ApiResponse<{ valid: boolean }>>("/auth/reset-password/verify", { token });
  return response.data.data.valid;
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput): Promise<string> => {
      const response = await api.post<ApiResponse<{ message: string }>>("/auth/reset-password", input);
      return response.data.data.message;
    },
  });
}
