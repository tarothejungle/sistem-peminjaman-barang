import { Ban, CheckCircle2, Clock3, Hammer, History, PlayCircle, Sparkles, XCircle } from "lucide-react";
import { BookingStatus } from "../../../types";

interface BookingStatusBadgeProps {
  status: BookingStatus;
}

const statusConfig = {
  [BookingStatus.PENDING_PJ_REVIEW]: {
    label: "Menunggu Pemeriksaan PJ",
    className: "bg-amber-100 text-amber-800",
    icon: Clock3,
  },
  [BookingStatus.PENDING_KABAG_APPROVAL]: {
    label: "Menunggu Persetujuan Kabag",
    className: "bg-amber-100 text-amber-800",
    icon: Clock3,
  },
  [BookingStatus.APPROVED]: {
    label: "Disetujui",
    className: "bg-emerald-100 text-emerald-800",
    icon: CheckCircle2,
  },
  [BookingStatus.ALTERNATIVE_OFFERED]: {
    label: "Alternatif Ditawarkan",
    className: "bg-amber-100 text-amber-800",
    icon: History,
  },
  [BookingStatus.CONFIRMED]: {
    label: "Dikonfirmasi",
    className: "bg-emerald-100 text-emerald-800",
    icon: CheckCircle2,
  },
  [BookingStatus.PREPARING]: {
    label: "Sedang Dipersiapkan",
    className: "bg-blue-100 text-blue-800",
    icon: Hammer,
  },
  [BookingStatus.IN_USE]: {
    label: "Sedang Digunakan",
    className: "bg-blue-100 text-blue-800",
    icon: PlayCircle,
  },
  [BookingStatus.FINISHED_PENDING_INSPECTION]: {
    label: "Menunggu Inspeksi",
    className: "bg-purple-100 text-purple-800",
    icon: Sparkles,
  },
  [BookingStatus.COMPLETED]: {
    label: "Selesai",
    className: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  [BookingStatus.REJECTED]: {
    label: "Ditolak",
    className: "bg-rose-100 text-rose-800",
    icon: XCircle,
  },
  [BookingStatus.CANCELLED]: {
    label: "Dibatalkan",
    className: "bg-slate-100 text-slate-700",
    icon: Ban,
  },
} as const;

export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${config.className}`}>
      <Icon size={13} aria-hidden="true" />
      {config.label}
    </span>
  );
}
