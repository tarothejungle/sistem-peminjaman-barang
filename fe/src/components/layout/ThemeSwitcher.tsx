import { Moon, Sun } from "lucide-react";
import { useThemeStore, type Theme } from "../../store/themeStore";

const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Two-option theme control shared by the sidebar and the standalone auth screens.
 *
 * `variant` only changes chrome, never behaviour:
 *  - sidebar: labelled group that collapses to icons with the rail.
 *  - compact: label-less pill for the login / forgot / reset cards, where there is
 *    no room for a heading and the icons alone have to carry the meaning.
 */
export function ThemeSwitcher({ collapsed = false, variant = "sidebar" }: { collapsed?: boolean; variant?: "sidebar" | "compact" }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const compact = variant === "compact";

  return (
    <div className={compact ? "" : collapsed ? "lg:space-y-1" : ""} role="radiogroup" aria-label="Tema tampilan">
      {compact ? null : (
        <p className={`px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-4 ${collapsed ? "lg:hidden" : ""}`}>Tema</p>
      )}
      <div
        className={
          compact
            ? "inline-grid grid-cols-2 gap-1 rounded-full border border-line bg-inset-soft p-1"
            : `grid grid-cols-2 gap-1 rounded-xl border border-line bg-inset-soft p-1 ${collapsed ? "lg:grid-cols-1" : ""}`
        }
      >
        {options.map((option) => {
          const isActive = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={option.label}
              onClick={() => setTheme(option.value)}
              className={`flex items-center justify-center gap-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                compact ? "min-h-9 w-9 rounded-full" : "min-h-9 rounded-lg"
              } ${isActive ? "bg-accent-solid text-onaccent shadow-lg shadow-accent-glow" : "text-ink-3 hover:bg-hover hover:text-ink"}`}
            >
              <option.icon size={15} aria-hidden="true" className="shrink-0" />
              {compact ? <span className="sr-only">{option.label}</span> : <span className={collapsed ? "lg:hidden" : ""}>{option.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
