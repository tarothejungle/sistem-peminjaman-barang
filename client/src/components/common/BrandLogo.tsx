import { Building2 } from "lucide-react";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = "h-11 w-11" }: BrandLogoProps) {
  return (
    <span className={`grid place-items-center rounded-xl bg-blue-600 text-white ${className}`} aria-hidden="true">
      <Building2 size={22} />
    </span>
  );
}
