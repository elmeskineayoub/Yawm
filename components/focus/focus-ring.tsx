import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A circular progress ring around the timer. Decorative: the countdown text inside carries the
 * information, and a separate progressbar role reports progress to assistive technology.
 */
export function FocusRing({
  progress,
  size,
  stroke = 6,
  tone = "accent",
  className,
  children,
}: {
  /** 0 to 1. */
  progress: number;
  /** Outer size in CSS (e.g. "18rem" or "min(70vmin, 28rem)"). */
  size: string;
  stroke?: number;
  /** Breaks use a quieter ring than focus. */
  tone?: "accent" | "muted";
  className?: string;
  children?: ReactNode;
}) {
  const r = 50 - stroke / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={cn(
            "transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none",
            tone === "accent" ? "stroke-accent" : "stroke-muted-foreground/60",
          )}
        />
      </svg>
      <div className="relative flex flex-col items-center text-center">{children}</div>
    </div>
  );
}
