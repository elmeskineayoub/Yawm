import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "danger" | "warning" | "success" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-border text-muted-foreground",
  danger: "border-transparent bg-danger-soft text-danger",
  warning: "border-transparent bg-warning-soft text-warning",
  success: "border-transparent bg-success-soft text-success",
  info: "border-transparent bg-info-soft text-info",
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
