import { describe, expect, it, vi } from "vitest";

const queryClear = vi.fn();
const setAccessToken = vi.fn();

vi.mock("../lib/queryClient", () => ({ queryClient: { clear: () => queryClear() } }));
vi.mock("../lib/authToken", () => ({ setAccessToken: (value: string | null) => setAccessToken(value) }));
vi.mock("../lib/api", () => ({ api: { post: vi.fn().mockRejectedValue(new Error("network")) } }));

describe("authStore.logout", () => {
  it("clears auth state and sets logoutError when server logout fails", async () => {
    const authStore = await import("./authStore");
    const store = authStore.useAuthStore;

    await store.getState().logout();
    const state = store.getState();

    expect(state.isAuthenticated).toBe(false);
    expect(state.logoutError).toBe("Gagal mengakhiri sesi server. Silakan coba lagi.");
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isInitialized).toBe(true);
    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(queryClear).toHaveBeenCalled();
  });
});
