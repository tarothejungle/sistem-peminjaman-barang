import { create } from "zustand";
import { setAccessToken } from "../lib/authToken";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import type { ApiResponse, User } from "../types";

interface AccessTokenResponse {
  accessToken: string;
  inactivityTimeoutSeconds: number;
  activityHeartbeatSeconds: number;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  inactivityTimeoutSeconds: number | null;
  activityHeartbeatSeconds: number | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  logoutError: string | null;
  /** Set by setAuth so the layout can open the post-login briefing exactly once. */
  pendingLoginNotice: boolean;
  setAuth: (user: User, accessToken: string, inactivityTimeoutSeconds: number, activityHeartbeatSeconds: number) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  clearLoginNotice: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const clearAuthState = {
  user: null,
  accessToken: null,
  inactivityTimeoutSeconds: null,
  activityHeartbeatSeconds: null,
  isAuthenticated: false,
  logoutError: null,
  pendingLoginNotice: false,
} as const;

export const useAuthStore = create<AuthState>()((set) => ({
  ...clearAuthState,
  isInitialized: false,
  setAuth: (user, accessToken, inactivityTimeoutSeconds, activityHeartbeatSeconds) => {
    setAccessToken(accessToken);
    set({ user, accessToken, inactivityTimeoutSeconds, activityHeartbeatSeconds, isAuthenticated: true, isInitialized: true, pendingLoginNotice: true });
  },
  setUser: (user) => set({ user }),
  clearLoginNotice: () => set({ pendingLoginNotice: false }),
  clearAuth: () => {
    setAccessToken(null);
    queryClient.clear();
    set({ ...clearAuthState, isInitialized: true });
  },
  logout: async () => {
    try {
      await api.post("/auth/logout");
      setAccessToken(null);
      set({ ...clearAuthState, isInitialized: true });
      queryClient.clear();
    } catch {
      setAccessToken(null);
      set({ user: null, accessToken: null, inactivityTimeoutSeconds: null, activityHeartbeatSeconds: null, isAuthenticated: false, isInitialized: true, logoutError: "Gagal mengakhiri sesi server. Silakan coba lagi." });
      queryClient.clear();
    }
  },
  checkAuth: async () => {
    try {
      const refreshResponse = await api.post<ApiResponse<AccessTokenResponse>>("/auth/refresh");
      const { accessToken, inactivityTimeoutSeconds, activityHeartbeatSeconds } = refreshResponse.data.data;
      setAccessToken(accessToken);
      const userResponse = await api.get<ApiResponse<User>>("/auth/me");
      set({ user: userResponse.data.data, accessToken, inactivityTimeoutSeconds, activityHeartbeatSeconds, isAuthenticated: true, isInitialized: true });
      return true;
    } catch {
      setAccessToken(null);
      set({ ...clearAuthState, isInitialized: true });
      queryClient.clear();
      return false;
    }
  },
}));
