// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/authStore";
import { Role, type User } from "../../types";
import { ProfileMenu } from "./ProfileMenu";

const resourceImageSpy = vi.fn();

vi.mock("../common/ResourceImage", () => ({
  ResourceImage: (props: { url?: string | null; alt: string; fallback: React.ReactNode }) => {
    resourceImageSpy(props.url);
    return props.url ? <img src={props.url} alt={props.alt} /> : <>{props.fallback}</>;
  },
}));

const user: User = {
  id: "user-1",
  fullName: "Siti Rahma",
  username: "siti.rahma",
  email: "siti@example.test",
  role: Role.PEMOHON,
  phoneNumber: "081298765432",
  creditScore: 100,
  profileImageUrl: "/profile/photo",
};

beforeEach(() => {
  resourceImageSpy.mockClear();
  useAuthStore.setState({ user });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
});

describe("ProfileMenu", () => {
  it("renders the profile photo in the header avatar", () => {
    render(<ProfileMenu onChangePassword={vi.fn()} onLogout={vi.fn()} />);

    expect(resourceImageSpy).toHaveBeenCalledWith("/profile/photo");
    expect(screen.getByAltText("Foto profil Siti Rahma")).toBeInTheDocument();
  });

  it("exposes change password and logout as dropdown actions", () => {
    const onChangePassword = vi.fn();
    const onLogout = vi.fn();
    render(<ProfileMenu onChangePassword={onChangePassword} onLogout={onLogout} />);

    expect(screen.queryByRole("menuitem", { name: /Ganti Password/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu akun Siti Rahma" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Ganti Password/ }));
    expect(onChangePassword).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Menu akun Siti Rahma" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Keluar/ }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("orders Kabag profile actions as edit, theme, password, and logout", () => {
    const onEditProfile = vi.fn();
    render(<ProfileMenu onEditProfile={onEditProfile} showThemeOption showLabel onChangePassword={vi.fn()} onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Menu akun Siti Rahma" }));

    const menu = screen.getByRole("menu");
    const content = menu.textContent ?? "";
    expect(content.indexOf("Ubah Data")).toBeLessThan(content.indexOf("Pemilihan Tema"));
    expect(content.indexOf("Pemilihan Tema")).toBeLessThan(content.indexOf("Ganti Password"));
    expect(content.indexOf("Ganti Password")).toBeLessThan(content.indexOf("Keluar"));

    fireEvent.click(screen.getByRole("menuitem", { name: /Ubah Data/ }));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
  });
});
