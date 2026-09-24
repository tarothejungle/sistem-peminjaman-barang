// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../store/authStore";
import { Role, type User } from "../../../types";
import { ManageDepartmentHeadsPage, ManageUsersPage } from "./ManageUsersPage";

const createUser = vi.fn();
const updateUser = vi.fn();
let managedUsers: User[];

const user: User = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Siti Rahma",
  username: "siti.rahma",
  email: "siti@example.test",
  role: Role.PEMOHON,
  phoneNumber: null,
  creditScore: 100,
  profileImageUrl: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

vi.mock("../../users/api/useManagedUsers", () => ({
  useManagedUsers: () => ({ data: managedUsers, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateManagedUser: () => ({ isPending: false, error: null, mutateAsync: createUser, reset: vi.fn() }),
  useUpdateManagedUser: () => ({ isPending: false, error: null, mutateAsync: updateUser, reset: vi.fn() }),
  useDeleteManagedUser: () => ({ isPending: false, error: null, mutateAsync: vi.fn(), reset: vi.fn() }),
}));

beforeEach(() => {
  managedUsers = [user];
  useAuthStore.setState({ user });
});

afterEach(() => {
  cleanup();
  createUser.mockReset();
  updateUser.mockReset();
  useAuthStore.setState({ user: null });
});

describe("ManageUsersPage password field", () => {
  it("asks for a password while registering a new account", () => {
    render(<ManageUsersPage />);

    fireEvent.click(screen.getByRole("button", { name: /Tambah User/ }));

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("hides the password field when editing an existing account", () => {
    render(<ManageUsersPage />);

    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));

    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nama lengkap")).toHaveValue("Siti Rahma");
  });

  it("hides edit and delete actions for Kabag when actor is Kasubag", () => {
    const kabag = { ...user, id: "22222222-2222-4222-8222-222222222222", fullName: "Kabag Umum", role: Role.KABAG_UMUM };
    managedUsers = [kabag];
    useAuthStore.setState({ user: { ...user, id: "33333333-3333-4333-8333-333333333333", role: Role.KASUBAG_UMUM } });

    render(<ManageDepartmentHeadsPage />);

    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hapus/ })).not.toBeInTheDocument();
    expect(screen.getByText("Dikelola oleh Kabag")).toBeInTheDocument();
  });
});
