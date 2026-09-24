import { apiErrorMessage } from "../../../lib/apiError";

export function getAdminErrorMessage(error: unknown): string {
  return apiErrorMessage(error) ?? "Perubahan data gagal diproses.";
}
