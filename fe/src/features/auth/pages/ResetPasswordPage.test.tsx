// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordPage } from "./ResetPasswordPage";

const authApi = vi.hoisted(() => ({
  verifyResetToken: vi.fn(async () => true),
  mutateAsync: vi.fn(),
}));

vi.mock("../api/useAuthMutations", () => ({
  verifyResetToken: authApi.verifyResetToken,
  useResetPasswordMutation: () => ({
    mutateAsync: authApi.mutateAsync,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
  }),
}));

const token = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

afterEach(() => {
  cleanup();
  authApi.verifyResetToken.mockClear();
  authApi.mutateAsync.mockClear();
  window.history.replaceState(null, "", "/");
});

describe("ResetPasswordPage", () => {
  it("does not remove the token fragment during an uncommitted render", () => {
    window.history.replaceState(null, "", `/reset-password#token=${token}`);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderToString(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/reset-password"]}>
          <ResetPasswordPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(window.location.hash).toBe(`#token=${token}`);
  });

  it("preserves the reset token across StrictMode remounts and verifies it", async () => {
    window.history.replaceState(null, "", `/reset-password#token=${token}`);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/reset-password"]}>
            <ResetPasswordPage />
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(authApi.verifyResetToken).toHaveBeenCalledWith(token));
    expect(await screen.findByRole("heading", { name: "Buat Password Baru" })).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
});
