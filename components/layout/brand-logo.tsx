import { cn } from "@/lib/utils";

// The uploaded wordmark lives at public/logo.png (trimmed). It's a single-colour, transparent
// artwork, so we render it as a CSS mask filled with the theme's foreground colour — that keeps it
// crisp and visible in both light and dark themes. To swap the artwork, replace public/logo.png
// (any single-colour transparent PNG/SVG); the aspect ratio below may need updating.
const LOGO_ASPECT = 902 / 381; // trimmed public/logo.png width / height

/**
 * The Yawm brand lockup: the logo wordmark, optionally followed by the name in the display font.
 * `showText={false}` renders the mark only (e.g. a collapsed sidebar) with an accessible label.
 */
export function BrandLogo({
  showText = true,
  className,
  heightRem = 1.6,
}: {
  showText?: boolean;
  className?: string;
  heightRem?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="block shrink-0 bg-foreground"
        style={{
          height: `${heightRem}rem`,
          width: `${heightRem * LOGO_ASPECT}rem`,
          maskImage: "url(/logo.png)",
          WebkitMaskImage: "url(/logo.png)",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
      {showText ? (
        <span className="font-display text-base font-semibold tracking-tight text-foreground">
          Yawm
        </span>
      ) : (
        <span className="sr-only">Yawm</span>
      )}
    </span>
  );
}
