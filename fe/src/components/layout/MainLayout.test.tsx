// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/authStore";
import { Role, type User } from "../../types";
import { MainLayout } from "./MainLayout";

vi.mock("./KabagNotchLayout", () => ({
  KabagNotchLayout: () => <div>Navigasi notch Kabag</div>,
}));

vi.mock("../../features/notifications/components/NotificationMenu", () => ({
  NotificationMenu: () => <div>Menu notifikasi</div>,
}));

/** The dialog renders only when the layout opens it; the marker keeps this test on the trigger. */
vi.mock("../../features/attention/components/AttentionDialog", () => ({
  AttentionDialog: ({ open }: { open: boolean }) => (open ? <div>Briefing perhatian terbuka</div> : null),
}));

const kabag: User = {
  id: "kabag-1",
  fullName: "Kabag Umum",
  username: "kabag.umum",
  email: "kabag@example.test",
  role: Role.KABAG_UMUM,
  phoneNumber: null,
  creditScore: 100,
  profileImageUrl: null,
};

const borrower: User = { ...kabag, id: "pemohon-1", username: "pemohon", role: Role.PEMOHON };
const kasubag: User = { ...kabag, id: "kasubag-1", username: "kasubag", role: Role.KASUBAG_UMUM };

function renderLayout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><MainLayout /></MemoryRouter></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, pendingLoginNotice: false, inactivityTimeoutSeconds: null, activityHeartbeatSeconds: null });
});

describe("MainLayout", () => {
  it("uses adaptive notch navigation for KABAG_UMUM", () => {
    useAuthStore.setState({ user: kabag });

    render(<MainLayout />);

    expect(screen.getByText("Navigasi notch Kabag")).toBeInTheDocument();
  });

  it("orders approval, cancellation, then report navigation", () => {
    useAuthStore.setState({ user: kasubag, pendingLoginNotice: false, isInitialized: true });

    renderLayout();

    const approval = screen.getByRole("link", { name: "Persetujuan Peminjaman" });
    const cancellation = screen.getByRole("link", { name: "Pembatalan Ruang Rapat" });
    const report = screen.getByRole("link", { name: "Laporan Peminjaman" });
    expect(approval.compareDocumentPosition(cancellation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cancellation.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens the post-login briefing from the auth store, not from router state", () => {
    useAuthStore.setState({ user: borrower, pendingLoginNotice: true, isInitialized: true });

    renderLayout();

    expect(screen.getByText("Briefing perhatian terbuka")).toBeInTheDocument();
    expect(useAuthStore.getState().pendingLoginNotice).toBe(false);
  });

  it("does not open the briefing on a plain page load", () => {
    useAuthStore.setState({ user: borrower, pendingLoginNotice: false, isInitialized: true });

    renderLayout();

    expect(screen.queryByText("Briefing perhatian terbuka")).not.toBeInTheDocument();
  });
});
