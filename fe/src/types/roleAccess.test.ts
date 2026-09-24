import { describe, expect, it } from "vitest";
import { canApproveBookings, canManageResources, isAdministratorRole, Role } from "./index";

describe("canManageResources", () => {
  it("allows administrators and PJ Ruangan to manage rooms and items", () => {
    expect(canManageResources(Role.KABAG_UMUM)).toBe(true);
    expect(canManageResources(Role.KASUBAG_UMUM)).toBe(true);
    expect(canManageResources(Role.PJ_RUANGAN)).toBe(true);
  });

  it("keeps PEMOHON and anonymous users out", () => {
    expect(canManageResources(Role.PEMOHON)).toBe(false);
    expect(canManageResources(undefined)).toBe(false);
  });

  it("does not grant PJ Ruangan full administrator rights", () => {
    expect(isAdministratorRole(Role.PJ_RUANGAN)).toBe(false);
  });
});

describe("canApproveBookings", () => {
  it("keeps the approval queue actions with Kasubag alone", () => {
    expect(canApproveBookings(Role.KASUBAG_UMUM)).toBe(true);
  });

  it("treats Kabag as a monitoring role without approval rights", () => {
    expect(canApproveBookings(Role.KABAG_UMUM)).toBe(false);
    expect(canApproveBookings(Role.PJ_RUANGAN)).toBe(false);
    expect(canApproveBookings(Role.PEMOHON)).toBe(false);
    expect(canApproveBookings(undefined)).toBe(false);
  });
});
