import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "danger" | "warning" | "success" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-border text-muted-foreground",
  danger: "border-red-300 text-red-700 dark:border-red-900 dark:text-red-300",
  warning: "border-amber-300 text-amber-800 dark:border-amber-900 dark:text-amber-300",
  success: "border-green-300 text-green-800 dark:border-green-900 dark:text-green-300",
  info: "border-sky-300 text-sky-800 dark:border-sky-900 dark:text-sky-300",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs leading-none whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
