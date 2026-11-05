import { cn } from "@/lib/utils";

/** Placeholder block shown while content loads. Decorative; announce loading separately. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-muted", className)} />;
}

/** A few list-row placeholders, matching the compact task/habit row height. */
export function SkeletonRows({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton
            className={cn("h-3.5", i % 3 === 0 ? "w-2/3" : i % 3 === 1 ? "w-1/2" : "w-3/5")}
          />
        </div>
      ))}
    </div>
  );
}
