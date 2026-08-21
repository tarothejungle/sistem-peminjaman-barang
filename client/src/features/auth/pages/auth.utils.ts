import axios from "axios";

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data.error?.message ?? "Layanan autentikasi tidak dapat dihubungi";
  }

  return "Terjadi kesalahan. Silakan coba lagi";
}
