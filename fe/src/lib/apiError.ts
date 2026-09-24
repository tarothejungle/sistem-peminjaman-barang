import axios from "axios";

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

/**
 * The server-provided message from a failed API call, or null when the error is
 * not an Axios error or carried no message body. Callers append their own
 * context with `?? "..."` so error extraction stays identical across every
 * mutation surface instead of being re-implemented per component.
 */
export function apiErrorMessage(error: unknown): string | null {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.message ?? null;
  }

  return null;
}
