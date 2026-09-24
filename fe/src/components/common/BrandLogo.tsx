import { useThemeStore, type Theme } from "../../store/themeStore";

/**
 * Per-theme artwork. Both marks are transparent PNGs, so each one sits directly on
 * its own palette instead of needing a stand-in chip behind it.
 */
const LOGO_BY_THEME: Record<Theme, string> = {
  light: "logo-kemnaker-biru.png",
  dark: "logo-kemnaker-putih.png",
};

interface BrandLogoProps {
  className?: string;
  /** Rendered as the accessible name; pass "" for decorative use. */
  alt?: string;
}

/**
 * Single source of truth for the institution logo.
 *
 * BASE_URL keeps the path correct under the /app/ deploy prefix.
 */
export function BrandLogo({ className = "h-11 w-11", alt = "Logo Kementerian Ketenagakerjaan" }: BrandLogoProps) {
  const theme = useThemeStore((state) => state.theme);

  return (
    <img
      src={`${import.meta.env.BASE_URL}${LOGO_BY_THEME[theme]}`}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      className={`shrink-0 object-contain ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}
