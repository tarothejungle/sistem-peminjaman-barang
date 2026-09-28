import { AlertOctagon, AlertTriangle, CircleAlert, Info, type LucideIcon } from "lucide-react";
import type { AttentionSignalWord } from "../api/useAttentionMessages";

export interface SignalWordStyle {
  label: string;
  icon: LucideIcon;
  border: string;
  background: string;
  text: string;
  solid: string;
}

export const SIGNAL_WORD_STYLES: Record<AttentionSignalWord, SignalWordStyle> = {
  NOTICE: { label: "Notice", icon: Info, border: "border-accent-line", background: "bg-accent-soft", text: "text-accent", solid: "bg-accent-solid" },
  CAUTION: { label: "Caution", icon: CircleAlert, border: "border-warn-line", background: "bg-warn-soft", text: "text-warn", solid: "bg-warn-solid" },
  WARNING: { label: "Warning", icon: AlertTriangle, border: "border-warn-line", background: "bg-warn-soft", text: "text-warn", solid: "bg-warn-solid" },
  DANGER: { label: "Danger", icon: AlertOctagon, border: "border-danger-line", background: "bg-danger-soft", text: "text-danger", solid: "bg-danger-solid" },
};
