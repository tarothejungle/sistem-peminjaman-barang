import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import { setAccessToken } from "../../../lib/authToken";
import type { ApiResponse } from "../../../types";
import { queryClient } from "../../../lib/queryClient";
import { useAuthStore } from "../../../store/authStore";

export function InactivitySessionManager() {
  const navigate = useNavigate();
  const timeoutSeconds = useAuthStore((state) => state.inactivityTimeoutSeconds);
  const heartbeatSeconds = useAuthStore((state) => state.activityHeartbeatSeconds);
  const logout = useAuthStore((state) => state.logout);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    if (!timeoutSeconds || !heartbeatSeconds) return;

    const channel = new BroadcastChannel("auth-session");
    let timeoutId = 0;
    let lastBroadcast = 0;
    let lastHeartbeat = 0;

    const redirect = (reason: "inactive" | "invalid") => {
      clearAuth();
      queryClient.clear();
      navigate(reason === "inactive" ? "/session-expired" : "/login", { replace: true, state: reason === "invalid" ? { sessionExpired: true } : null });
    };
    const finishSession = async (reason: "inactive" | "invalid") => {
      channel.postMessage({ type: "logout", reason });
      try {
        await logout();
      } finally {
        redirect(reason);
      }
    };
    const schedule = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => void finishSession("inactive"), timeoutSeconds * 1000);
    };
    const recordActivity = () => {
      const now = Date.now();
      schedule();
      if (now - lastBroadcast >= 5_000) {
        lastBroadcast = now;
        channel.postMessage("activity");
      }
      if (now - lastHeartbeat >= heartbeatSeconds * 1000) {
        lastHeartbeat = now;
        void api.post<ApiResponse<{ accessToken: string }>>("/auth/activity").then((response) => {
          setAccessToken(response.data.data.accessToken);
        });
      }
    };

    channel.onmessage = ({ data }) => {
      if (data === "activity") schedule();
      if (data?.type === "logout") redirect(data.reason === "inactive" ? "inactive" : "invalid");
    };
    const unauthorized = (event: Event) => {
      const code = (event as CustomEvent<{ code?: string }>).detail?.code;
      void finishSession(code === "SESSION_INACTIVE" ? "inactive" : "invalid");
    };
    const events = ["pointerdown", "keydown", "touchstart", "focus"] as const;
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener("auth:unauthorized", unauthorized);
    schedule();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("auth:unauthorized", unauthorized);
      channel.close();
    };
  }, [clearAuth, heartbeatSeconds, logout, navigate, timeoutSeconds]);

  return null;
}
