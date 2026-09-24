import type { ReactNode } from "react";
import { BrandLogo } from "../../../components/common/BrandLogo";
import { ThemeSwitcher } from "../../../components/layout/ThemeSwitcher";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Rendered under the form, typically a "back to login" link. */
  footer?: ReactNode;
  headingId?: string;
  /** Hide the theme control so the screen follows the theme chosen on the login page. */
  showThemeSwitcher?: boolean;
}

/**
 * Shared shell for the standalone auth screens (forgot / reset password) so they
 * match the login page surface without duplicating its layout.
 */
export function AuthCard({ title, subtitle, children, footer, headingId = "auth-card-heading", showThemeSwitcher = true }: AuthCardProps) {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-surface px-4 py-6 text-ink sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-accent-soft blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-[-10%] h-72 w-72 rounded-full bg-accent-soft blur-[120px]" />
      <div aria-hidden="true" className="login-grid pointer-events-none absolute inset-0" />

      <section
        aria-labelledby={headingId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-line border-t-line-strong bg-panel-strong p-6 shadow-2xl shadow-shade backdrop-blur-xl sm:p-8 md:p-10"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />

        {/* Optional pre-login theme control; the forgot-password screen hides it and inherits the login choice. */}
        {showThemeSwitcher && (
          <div className="mb-4 flex justify-end">
            <ThemeSwitcher variant="compact" />
          </div>
        )}

        <header className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="mb-5 h-[65px] w-[65px]" />
          <h1 id={headingId} className="text-2xl font-bold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-ink-3">{subtitle}</p>
        </header>

        {children}

        {footer && <div className="mt-7 text-center text-sm">{footer}</div>}

        <footer className="mt-8 text-center text-[11px] text-ink-4">
          &copy; {new Date().getFullYear()} Sistem Peminjaman Ruang Rapat &amp; Kendaraan
        </footer>
      </section>
    </main>
  );
}

export const authInputClass =
  "w-full rounded-xl border border-line bg-inset px-4 py-3 pl-10 text-ink caret-accent placeholder:text-ink-4 transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong focus:border-accent focus:bg-inset-strong focus:outline-none focus:ring-2 focus:ring-accent-ring";

export const authSubmitClass =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-solid px-4 py-3.5 font-semibold text-onaccent shadow-lg shadow-accent-glow transition-[background-color,box-shadow,transform,opacity] duration-200 hover:bg-accent-hover hover:shadow-accent-glow active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100";
