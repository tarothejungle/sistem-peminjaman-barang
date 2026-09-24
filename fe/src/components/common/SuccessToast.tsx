import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), 3_000);
    return () => window.clearTimeout(timer);
  }, [message]);

  return <div role="status" className="fixed right-4 top-20 z-[80] flex max-w-sm items-center gap-3 rounded-xl border border-ok-line bg-panel-strong p-4 shadow-2xl shadow-shade backdrop-blur-xl"><p className="flex-1 text-sm font-bold text-ok">{message}</p><button type="button" onClick={onClose} aria-label="Tutup notifikasi"><X size={16} className="text-ink-3 transition hover:text-ink" /></button></div>;
}
