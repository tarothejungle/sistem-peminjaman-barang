import axios from "axios";

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function getAdminErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data.error?.message ?? "Perubahan data gagal diproses.";
  }

  return "Perubahan data gagal diproses.";
}
