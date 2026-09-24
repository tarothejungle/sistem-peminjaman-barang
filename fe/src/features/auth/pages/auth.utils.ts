import axios from "axios";
import { apiErrorMessage } from "../../../lib/apiError";

export function getAuthErrorMessage(error: unknown): string {
  return apiErrorMessage(error) ?? (axios.isAxiosError(error) ? "Layanan autentikasi tidak dapat dihubungi" : "Terjadi kesalahan. Silakan coba lagi");
}
