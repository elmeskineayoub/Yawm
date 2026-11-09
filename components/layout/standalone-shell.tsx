import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";

/**
 * The frame for pages outside the app shell (sign-in, setup, not found): the logo centred above a
 * single column. With `card`, the content sits on the same panel surface the app uses for a
 * featured block (8px radius, hairline border, no shadow; shadows are kept for floating layers).
 */
export function StandaloneShell({
  children,
  width = "sm",
  card = false,
}: {
  children: ReactNode;
  width?: "sm" | "lg";
  card?: boolean;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className={cn("w-full", width === "sm" ? "max-w-sm" : "max-w-lg")}>
        <div className="mb-8 flex justify-center">
          <BrandLogo heightRem={2} />
        </div>
        {card ? (
          <div className="rounded-lg border border-border bg-surface p-6 sm:p-7">{children}</div>
        ) : (
          children
        )}
      </div>
    </main>
  );
}
