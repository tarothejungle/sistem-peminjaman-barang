import { ArrowUpRight, Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../store/authStore";
import type { UserNotification } from "../../../types";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "../api/useNotifications";
import { getNotificationDestination } from "../notificationDestination";

export function NotificationMenu({ showLabel = false }: { showLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const containerRef = useRef<HTMLDivElement>(null);
  const inbox = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const notifications = inbox.data?.notifications ?? [];
  const unreadCount = inbox.data?.unreadCount ?? 0;
  const openNotification = (notification: UserNotification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
    navigate(getNotificationDestination(role, notification.type));
  };

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ""}`} aria-expanded={open} className={`relative flex h-10 items-center justify-center gap-2 rounded-xl px-2 text-ink-3 transition hover:bg-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${showLabel ? "sm:px-3" : "w-10"}`}>
        <Bell size={20} />
        {showLabel && <span className="hidden text-sm font-semibold sm:inline">Notifikasi</span>}
        {unreadCount > 0 && <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-black text-ink">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && <div className="absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><div><p className="font-bold text-ink">Notifikasi</p><p className="text-xs text-ink-3">{unreadCount} belum dibaca</p></div>{unreadCount > 0 && <button type="button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent disabled:opacity-50"><CheckCheck size={14} /> Tandai semua</button>}</div>
        <div className="max-h-96 overflow-y-auto">{inbox.isLoading && <p className="p-5 text-center text-sm text-ink-3">Memuat notifikasi...</p>}{inbox.isError && <p className="p-5 text-center text-sm text-danger">Notifikasi gagal dimuat.</p>}{!inbox.isLoading && notifications.length === 0 && <p className="p-5 text-center text-sm text-ink-3">Belum ada notifikasi.</p>}{notifications.map((notification) => <button key={notification.id} type="button" onClick={() => openNotification(notification)} className={`group block w-full border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-hover ${notification.readAt ? "" : "bg-accent-soft"}`}><span className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-ink-4" : "bg-accent"}`} /><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="block text-sm font-bold text-ink">{notification.title}</span><ArrowUpRight size={15} className="mt-0.5 shrink-0 text-ink-4 transition group-hover:text-accent" aria-hidden="true" /></span><span className="mt-1 block text-xs leading-5 text-ink-3">{notification.message}</span><span className="mt-1.5 block text-[10px] text-ink-4">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</span></span></span></button>)}</div>
      </div>}
    </div>
  );
}
