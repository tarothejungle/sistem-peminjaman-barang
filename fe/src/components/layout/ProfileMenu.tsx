import { ChevronDown, KeyRound, LogOut, Pencil, Palette, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ResourceImage } from "../common/ResourceImage";
import { useAuthStore } from "../../store/authStore";
import { getRoleLabel } from "../../utils/roleLabel";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface Props {
  onChangePassword: () => void;
  onLogout: () => void;
  onEditProfile?: () => void;
  showThemeOption?: boolean;
  showLabel?: boolean;
}

export function ProfileMenu({ onChangePassword, onLogout, onEditProfile, showThemeOption = false, showLabel = false }: Props) {
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!user) return null;

  const initial = user.fullName.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu akun ${user.fullName}`}
        className="flex items-center gap-2 rounded-xl p-1 text-ink-3 transition hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft text-sm font-bold text-accent ring-1 ring-accent-line">
          <ResourceImage
            key={`${user.profileImageUrl}-${user.updatedAt}`}
            url={user.profileImageUrl}
            alt={`Foto profil ${user.fullName}`}
            className="h-full w-full object-cover"
            fallback={<span aria-hidden="true">{initial}</span>}
          />
        </span>
        {showLabel && <span className="hidden text-sm font-semibold text-ink sm:inline">Profile</span>}
        <ChevronDown size={16} aria-hidden="true" className={`hidden transition sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft text-sm font-bold text-accent ring-1 ring-accent-line">
              <ResourceImage
                key={`menu-${user.profileImageUrl}-${user.updatedAt}`}
                url={user.profileImageUrl}
                alt=""
                className="h-full w-full object-cover"
                fallback={<UserRound size={19} aria-hidden="true" />}
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{user.fullName}</p>
              <p className="truncate text-xs text-ink-3">{getRoleLabel(user.role)}</p>
            </div>
          </div>
          {onEditProfile && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onEditProfile(); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-ink-2 transition hover:bg-hover hover:text-ink"
            >
              <Pencil size={17} aria-hidden="true" className="shrink-0" /> Ubah Data
            </button>
          )}
          {showThemeOption && (
            <div className="border-t border-line px-4 py-3" role="none">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink-3"><Palette size={15} aria-hidden="true" /> Pemilihan Tema</div>
              <ThemeSwitcher variant="compact" />
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onChangePassword(); }}
            className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-sm font-semibold text-ink-2 transition hover:bg-hover hover:text-ink"
          >
            <KeyRound size={17} aria-hidden="true" className="shrink-0" /> Ganti Password
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-sm font-semibold text-danger transition hover:bg-danger-soft"
          >
            <LogOut size={17} aria-hidden="true" className="shrink-0" /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
