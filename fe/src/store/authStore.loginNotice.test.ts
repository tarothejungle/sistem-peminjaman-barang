import { describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { Role, type User } from "../types";

vi.mock("../lib/queryClient", () => ({ queryClient: { clear: vi.fn() } }));
vi.mock("../lib/authToken", () => ({ setAccessToken: vi.fn() }));
vi.mock("../lib/api", () => ({ api: { post: vi.fn(), get: vi.fn() } }));

const user: User = {
  id: "user-1",
  fullName: "Siti Rahma",
  username: "siti.rahma",
  email: "siti@example.test",
  role: Role.PEMOHON,
  phoneNumber: null,
  creditScore: 100,
  profileImageUrl: null,
};

describe("authStore login notice", () => {
  it("flags a pending briefing on a fresh sign-in and clears it once consumed", async () => {
    const { useAuthStore } = await import("./authStore");

    expect(useAuthStore.getState().pendingLoginNotice).toBe(false);

    useAuthStore.getState().setAuth(user, "access-token", 900, 60);
    expect(useAuthStore.getState().pendingLoginNotice).toBe(true);

    useAuthStore.getState().clearLoginNotice();
    expect(useAuthStore.getState().pendingLoginNotice).toBe(false);
  });

  it("does not flag a briefing when an existing session is restored on page load", async () => {
    const { useAuthStore } = await import("./authStore");
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { data: { accessToken: "access-token", inactivityTimeoutSeconds: 900, activityHeartbeatSeconds: 60 } },
    });
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: user } });

    await expect(useAuthStore.getState().checkAuth()).resolves.toBe(true);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().pendingLoginNotice).toBe(false);
  });
});