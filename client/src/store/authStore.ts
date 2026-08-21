import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../lib/api";
import type { ApiResponse, User } from "../types";

interface AccessTokenResponse {
  accessToken: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const clearAuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
} as const;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...clearAuthState,
      setAuth: (user, accessToken) => {
        set({ user, accessToken, isAuthenticated: true });
      },
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } finally {
          set(clearAuthState);
        }
      },
      checkAuth: async () => {
        try {
          const refreshResponse = await api.post<ApiResponse<AccessTokenResponse>>("/auth/refresh");
          const accessToken = refreshResponse.data.data.accessToken;

          set({ accessToken });

          const userResponse = await api.get<ApiResponse<User>>("/auth/me");
          set({
            user: userResponse.data.data,
            accessToken,
            isAuthenticated: true,
          });

          return true;
        } catch {
          set(clearAuthState);
          return false;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: ({ user, accessToken, isAuthenticated }) => ({
        user,
        accessToken,
        isAuthenticated,
      }),
    },
  ),
);
