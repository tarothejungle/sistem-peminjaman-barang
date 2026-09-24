// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../store/authStore";
import { Role, type User } from "../../../types";
import { ProfileDashboard } from "./ProfileDashboard";

vi.mock("../api/useProfile", () => ({
  useUpdateProfile: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useUploadProfilePhoto: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useDeleteProfilePhoto: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
}));

const kasubag: User = {
  id: "kasubag-1",
  fullName: "Kasubag Umum",
  username: "kasubag.umum",
  email: "kasubag@example.test",
  role: Role.KASUBAG_UMUM,
  phoneNumber: "081234567890",
  creditScore: null,
  profileImageUrl: null,
};

const pemohon: User = { ...kasubag, id: "user-1", fullName: "Siti Rahma", role: Role.PEMOHON, creditScore: 95 };

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
});

describe("ProfileDashboard", () => {
  it("lets a Kasubag edit name and email, not just the phone number", () => {
    useAuthStore.setState({ user: kasubag });

    render(<ProfileDashboard />);

    expect(screen.getByLabelText("Nama Lengkap")).toHaveValue("Kasubag Umum");
    expect(screen.getByLabelText("Email")).toHaveValue("kasubag@example.test");
    expect(screen.getByLabelText("No. Telepon")).toHaveValue("081234567890");
  });

  it("shows the credit score to a borrower", () => {
    useAuthStore.setState({ user: pemohon });

    render(<ProfileDashboard />);

    expect(screen.getByText("Skor kredibilitas kendaraan")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("hides the credit score from roles it does not apply to", () => {
    useAuthStore.setState({ user: kasubag });

    render(<ProfileDashboard />);

    expect(screen.queryByText("Skor kredibilitas kendaraan")).not.toBeInTheDocument();
    expect(screen.queryByText("105")).not.toBeInTheDocument();
  });

  it("keeps a borrower's identity read-only", () => {
    useAuthStore.setState({ user: pemohon });

    render(<ProfileDashboard />);

    expect(screen.queryByLabelText("Nama Lengkap")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByLabelText("No. Telepon")).toHaveValue("081234567890");
  });
});
