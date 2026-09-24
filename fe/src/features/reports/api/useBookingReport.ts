import axios from "axios";
import { api } from "../../../lib/api";
import { apiErrorMessage } from "../../../lib/apiError";
import type { BookingStatus } from "../../../types";

export type BookingReportFormat = "xlsx" | "pdf";

export interface BookingReportFilters {
  status?: BookingStatus | "";
  /** Jakarta calendar date (YYYY-MM-DD). */
  from?: string;
  /** Jakarta calendar date (YYYY-MM-DD). */
  to?: string;
}

/** Mirrors the server filter contract, so an unused filter is simply omitted. */
export function bookingReportParams(filters: BookingReportFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return params;
}

/** Fallback name for browsers that hide the server Content-Disposition header. */
export function bookingReportFilename(format: BookingReportFormat, filters: BookingReportFilters): string {
  const parts = ["laporan-peminjaman", filters.from, filters.to].filter((part): part is string => Boolean(part));
  return `${parts.join("-")}.${format}`;
}

/**
 * A blob request hides the JSON error envelope, so read it back before giving
 * up: without this a rejected filter would look like a generic download failure.
 */
export async function reportErrorMessage(error: unknown): Promise<string | null> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const body = JSON.parse(await error.response.data.text()) as { error?: { message?: string } };
      return body.error?.message ?? null;
    } catch {
      return null;
    }
  }
  return apiErrorMessage(error);
}

export async function downloadBookingReport(format: BookingReportFormat, filters: BookingReportFilters): Promise<void> {
  const response = await api.get<Blob>(`/reports/bookings/${format}`, { params: bookingReportParams(filters), responseType: "blob" });
  const disposition = response.headers["content-disposition"] as string | undefined;
  const serverName = typeof disposition === "string" ? /filename="?([^";]+)"?/i.exec(disposition)?.[1] : undefined;
  const url = URL.createObjectURL(response.data);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = serverName ?? bookingReportFilename(format, filters);
  anchor.click();
  URL.revokeObjectURL(url);
}
