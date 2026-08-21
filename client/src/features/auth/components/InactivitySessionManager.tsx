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

    const redirect = () => {
      clearAuth();
      queryClient.clear();
      navigate("/login", { replace: true, state: { inactivityLogout: true } });
    };
    const finishSession = async () => {
      channel.postMessage("logout");
      try {
        await logout();
      } finally {
        redirect();
      }
    };
    const schedule = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => void finishSession(), timeoutSeconds * 1000);
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

    channel.onmessage = ({ data }) => data === "activity" ? schedule() : data === "logout" ? redirect() : undefined;
    const unauthorized = () => void finishSession();
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
