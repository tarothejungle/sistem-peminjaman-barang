interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = "h-11 w-11" }: BrandLogoProps) {
  return <img src={`${import.meta.env.BASE_URL}binwasnaker.jpg`} alt="Logo Binwasnaker" className={`rounded-xl object-cover ${className}`} />;
}
