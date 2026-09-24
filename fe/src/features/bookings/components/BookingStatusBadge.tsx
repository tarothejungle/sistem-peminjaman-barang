import { Ban, CheckCircle2, Clock3, Hammer, History, PlayCircle, Sparkles, XCircle } from "lucide-react";
import { BookingStatus } from "../../../types";
import { bookingStatusLabels } from "../bookingStatus";

interface BookingStatusBadgeProps {
  status: BookingStatus;
}

const statusConfig = {
  [BookingStatus.PENDING_PJ_REVIEW]: {
    className: "border border-warn-line bg-warn-soft text-warn",
    icon: Clock3,
  },
  [BookingStatus.PENDING_KABAG_APPROVAL]: {
    className: "border border-warn-line bg-warn-soft text-warn",
    icon: Clock3,
  },
  [BookingStatus.APPROVED]: {
    className: "border border-ok-line bg-ok-soft text-ok",
    icon: CheckCircle2,
  },
  [BookingStatus.ALTERNATIVE_OFFERED]: {
    className: "border border-warn-line bg-warn-soft text-warn",
    icon: History,
  },
  [BookingStatus.CONFIRMED]: {
    className: "border border-ok-line bg-ok-soft text-ok",
    icon: CheckCircle2,
  },
  [BookingStatus.PREPARING]: {
    className: "border border-accent-line bg-accent-soft text-accent",
    icon: Hammer,
  },
  [BookingStatus.IN_USE]: {
    className: "border border-accent-line bg-accent-soft text-accent",
    icon: PlayCircle,
  },
  [BookingStatus.FINISHED_PENDING_INSPECTION]: {
    className: "border border-alt-line bg-alt-soft text-alt",
    icon: Sparkles,
  },
  [BookingStatus.COMPLETED]: {
    className: "border border-ok-line bg-ok-soft text-ok",
    icon: CheckCircle2,
  },
  [BookingStatus.REJECTED]: {
    className: "border border-danger-line bg-danger-soft text-danger",
    icon: XCircle,
  },
  [BookingStatus.CANCELLED]: {
    className: "border border-line bg-raised text-ink-2",
    icon: Ban,
  },
} as const;

export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${config.className}`}>
      <Icon size={13} aria-hidden="true" />
      {bookingStatusLabels[status]}
    </span>
  );
}
