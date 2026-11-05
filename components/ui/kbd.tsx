import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A keyboard key hint, e.g. <Kbd>q</Kbd>. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.25rem] items-center justify-center rounded border border-border bg-surface-muted px-1 font-sans text-[0.6875rem] leading-4 font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
