interface TeamLogoProps {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
};

export function TeamLogo({ name, abbreviation, logoUrl, size = "md" }: TeamLogoProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={`${sizeClass} rounded object-cover`}
      />
    );
  }

  const initials = abbreviation ?? name.slice(0, 2).toUpperCase();

  return (
    <div className={`${sizeClass} rounded bg-primary/10 flex items-center justify-center font-bold text-primary`}>
      {initials}
    </div>
  );
}
