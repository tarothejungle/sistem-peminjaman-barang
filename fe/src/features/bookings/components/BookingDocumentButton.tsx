import { Download } from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import type { Booking } from "../../../types";

/** The two private letters a booking can carry. */
export type BookingLetterKind = "document" | "suratTugas";

const LETTERS: Record<BookingLetterKind, { route: string; label: string; fallbackName: string }> = {
  document: { route: "document", label: "Surat resmi", fallbackName: "surat-peminjaman.pdf" },
  suratTugas: { route: "surat-tugas", label: "Surat Tugas", fallbackName: "surat-tugas.pdf" },
};

export function BookingDocumentButton({ booking, kind = "document" }: { booking: Booking; kind?: BookingLetterKind }) {
  const letter = LETTERS[kind];
  const fileName = kind === "document" ? booking.documentOriginalName : booking.suratTugasOriginalName;
  const [loading, setLoading] = useState(false);
  if (!fileName) return null;

  const download = async () => {
    setLoading(true);
    try {
      const response = await api.get<Blob>(`/bookings/${booking.id}/${letter.route}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return <button type="button" onClick={download} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-accent-line bg-accent-soft px-2.5 py-1.5 text-xs font-bold text-accent transition hover:bg-accent-soft disabled:opacity-50"><Download size={13} />{loading ? "Mengunduh..." : `Unduh ${letter.label}`}</button>;
}