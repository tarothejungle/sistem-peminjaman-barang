import { Download } from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import type { Booking } from "../../../types";

export function BookingDocumentButton({ booking }: { booking: Booking }) {
  const [loading, setLoading] = useState(false);
  if (!booking.documentOriginalName) return null;

  const download = async () => {
    setLoading(true);
    try {
      const response = await api.get<Blob>(`/bookings/${booking.id}/document`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = booking.documentOriginalName ?? "surat-peminjaman.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return <button type="button" onClick={download} disabled={loading} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-50"><Download size={13} />{loading ? "Mengunduh..." : "Unduh surat PDF"}</button>;
}
