import { cn } from "@/lib/utils";

/**
 * A thin, labelled progress meter for a percentage (projects, goals). The visible value sits next
 * to the bar in text tokens; the bar itself carries no text.
 */
export function Meter({
  percent,
  label,
  valueText,
  className,
}: {
  percent: number;
  /** Accessible name, e.g. "Pricing page progress". */
  label: string;
  /** Spoken value, e.g. "6 of 9 tasks done". */
  valueText: string;
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn("h-1.5 overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}
