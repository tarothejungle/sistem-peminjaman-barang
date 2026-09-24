import { BookingStatus } from "../../types";

/** Single source of truth for user-facing booking status wording. */
export const bookingStatusLabels: Record<BookingStatus, string> = {
  [BookingStatus.PENDING_PJ_REVIEW]: "Menunggu Pemeriksaan PJ",
  [BookingStatus.PENDING_KABAG_APPROVAL]: "Menunggu Persetujuan Kasubag",
  [BookingStatus.APPROVED]: "Disetujui",
  [BookingStatus.ALTERNATIVE_OFFERED]: "Alternatif Ditawarkan",
  [BookingStatus.CONFIRMED]: "Dikonfirmasi",
  [BookingStatus.PREPARING]: "Sedang Dipersiapkan",
  [BookingStatus.IN_USE]: "Sedang Digunakan",
  [BookingStatus.FINISHED_PENDING_INSPECTION]: "Menunggu Inspeksi",
  [BookingStatus.COMPLETED]: "Selesai",
  [BookingStatus.REJECTED]: "Ditolak",
  [BookingStatus.CANCELLED]: "Dibatalkan",
};

/** Statuses offered in the report filter, following the order of the workflow. */
export const reportStatusOptions: Array<{ value: BookingStatus; label: string }> = [
  BookingStatus.PENDING_PJ_REVIEW,
  BookingStatus.PREPARING,
  BookingStatus.PENDING_KABAG_APPROVAL,
  BookingStatus.APPROVED,
  BookingStatus.IN_USE,
  BookingStatus.FINISHED_PENDING_INSPECTION,
  BookingStatus.COMPLETED,
  BookingStatus.REJECTED,
  BookingStatus.CANCELLED,
].map((value) => ({ value, label: bookingStatusLabels[value] }));
