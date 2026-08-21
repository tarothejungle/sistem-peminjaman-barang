import { Role, type Role as RoleType } from "../types";

const roleLabels: Record<RoleType, string> = {
  [Role.KABAG_UMUM]: "KABAG UMUM",
  [Role.PJ_RUANGAN]: "PJ RUANGAN",
  [Role.PEMOHON]: "USER",
};

export function getRoleLabel(role?: RoleType): string {
  return role ? roleLabels[role] : "";
}
